/**
 * Tree node
 *
 * node.id Unique ID for the project
 *
 * node.version Version of the project
 *
 * node.path File System path to access the projects resources
 *
 * [node.configuration]
 * Configuration object or array of objects to use instead of reading from a configuration file
 *
 * [node.configPath] Configuration file to use instead the default ui5.yaml
 *
 */

/**
 * Helper module to create a [@ui5/project/graph/ProjectGraph]{@link @ui5/project/graph/ProjectGraph}
 * from a dependency tree as returned by translators.
 *
 * @alias @ui5/project/graph/providers/DependencyTree
 */
class DependencyTree {
	/**
	 * @param options
	 * @param options.dependencyTree
	 * 		Dependency tree as returned by a translator
	 * @param [options.rootConfiguration]
	 *		Configuration object to use for the root module instead of reading from a configuration file
	 * @param [options.rootConfigPath]
	 *		Configuration file to use for the root module instead the default ui5.yaml
	 */
	constructor({dependencyTree, rootConfiguration, rootConfigPath}: object) {
		if (!dependencyTree) {
			throw new Error(`Failed to instantiate DependencyTree provider: Missing parameter 'dependencyTree'`);
		}
		this._tree = dependencyTree;
		if (rootConfiguration) {
			this._tree.configuration = rootConfiguration;
		}
		if (rootConfigPath) {
			this._tree.configPath = rootConfigPath;
		}
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

export default DependencyTree;
