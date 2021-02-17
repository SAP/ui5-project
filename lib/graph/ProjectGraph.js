const log = require("@ui5/logger").getLogger("graph:ProjectGraph");
/**
 * A rooted, directed graph representing a UI5 project, its dependencies and available extensions
 *
 * @public
 * @memberof module:@ui5/project.graph
 */
class ProjectGraph {
	/**
	 * @public
	 * @param {object} parameters Parameters
	 * @param {string} parameters.rootProjectName Root project name
	 */
	constructor({rootProjectName}) {
		if (!rootProjectName) {
			throw new Error(`Could not create ProjectGraph: Missing or empty parameter 'rootProjectName'`);
		}
		this._rootProjectName = rootProjectName;

		this._projects = {}; // maps project name to instance
		this._adjList = {}; // maps project name to edges/dependencies

		this._extensions = {}; // maps extension name to instance

		this._sealed = false;
	}

	getRoot() {
		const rootProject = this._projects[this._rootProjectName];
		if (!rootProject) {
			throw new Error(`Unable to find root project with name ${this._rootProjectName} in graph`);
		}
		return rootProject;
	}

	/**
	 * @public
	 * @param {module:@ui5/project.specification.Project} project Project which should be added to the graph
	 * @param {boolean} [ignoreDuplicates=false] Whether an error should be thrown when a duplicate project is added
	 */
	addProject(project, ignoreDuplicates) {
		this._checkSealed();
		const projectName = project.getName();
		if (this._projects[projectName]) {
			if (ignoreDuplicates) {
				return;
			}
			throw new Error(
				`Failed to add project ${projectName} to graph: A project with that name has already been added`);
		}
		if (!isNaN(projectName)) {
			// Reject integer-like project names. They would take precedence when traversing object keys which
			// could lead to unexpected behavior. We don't really expect anyone to use such names anyways
			throw new Error(
				`Failed to add project ${projectName} to graph: Project name must not be integer-like`);
		}
		this._projects[projectName] = project;
		this._adjList[projectName] = {};
	}

	/**
	 * @public
	 * @param {string} projectName Name of the project to retrieve
	 * @returns {module:@ui5/project.specification.project|undefined}
	 *					project instance or undefined if the project is unknown to the graph
	 */
	getProject(projectName) {
		return this._projects[projectName];
	}

	/**
	 * @public
	 * @param {module:@ui5/project.specification.Extension} extension Extension which should be available in the graph
	 */
	addExtension(extension) {
		this._checkSealed();
		const extensionName = extension.getName();
		if (this._extensions[extensionName]) {
			throw new Error(
				`Failed to add extension ${extensionName} to graph: ` +
				`An extension with that name has already been added`);
		}
		if (!isNaN(extensionName)) {
			// Reject integer-like extension names. They would take precedence when traversing object keys which
			// might lead to unexpected behavior in the future. We don't really expect anyone to use such names anyways
			throw new Error(
				`Failed to add extension ${extensionName} to graph: Extension name must not be integer-like`);
		}
		this._extensions[extensionName] = extension;
	}

	/**
	 * @public
	 * @param {string} extensionName Name of the extension to retrieve
	 * @returns {module:@ui5/project.specification.Extension|undefined}
	 *					Extension instance or undefined if the extension is unknown to the graph
	 */
	getExtension(extensionName) {
		return this._extensions[extensionName];
	}

	getAllExtensions() {
		return this._extensions;
	}

	/**
	 * Declare a dependency from one project in the graph to another
	 *
	 * @public
	 * @param {string} fromProjectName Name of the depending project
	 * @param {string} toProjectName Name of project on which the other depends
	 */
	declareDependency(fromProjectName, toProjectName/* , optional*/) {
		this._checkSealed();
		if (!this._projects[fromProjectName]) {
			throw new Error(
				`Failed to declare dependency from project ${fromProjectName} to ${toProjectName}: ` +
				`Unable to find depending project with name ${fromProjectName} in graph`);
		}
		if (!this._projects[toProjectName]) {
			throw new Error(
				`Failed to declare dependency from project ${fromProjectName} to ${toProjectName}: ` +
				`Unable to find dependency project with name ${toProjectName} in graph`);
		}
		if (fromProjectName === toProjectName) {
			throw new Error(
				`Failed to declare dependency from project ${fromProjectName} to ${toProjectName}: ` +
				`A project can't depend on itself`);
		}
		if (this._adjList[fromProjectName][toProjectName]) {
			log.warn(`Dependency has already been declared: ${fromProjectName} depends on ${toProjectName}`);
		} else {
			log.verbose(`Declaring new dependency: ${fromProjectName} depends on ${toProjectName}`);
			this._adjList[fromProjectName][toProjectName] = {}; // maybe add optional information?
		}
	}

	getDependencies(projectName) {
		return Object.keys(this._adjList[projectName]);
	}

	/**
	 * Callback for graph traversal operations
	 *
	 * @public
	 * @async
	 * @callback module:@ui5/project.graph.ProjectGraph~traversalCallback
	 * @param {object} parameters Parameters passed to the callback
	 * @param {module:@ui5/project.specifications.Project} parameters.project The project that is currently visited
	 * @param {module:@ui5/project.graph.ProjectGraph~getDependencies} parameters.getDependencies
	 * 				Function to access the dependencies of the project that is currently visited.
	 * @returns {Promise} Must return a promise on which the graph traversal will wait
	 */

