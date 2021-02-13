const Module = require("../Module");
const ProjectGraph = require("./ProjectGraph");
const ShimCollection = require("./ShimCollection");
const log = require("@ui5/logger").getLogger("graph:projectGraphFromTree");

/**
 * Tree node
 *
 * @public
 * @typedef {object} TreeNode
 * @param {string} node.id Unique ID for the project
 * @param {string} node.version Version of the project
 * @param {string} node.path File System path to access the projects resources
 * @param {string} [node.configuration] Configuration object to use instead of reading from a configuration file
 * @param {string} [node.configPath] Configuration file to use instead the default ui5.yaml
 * @property {TreeNode[]} dependencies
 */

/**
 * @param {TreeNode} tree Dependency tree as returned by a translator
 */
module.exports = async function(tree) {
	const shimCollection = new ShimCollection();

	function addShimsToCollection(ext) {
		ext.forEach((e) => {
			if (e.getType() === "project-shim") {
				shimCollection.addShim(e);
			}
		});
	}

	const moduleCollection = {};

	const rootModule = new Module({
		id: tree.id,
		version: tree.version,
		modulePath: tree.path,
		configPath: tree.configPath,
		configuration: tree.configuration
	});
	const rootProject = await rootModule.getProject();
	if (!rootProject) {
		throw new Error(
			`Failed to crate a UI5 project from module ${tree.id} at ${tree.path}. ` +
			`Make sure the path is correct and a project configuration is present or supplied.`);
	}

	moduleCollection[tree.id] = rootModule;

	const rootProjectName = rootProject.getName();

	let qualifiedApplicationProject = null;
	if (rootProject.getType() === "application") {
		log.verbose(`Root project ${rootProjectName} qualified as application project for project graph`);
		qualifiedApplicationProject = rootProject;
	}

	const extensions = await rootModule.getExtensions();
	addShimsToCollection(extensions);

	const projectGraph = new ProjectGraph({
		rootProjectName: rootProjectName
	});
	projectGraph.addProject(rootProject);

	const queue = [];

	if (tree.dependencies) {
		queue.push({
			nodes: tree.dependencies,
			parentProjectName: rootProjectName
		});
	}

	// Breadth-first search
	while (queue.length) {
		const {nodes, parentProjectName} = queue.shift(); // Get and remove first entry from queue
		const res = await Promise.all(nodes.map(async (node) => {
			let ui5Module = moduleCollection[node.id];
			if (!ui5Module) {
				ui5Module = moduleCollection[node.id] = new Module({
					id: node.id,
					version: node.version,
					modulePath: node.path,
					configPath: node.configPath,
					configuration: node.configuration,
					shimCollection
				});
			} else if (ui5Module.getPath() !== node.path) {
				log.verbose(
					`Inconsistency detected: Tree contains multiple nodes with ID ${node.id} and different paths:` +
					`\nPath of already added node (this one will be used): ${ui5Module.getPath()}` +
					`\nPath of additional node (this one will be ignored in favor of the other): ${node.path}`);
			}

			const project = await ui5Module.getProject();
			const extensions = await ui5Module.getExtensions();

			return {
				node,
				project,
				extensions
			};
		}));

		// Keep this out of the async map function to ensure
		// all projects and extensions are applied a deterministic order
		for (let i = 0; i < res.length; i++) {
			const {node, project, extensions} = res[i];

			if (extensions.length) {
				addShimsToCollection(extensions);
				extensions.push(extensions);
			}

			if (!project) {
				continue;
			}


			const projectName = project.getName();
			if (project.getType() === "application") {
				// Special handling of application projects of which there must be exactly *one*
				// in the graph. Others shall be ignored.
				if (!qualifiedApplicationProject) {
					log.verbose(`Project ${projectName} qualified as application project for project graph`);
					qualifiedApplicationProject = project;
				} else if (!(qualifiedApplicationProject.getName() === projectName && node.deduped)) {
					// Project is not a duplicate of an already qualified project (which should
					// still be processed below), but a unique, additional application project

					// TODO: Should this rather be a verbose logging?
					//	projectPreprocessor handled this like any project that got ignored for some reason and did a
					//	(in this case misleading) general verbose logging "Ignoring project with missing configuration"
					log.info(
						`Excluding additional application project ${projectName} from graph. `+
						`The project graph can only feature a single project of type application. ` +
						`Project ${qualifiedApplicationProject.getName()} has already qualified for that role.`);
					continue;
				}
			}

			// if (!node.deduped) {
			// Even if not deduped, the node might occur multiple times in the tree (on separate branches).
			// Therefore still supplying the ignore duplicates parameter here (true)
			projectGraph.addProject(project, true);
			// }

			if (parentProjectName) {
				projectGraph.declareDependency(parentProjectName, projectName);
			}

			if (node.dependencies && !node.deduped) {
				queue.push({
					// copy array, so that the queue is stable while ignored project dependencies are removed
					nodes: [...node.dependencies],
					parentProjectName: projectName,
				});
			}
		}
	}

	return projectGraph;
};
