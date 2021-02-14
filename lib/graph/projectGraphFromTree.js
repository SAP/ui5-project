const path = require("path");
const Module = require("./Module");
const ProjectGraph = require("./ProjectGraph");
const ShimCollection = require("./ShimCollection");
const log = require("@ui5/logger").getLogger("graph:projectGraphFromTree");

function _handleExtensions(graph, shimCollection, extensions) {
	extensions.forEach((extension) => {
		const type = extension.getType();
		switch (type) {
		case "project-shim":
			shimCollection.addShim(extension);
			break;
		case "task":
		case "server-middleware":
			graph.addExtension(extension);
			break;
		default:
			throw new Error(
				`Encountered unexpected extension of type ${type} ` +
				`Supported types are 'project-shim', 'task' and 'middleware'`);
		}
	});
}

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

/**
 * Helper module to create a [@ui5/project.graph.ProjectGraph]{@link module:@ui5/project.graph.ProjectGraph}
 * from a dependency tree as returned by translators.
 *
 * @public
 * @alias module:@ui5/project.graph.projectGraphFromTree
 * @param {TreeNode} tree Dependency tree as returned by a translator
 * @returns {module:@ui5/project.graph.ProjectGraph} A new project graph instance
 */
module.exports = async function(tree) {
	const shimCollection = new ShimCollection();
	const moduleCollection = {};

	const rootModule = new Module({
		id: tree.id,
		version: tree.version,
		modulePath: tree.path,
		configPath: tree.configPath,
		configuration: tree.configuration
	});
	const {project: rootProject, extensions: rootExtensions} = await rootModule.getSpecifications();
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


	const projectGraph = new ProjectGraph({
		rootProjectName: rootProjectName
	});
	projectGraph.addProject(rootProject);

	function handleExtensions(extensions) {
		return _handleExtensions(projectGraph, shimCollection, extensions);
	}

	handleExtensions(rootExtensions);

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
			// First check for collection shims
			const collectionShims = shimCollection.getCollectionShims(node.id);
			if (collectionShims && collectionShims.length) {
				log.verbose(
					`One or more module collection shims have been defined for module ${node.id}. ` +
					`Therefore the module itself will not be resolved.`);

				const shimmedNodes = collectionShims.map(({name, shim}) => {
					log.verbose(`Applying module collection shim ${name} for module ${node.id}:`);
					return Object.entries(shim.modules).map(([shimModuleId, shimModuleRelPath]) => {
						const shimModulePath = path.join(node.path, shimModuleRelPath);
						log.verbose(`  Injecting module ${shimModuleId} with path ${shimModulePath}`);
						return {
							id: shimModuleId,
							version: node.version,
							path: shimModulePath
						};
					});
				});

				queue.push({
					nodes: Array.prototype.concat.apply([], shimmedNodes),
					parentProjectName,
				});
				return {
					skip: true
				};
			}

			let ui5Module = moduleCollection[node.id];
			if (!ui5Module) {
				log.verbose(`Creating module ${node.id}...`);
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

			const {project, extensions} = await ui5Module.getSpecifications();

			return {
				node,
				project,
				extensions
			};
		}));

		// Keep this out of the async map function to ensure
		// all projects and extensions are applied a deterministic order
		for (let i = 0; i < res.length; i++) {
			const {node, project, extensions, skip} = res[i];

			if (skip) {
				// Skip this node
				continue;
			}

			handleExtensions(extensions);

			if (project) {
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
						//	(in this case misleading) general verbose logging:
						//	"Ignoring project with missing configuration"
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
			}

			if (node.dependencies && !node.deduped) {
				queue.push({
					// copy array, so that the queue is stable while ignored project dependencies are removed
					nodes: [...node.dependencies],
					parentProjectName: project ? project.getName() : parentProjectName,
				});
			}
		}
	}

	// Appply dependency shims
	for (const [shimmedModuleId, moduleDepShims] of Object.entries(shimCollection.getAllDependencyShims())) {
		const sourceModule = moduleCollection[shimmedModuleId];

		for (let j = 0; j < moduleDepShims.length; j++) {
			const depShim = moduleDepShims[j];
			if (!sourceModule) {
				log.warn(`Could not apply dependency shim ${depShim.name} for ${shimmedModuleId}: ` +
					`Module ${shimmedModuleId} is unknown`);
				continue;
			}
			const {project: sourceProject} = await sourceModule.getSpecifications();
			if (!sourceProject) {
				log.warn(`Could not apply dependency shim ${depShim.name} for ${shimmedModuleId}: ` +
					`Source module ${shimmedModuleId} does not contain a project`);
				continue;
			}
			for (let k = 0; k < depShim.shim.length; k++) {
				const targetModuleId = depShim.shim[k];
				const targetModule = moduleCollection[targetModuleId];
				if (!targetModule) {
					log.warn(`Could not apply dependency shim ${depShim.name} for ${shimmedModuleId}: ` +
						`Target module $${depShim} is unknown`);
					continue;
				}
				const {project: targetProject} = await targetModule.getSpecifications();
				if (!targetProject) {
					log.warn(`Could not apply dependency shim ${depShim.name} for ${shimmedModuleId}: ` +
						`Target module ${targetModuleId} does not contain a project`);
					continue;
				}
				projectGraph.declareDependency(sourceProject.getName(), targetProject.getName());
			}
		}
	}

	return projectGraph;
};