	/**
	 * Helper function available in the
	 * traversalCallback]{@link module:@ui5/project.graph.ProjectGraph~traversalCallback} to access the
	 * dependencies of the corresponding project in the current graph.
	 * <br><br>
	 * Note that transitive dependencies can't be accessed this way. Projects should rather add a direct
	 * dependency to projects they need access to.
	 *
	 * @public
	 * @function module:@ui5/project.graph.ProjectGraph~getDependencies
	 * @returns {Array.<module:@ui5/project.specifications.Project>} Direct dependencies of the visited project
	 */

	/**
	 * Visit every project in the graph that can be reached by the given entry project exactly once.
	 * The entry project defaults to the root project.
	 * In case a cycle is detected, an error is thrown
	 *
	 * @public
	 * @param {module:@ui5/project.graph.ProjectGraph~traversalCallback} callback Will be called
	 * @param {string} [startName] Name of the project to start the traversal at. Defaults to the graph's root project
	 */
	async traverseBreadthFirst(callback, startName = this._rootProjectName) {
		if (!this.getProject(startName)) {
			throw new Error(`Failed to start graph traversal: Could not find project ${startName} in graph`);
		}

		const queue = [{
			projectNames: [startName],
			predecessors: []
		}];

		const visited = {};

		while (queue.length) {
			const {projectNames, predecessors} = queue.shift(); // Get and remove first entry from queue

			await Promise.all(projectNames.map(async (projectName) => {
				if (predecessors.includes(projectName)) {
					// We start to run in circles. That's neither expected nor something we can deal with

					// Mark first and last occurrence in chain with an asterisk
					predecessors[predecessors.indexOf(projectName)] = `${projectName}*`;
					throw new Error(
						`Detected cyclic dependency chain: ${predecessors.join(" -> ")} -> ${projectName}*`);
				}
				if (visited[projectName]) {
					return visited[projectName];
				}

				return visited[projectName] = (async () => {
					const newPredecessors = [...predecessors, projectName];
					const dependencies = this.getDependencies(projectName);

					queue.push({
						projectNames: dependencies,
						predecessors: newPredecessors
					});

					await callback({
						project: this.getProject(projectName),
						getDependencies: () => {
							return dependencies.map(($) => this.getProject($));
						}
					});
				})();
			}));
		}
	}

	/**
	 * Visit every project in the graph that can be reached by the given entry project exactly once.
	 * The entry project defaults to the root project.
	 * In case a cycle is detected, an error is thrown
	 *
	 * @public
	 * @param {module:@ui5/project.graph.ProjectGraph~traversalCallback} callback Will be called
	 * @param {string} [startName] Name of the project to start the traversal at. Defaults to the graph's root project
	 */
	async traverseDepthFirst(callback, startName = this._rootProjectName) {
		if (!this.getProject(startName)) {
			throw new Error(`Failed to start graph traversal: Could not find project ${startName} in graph`);
		}
		return this._traverseDepthFirst(startName, {}, [], callback);
	}

	async _traverseDepthFirst(projectName, visited, predecessors, callback) {
		if (predecessors.includes(projectName)) {
			// We start to run in circles. That's neither expected nor something we can deal with

			// Mark first and last occurrence in chain with an asterisk
			predecessors[predecessors.indexOf(projectName)] = `${projectName}*`;
			throw new Error(
				`Detected cyclic dependency chain: ${predecessors.join(" -> ")} -> ${projectName}*`);
		}
		if (visited[projectName]) {
			return visited[projectName];
		}
		return visited[projectName] = (async () => {
			const newPredecessors = [...predecessors, projectName];
			const dependencies = this.getDependencies(projectName);
			await Promise.all(dependencies.map((depName) => {
				return this._traverseDepthFirst(depName, visited, newPredecessors, callback);
			}));

			await callback({
				project: this.getProject(projectName),
				getDependencies: () => {
					return dependencies.map(($) => this.getProject($));
				}
			});
		})();
	}

	/**
	 * Join another project graph into this one.
	 * Projects and extensions which already exist in this graph will cause an error to be thrown
	 *
	 * @public
	 * @param {module:@ui5/project.graph.ProjectGraph} projectGraph Project Graph to merge into this one
	 */
	join(projectGraph) {
		try {
			this._checkSealed();
			mergeMap(this._projects, projectGraph._projects);
			mergeMap(this._adjList, projectGraph._adjList);
			mergeMap(this._extensions, projectGraph._extensions);
		} catch (err) {
			throw new Error(
				`Failed to join project graph with root project ${projectGraph._rootProjectName} into ` +
				`project graph with root project ${this._rootProjectName}: ${err.message}`);
		}
	}

	/**
	 * Seal the project graph so that no further changes can be made to it
	 *
	 * @public
	 */
	seal() {
		this._sealed = true;
	}

	/**
	 * Helper function to check and throw in case the project graph has been sealed.
	 * Intended for use in any function that attempts to make changes to the graph.
	 *
	 * @throws Throws in case the project graph has been sealed
	 */
	_checkSealed() {
		if (this._sealed) {
			throw new Error(`Project graph with root node ${this._rootProjectName} has been sealed`);
		}
	}
}

function mergeMap(target, source) {
	for (const [key, value] of Object.entries(source)) {
		if (target[key]) {
			throw new Error(`Failed to merge map: Key '${key}' already present in target set`);
		}
		target[key] = value;
	}
}

module.exports = ProjectGraph;
