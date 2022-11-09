import fs from "graceful-fs";
import path from "node:path";
import {promisify} from "node:util";
import logger from "@ui5/logger";

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

	async getNode(id) {
		const nodes = await this._getResolvedNodes();
		return nodes.get(id);
	}

	getNodes() {
		return this._getResolvedNodes();
	}

	_getResolvedNodes() {
		if (this._pResolvedNodes) {
			return this._pResolvedNodes;
		}

		return this._pResolvedNodes = this._resolveNodes();
	}

	async _resolveNodes() {
		if (!this._dependencyManagement?.resolutions?.length) {
			return new Map();
		}

		let resolvedNodes = await Promise.all(this._dependencyManagement.resolutions.map(async (resolutionConfig) => {
			if (!resolutionConfig.path) {
				throw new Error(
					`Missing property 'path' in dependency resolution configuration of workspace ${this._name}`);
			}
			const nodes = await this._getNodesFromPath(this._cwd, resolutionConfig.path);

			if (!Array.isArray(nodes) && resolutionConfig.configuration) {
				nodes.configuration = resolutionConfig.configuration;
			}
			return nodes;
		}));

		// Flatten array since workspaces might have lead to nested arrays
		resolvedNodes = Array.prototype.concat.apply([], resolvedNodes);
		return new Map(resolvedNodes.map((node) => {
			return [node.id, node];
		}));
	}

	async _getNodesFromPath(cwd, relPath, resolveWorkspace = true) {
		const nodePath = path.join(this._cwd, relPath);
		const pkg = await this._readPackageJson(nodePath);
		if (pkg.workspaces?.length) {
			if (!resolveWorkspace) {
				log.info(`Ignoring nested package workspace of module ${pkg.name} at ${nodePath}`);
				return [];
			}
			return Promise.all(pkg.workspaces.map(async (workspacePath) => {
				const nodes = await this._getNodesFromPath(nodePath, workspacePath, false);
				if (nodes.lengh > 1) {
					throw new Error(
						`Package workspace of module ${pkg.name} at ${nodePath} ` +
						`unexpectedly resolved to multiple modules`);
				}
				return nodes[0];
			}));
		} else {
			return this._getNodeFromPackage(pkg, nodePath);
		}
	}

	_getNodeFromPackage(pkg, path) {
		return {
			id: pkg.name,
			version: pkg.version,
			path: path
		};
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
