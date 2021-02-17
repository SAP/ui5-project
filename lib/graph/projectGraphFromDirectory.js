const projectGraphBuilder = require("./projectGraphBuilder");
const ui5Framework = require("./providers/ui5Framework");
const log = require("@ui5/logger").getLogger("graph:projectGraphFromDirectory");

/**
 * Helper module to create a [@ui5/project.graph.ProjectGraph]{@link module:@ui5/project.graph.ProjectGraph}
 * from a directory
 *
 * @public
 * @alias module:@ui5/project.graph.projectGraphFromTree
 * @param {TreeNode} tree Dependency tree as returned by a translator
 * @returns {module:@ui5/project.graph.ProjectGraph} A new project graph instance
 */
const projectGraphFromDirectory = {
	/**
	 * Generates a [@ui5/project.graph.ProjectGraph]{@link module:@ui5/project.graph.ProjectGraph} by resolving
	 * dependencies from package.json files and configuring projects from ui5.yaml files
	 *
	 * @public
	 * @param {object} [options]
	 * @param {string} [options.cwd=.] Directory to start searching for the root module
	 * @param {object} [options.rootConfiguration]
	 *		Configuration object to use for the root module instead of reading from a configuration file
	 * @param {string} [options.rootConfigPath]
	 *		Configuration file to use for the root module instead the default ui5.yaml
	 * @param {string} [options.versionOverride] Framework version to use instead of the one defined in the root project
	 * @returns {Promise<module:@ui5/project.graph.ProjectGraph>} Promise resolving to a Project Graph instance
	 */
	usingNpm: async function({cwd = ".", rootConfiguration, rootConfigPath, versionOverride}) {
		log.verbose(`Creating project graph using npm provider...`);
		const NpmProvider = require("./providers/npm");

		const provider = new NpmProvider({
			cwd: cwd,
			rootConfiguration,
			rootConfigPath
		});

		const projectGraph = await projectGraphBuilder(provider);

		await ui5Framework.enrichProjectGraph(projectGraph, {versionOverride});

		return projectGraph;
	},

	/**
	 * Generates a [@ui5/project.graph.ProjectGraph]{@link module:@ui5/project.graph.ProjectGraph} from on a
	 * YAML file following the structure of the
	 * [@ui5/project.graph.projectGraphFromTree]{@link module:@ui5/project.graph.projectGraphFromTree} API
	 *
	 * @public
	 * @param {object} options
	 * @param {object} options.filePath Path to the file dependency configuration file
	 * @param {string} [options.cwd=.] Directory to start searching for the root module
	 * @param {string} [options.versionOverride] Framework version to use instead of the one defined in the root project
	 * @returns {Promise<module:@ui5/project.graph.ProjectGraph>} Promise resolving to a Project Graph instance
	 */
	usingStaticFile: async function({cwd = ".", filePath, versionOverride}) {
		log.verbose(`Creating project graph using static file...`);
		const staticTranslator = require("../translators/static");
		const DependencyTreeProvider = require("./providers/DependencyTree");

		const tree = await staticTranslator.generateDependencyTree(null, {
			parameters: [filePath] // *sigh*
		});

		const provider = new DependencyTreeProvider({
			tree
		});

		const projectGraph = await projectGraphBuilder(provider);

		await ui5Framework.enrichProjectGraph(projectGraph, {versionOverride});

		return projectGraph;
	}
};

module.exports = projectGraphFromDirectory;
