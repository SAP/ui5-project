const path = require("path");
const projectGraphBuilder = require("./graph/providers/projectGraphBuilder");
const ui5Framework = require("./graph/helpers/ui5Framework");
const log = require("@ui5/logger").getLogger("generateProjectGraph");

/**
 * Helper module to create a [@ui5/project.graph.ProjectGraph]{@link module:@ui5/project.graph.ProjectGraph}
 * from a directory
 *
 * @public
 * @alias module:@ui5/project.generateProjectGraph
 * @param {TreeNode} tree Dependency tree as returned by a translator
 * @returns {module:@ui5/project.graph.ProjectGraph} A new project graph instance
 */
const generateProjectGraph = {
	/**
	 * Generates a [@ui5/project.graph.ProjectGraph]{@link module:@ui5/project.graph.ProjectGraph} by resolving
	 * dependencies from package.json files and configuring projects from ui5.yaml files
	 *
	 * @public
	 * @param {object} [options]
	 * @param {string} [options.cwd=process.cwd()] Directory to start searching for the root module
	 * @param {object} [options.rootConfiguration]
	 *		Configuration object to use for the root module instead of reading from a configuration file
	 * @param {string} [options.rootConfigPath]
	 *		Configuration file to use for the root module instead the default ui5.yaml
	 * @param {string} [options.versionOverride] Framework version to use instead of the one defined in the root project
	 * @returns {Promise<module:@ui5/project.graph.ProjectGraph>} Promise resolving to a Project Graph instance
	 */
	usingNodePackageDependencies: async function({cwd, rootConfiguration, rootConfigPath, versionOverride}) {
		log.verbose(`Creating project graph using npm provider...`);
		const NpmProvider = require("./graph/providers/NodePackageDependencies");

		const provider = new NpmProvider({
			cwd: cwd ? path.resolve(cwd) : process.cwd(),
			rootConfiguration,
			rootConfigPath
		});

		const projectGraph = await projectGraphBuilder(provider);

		await ui5Framework.enrichProjectGraph(projectGraph, {versionOverride});

		return projectGraph;
	},

	/**
	 * Generates a [@ui5/project.graph.ProjectGraph]{@link module:@ui5/project.graph.ProjectGraph} from a
	 * YAML file following the structure of the
	 * [@ui5/project.graph.projectGraphFromTree]{@link module:@ui5/project.graph.projectGraphFromTree} API
	 *
	 * @public
	 * @param {object} options
	 * @param {object} options.filePath Path to the file dependency configuration file
	 * @param {string} [options.cwd=process.cwd()] Directory to start searching for the root module
	 * @param {string} [options.versionOverride] Framework version to use instead of the one defined in the root project
	 * @returns {Promise<module:@ui5/project.graph.ProjectGraph>} Promise resolving to a Project Graph instance
	 */
	usingStaticFile: async function({cwd, filePath, versionOverride}) {
		log.verbose(`Creating project graph using static file...`);
		const staticTranslator = require("./translators/static");

		const dependencyTree = await staticTranslator.generateDependencyTree(cwd ? path.resolve(cwd) : process.cwd(), {
			parameters: [filePath] // *sigh*
		});

		const DependencyTreeProvider = require("./graph/providers/DependencyTree");
		const provider = new DependencyTreeProvider({
			dependencyTree
		});

		const projectGraph = await projectGraphBuilder(provider);

		await ui5Framework.enrichProjectGraph(projectGraph, {versionOverride});

		return projectGraph;
	},

	/**
	 * Generates a [@ui5/project.graph.ProjectGraph]{@link module:@ui5/project.graph.ProjectGraph} from a
	 * YAML file following the structure of the
	 * [@ui5/project.graph.projectGraphFromTree]{@link module:@ui5/project.graph.projectGraphFromTree} API
	 *
	 * @public
	 * @param {object} options
	 * @param {module:@ui5/project.graph.providers.DependencyTree.TreeNode} options.dependencyTree
	 * @param {string} [options.versionOverride] Framework version to use instead of the one defined in the root project
	 * @returns {Promise<module:@ui5/project.graph.ProjectGraph>} Promise resolving to a Project Graph instance
	 */
	usingObject: async function({dependencyTree, versionOverride}) {
		log.verbose(`Creating project graph using object...`);

		const DependencyTreeProvider = require("./graph/providers/DependencyTree");
		const dependencyTreeProvider = new DependencyTreeProvider({
			dependencyTree
		});

		const projectGraph = await projectGraphBuilder(dependencyTreeProvider);

		await ui5Framework.enrichProjectGraph(projectGraph, {versionOverride});

		return projectGraph;
	}
};

module.exports = generateProjectGraph;
