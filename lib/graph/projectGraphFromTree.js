const Module = require("../Module");
const ProjectGraph = require("./ProjectGraph");
const ShimCollection = require("./ShimCollection");

module.exports = async function(tree) {
	const shimCollection = new ShimCollection();

	function addShimsToCollection(ext) {
		ext.forEach((e) => {
			if (e.getType() === "project-shim") {
				shimCollection.addShim(e);
			}
		});
	}

	const rootModule = new Module({
		id: tree.id,
		version: tree.version,
		modulePath: tree.path
	});
	const rootProject = await rootModule.getProject();
	const rootProjectName = rootProject.getName();

	const extensions = await rootModule.getExtensions();
	addShimsToCollection(extensions);

	const projectGraph = new ProjectGraph({
		rootProjectName: rootProjectName
	});
	projectGraph.addProject(rootProject);

	const queue = [{
		nodes: tree.dependencies,
		parentProjectName: rootProjectName
	}];

	// Breadth-first search
	while (queue.length) {
		const {nodes, parentProjectName} = queue.shift(); // Get and remove first entry from queue
		const res = await Promise.all(nodes.map(async (node) => {
			const ui5Module = new Module({
				id: node.id,
				version: node.version,
				modulePath: node.path,
				shimCollection
			});

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

			if (!node.deduped) {
				projectGraph.addProject(project, true);
			}

			const projectName = project.getName();
			if (parentProjectName) {
				projectGraph.declareDependency(parentProjectName, projectName);
			}

			queue.push({
				// copy array, so that the queue is stable while ignored project dependencies are removed
				nodes: [...node.dependencies],
				parentProjectName: projectName,
			});
		}
	}

	return projectGraph;
};
