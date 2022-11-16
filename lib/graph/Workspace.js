import fs from "graceful-fs";
import path from "node:path";
import {promisify} from "node:util";
import logger from "@ui5/logger";
import Module from "./Module.js";

const readFile = promisify(fs.readFile);
const log = logger.getLogger("graph:Workspace");

/**
 * Dependency graph node representing a module
 *
 * @public
 * @typedef {object} @ui5/project/graph/Workspace~WorkspaceConfiguration
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
	/**
	 * @param {object} options
	 * @param {object} options.cwd
	 * @param {@ui5/project/graph/Workspace~WorkspaceConfiguration} options.workspaceConfiguration
	 * 	Workspace configuration
	 */
	constructor({cwd, workspaceConfiguration}) {
		if (!cwd || !workspaceConfiguration) {
			throw new Error("[Workspace] One or more mandatory parameters not provided");
		}

		this._cwd = cwd;
		this._name = workspaceConfiguration.metadata.name;
		this._dependencyManagement = workspaceConfiguration.dependencyManagement;
	}

	getName() {
		return this._name;
	}

	async getModuleByProjectName(name) {
		const {modules} = await this._getResolvedModules();
		return modules.get(name);
	}

	async getModuleByNodeId(id) {
		const {nodes} = await this._getResolvedModules();
		return nodes.get(id);
	}

	getModules() {
		return this._getResolvedModules().modules;
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
				modules: new Map(),
				nodes: new Map()
			};
		}

		let resolvedModules = await Promise.all(this._dependencyManagement.resolutions.map(async (resolutionConfig) => {
			if (!resolutionConfig.path) {
				throw new Error(
					`Missing property 'path' in dependency resolution configuration of workspace ${this._name}`);
			}
			return await this._getModulesFromPath(
				this._cwd, resolutionConfig.path, true);
		}));

		// Flatten array since package-workspaces might have resolved to multiple modules for a single resolution
		resolvedModules = Array.prototype.concat.apply([], resolvedModules);

		const nodes = new Map(resolvedModules.map((module) => {
			return [module.getId(), module];
		}));
		const modules = new Map();
		await Promise.all(resolvedModules.map(async (module) => {
			const {project} = await module.getSpecifications();
			if (project) {
				log.verbose(`Module ${module.getId()} contains project ${project.getName()}`);
				modules.set(project.getName(), module);
			} else {
				log.warn(`Failed to create a project from module ${module.getId()} at ${module.getPath()}`);
			}
		}));
		return {
			modules,
			nodes
		};
	}

	async _getModulesFromPath(cwd, relPath, resolveWorkspace = true) {
		const nodePath = path.join(this._cwd, relPath);
		const pkg = await this._readPackageJson(nodePath);
		if (pkg.workspaces?.length) {
			if (!resolveWorkspace) {
				log.info(`Ignoring nested package workspace of module ${pkg.name} at ${nodePath}`);
				return [];
			}
			return Promise.all(pkg.workspaces.map(async (workspacePath) => {
				const nodes = await this._getModulesFromPath(nodePath, workspacePath, false);
				if (nodes.lengh > 1) {
					throw new Error(
						`Workspace of module ${pkg.name} at ${nodePath} ` +
						`unexpectedly resolved to multiple modules`);
				}
				return nodes[0];
			}));
		} else {
			return new Module({
				id: pkg.name,
				version: pkg.version,
				modulePath: nodePath
			});
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
