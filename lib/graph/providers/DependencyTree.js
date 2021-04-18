/**
 * Tree node
 *
 * @public
 * @typedef {object} TreeNode
 * @property {string} node.id Unique ID for the project
 * @property {string} node.version Version of the project
 * @property {string} node.path File System path to access the projects resources
 * @property {object|object[]} [node.configuration]
 *	Configuration object or array of objects to use instead of reading from a configuration file
 * @property {string} [node.configPath] Configuration file to use instead the default ui5.yaml
 * @property {TreeNode[]} dependencies
 */
class DependencyTree {
	/**
	 * Helper module to create a [@ui5/project.graph.ProjectGraph]{@link module:@ui5/project.graph.ProjectGraph}
	 * from a dependency tree as returned by translators.
	 *
	 * @public
	 * @alias module:@ui5/project.graph.projectGraphFromTree
	 * @param {TreeNode} tree Dependency tree as returned by a translator
	 */
	constructor(tree) {
		if (!tree) {
			throw new Error(`Failed to instantiate DependencyTree provider: Missing parameter 'tree'`);
		}
		this._tree= tree;
	}

	async getRootNode() {
		return this._tree;
	}

	async getDependencies(node) {
		if (node.deduped || !node.dependencies) {
			return [];
		}
		return node.dependencies;
	}
}

module.exports = DependencyTree;
