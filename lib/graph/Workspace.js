import fs from "graceful-fs";
import {globby, isDynamicPattern} from "globby";
import path from "node:path";
import {promisify} from "node:util";
import {getLogger} from "@ui5/logger";
import Module from "./Module.js";

const readFile = promisify(fs.readFile);
const log = getLogger("graph:Workspace");


/**
 * Dependency graph node representing a module
 *
 * @public
 * @typedef {object} @ui5/project/graph/Workspace~configuration
 * @property {string} node.specVersion
 * @property {object} node.metadata Version of the project
 * @property {object} node.dependencyManagement
 */

/**
 * Workspace representation
 *
 * @public
 * @class
 * @alias @ui5/project/graph/Workspace
 */
class Workspace {
	#visitedNodePaths = new Set();

	/**
	 * @param {object} options
	 * @param {object} options.cwd Path to use for resolving all paths of the workspace configuration from.
	 *   This should contain platform-specific path separator
	 * @param {@ui5/project/graph/Workspace~configuration} options.configuration
	 * 	Workspace configuration
	 */
	constructor({cwd, configuration}) {
		if (!cwd || !configuration) {
			throw new Error("[Workspace] One or more mandatory parameters not provided");
		}

		this._cwd = cwd;
		this._name = configuration.metadata.name;
		this._dependencyManagement = configuration.dependencyManagement;
	}

	getName() {
		return this._name;
	}

	async getModuleByProjectName(name) {
		const {projectNameMap} = await this._getResolvedModules();
		return projectNameMap.get(name);
	}

	async getModuleByNodeId(id) {
		const {moduleIdMap} = await this._getResolvedModules();
		return moduleIdMap.get(id);
	}

	_getResolvedModules() {
		if (this._pResolvedModules) {
			return this._pResolvedModules;
		}

		return this._pResolvedModules = this._resolveModules();
	}

	async _resolveModules() {
		if (!this._dependencyManagement?.resolutions?.length) {
			return {
				projectNameMap: new Map(),
				moduleIdMap: new Map()
			};
		}

		let resolvedModules = await Promise.all(this._dependencyManagement.resolutions.map(async (resolutionConfig) => {
			if (!resolutionConfig.path) {
				throw new Error(
					`Missing property 'path' in dependency resolution configuration of workspace ${this._name}`);
			}
			return await this._getModulesFromPath(
				this._cwd, resolutionConfig.path);
		}));

		// Flatten array since package-workspaces might have resolved to multiple modules for a single resolution
		resolvedModules = Array.prototype.concat.apply([], resolvedModules);

		const projectNameMap = new Map();
		const moduleIdMap = new Map();
		await Promise.all(resolvedModules.map(async (module) => {
			const {project} = await module.getSpecifications();
			if (project) {
				log.verbose(`Module ${module.getId()} contains project ${project.getName()}`);
				projectNameMap.set(project.getName(), module);
				moduleIdMap.set(module.getId(), module);
			} else {
				log.warn(`Failed to create a project from module ${module.getId()} at ${module.getPath()}`);
			}
		}));
		return {
			projectNameMap,
			moduleIdMap
		};
	}

	async _getModulesFromPath(cwd, relPath) {
		const nodePath = path.join(cwd, relPath);
		if (this.#visitedNodePaths.has(nodePath)) {
			log.verbose(`Module located at ${nodePath} has already been visited`);
			return [];
		}
		this.#visitedNodePaths.add(nodePath);
		let pkg;
		try {
			pkg = await this._readPackageJson(nodePath);
			if (!pkg?.name || !pkg?.version) {
				throw new Error(
					`package.json must contain fields 'name' and 'version'`);
			}
		} catch (err) {
			throw new Error(
				`Failed to resolve workspace dependency resolution path ${relPath} to ${nodePath}: ${err.message}`);
		}

		// If the package defines an npm "workspaces", or an equivalent "ui5.workspaces" configuration,
		// resolve the workspace and only use the resulting modules. The root package is ignored.
		const packageWorkspaceConfig = pkg.ui5?.workspaces || pkg.workspaces;
		if (packageWorkspaceConfig?.length) {
			log.verbose(`Module ${pkg.name} provides a package.json workspaces configuration. ` +
				`Ignoring the module and resolving workspaces instead...`);
			const staticPatterns = [];
			// Split provided patterns into dynamic and static patterns
			// This is necessary, since fast-glob currently behaves different from
			// 	"glob" (used by @npmcli/map-workspaces) in that it does not match the
			// 	base directory in case it is equal to the pattern (https://github.com/mrmlnc/fast-glob/issues/47)
			// For example a pattern "package-a" would not match a directory called
			// 	"package-a" in the root directory of the project.
			// 	We therefore detect the static pattern and resolve it directly
			const dynamicPatterns = packageWorkspaceConfig.filter((pattern) => {
				if (isDynamicPattern(pattern)) {
					return true;
				} else {
					staticPatterns.push(pattern);
					return false;
				}
			});

			let searchPaths = [];
			if (dynamicPatterns.length) {
				searchPaths = await globby(dynamicPatterns, {
					cwd: nodePath,
					followSymbolicLinks: false,
					onlyDirectories: true,
				});
			}
			searchPaths.push(...staticPatterns);

			const resolvedModules = new Map();
			await Promise.all(searchPaths.map(async (pkgPath) => {
				const modules = await this._getModulesFromPath(nodePath, pkgPath);
				modules.forEach((module) => {
					const id = module.getId();
					if (!resolvedModules.get(id)) {
						resolvedModules.set(id, module);
					}
				});
			}));
			return Array.from(resolvedModules.values());
		} else {
			return [new Module({
				id: pkg.name,
				version: pkg.version,
				modulePath: nodePath
			})];
		}
	}

	/**
	 * Reads the package.json file and returns its content
	 *
	 * @private
	 * @param {string} modulePath Path to the module containing the package.json
	 * @returns {object} Package json content
	 */
	async _readPackageJson(modulePath) {
		const content = await readFile(path.join(modulePath, "package.json"), "utf8");
		return JSON.parse(content);
	}
}

export default Workspace;
