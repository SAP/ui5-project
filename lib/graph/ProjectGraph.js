const log = require("@ui5/logger").getLogger("graph:ProjectGraph");
/**
* A rooted, directed graph representing a UI5 project that should be worked with and all its dependencies
*/
class ProjectGraph {
	/**
	 * @param {object} parameters Parameters
	 * @param {string} parameters.rootProjectName Root project name
	 * @param {Array.<module:@ui5/project.Extension>} parameters.extensions
	 * 													Final list of extensions to be used in this project tree
	 */
	constructor({rootProjectName, extensions = []}) {
		if (!rootProjectName) {
			throw new Error(`Could not create ProjectGraph: One or more required parameters are missing`);
		}
		this._rootProjectName = rootProjectName;
		this._extensions = Object.freeze(extensions);

		this._projects = {}; // maps project name to instance
		this._adjList = {}; // maps project name to edges/dependencies
	}

	getRoot() {
		const rootProject = this._projects[this._rootProjectName];
		if (!rootProject) {
			throw new Error(`Unable to find root project with name ${this._rootProjectName} in graph`);
		}
		return rootProject;
	}

	addProject(project, ignoreDuplicates) {
		const projectName = project.getName();
		if (this._projects[projectName]) {
			if (ignoreDuplicates) {
				return;
			}
			throw new Error(`Could not add duplicate project '${projectName}' to project tree`);
		}
		this._projects[projectName] = project;
		this._adjList[projectName] = [];
	}

	getProject(projectName) {
		return this._projects[projectName];
	}

	/**
	* Declare a dependency from one project in the graph to another
	*
	* @param {string} fromProjectName Name of the depending project
	* @param {string} toProjectName Name of project on which the other depends
	*/
	declareDependency(fromProjectName, toProjectName/* , optional*/) {
		if (!this._projects[fromProjectName]) {
			throw new Error(
				`Failed to declare dependency from project ${fromProjectName} to ${toProjectName}: ` +
				`Unable to find project with name ${fromProjectName} in graph`);
		}
		if (!this._projects[toProjectName]) {
			throw new Error(
				`Failed to declare dependency from project ${fromProjectName} to ${toProjectName}: ` +
				`Unable to find project with name ${toProjectName} in graph`);
		}
		if (this._adjList[fromProjectName][toProjectName]) {
			log.warn(`Dependency has already been declared: ${fromProjectName} depends on ${toProjectName}`);
		} else {
			log.verbose(`Declaring new dependency: ${fromProjectName} depends on ${toProjectName}`);
			this._adjList[fromProjectName][toProjectName] = {}; // maybe add optional information?
		}
	}

	/**
	* Visit every project in the graph that can be reached by the given entry project exactly once.
	* The entry project defaults to the root project.
	* In case a cycle is detected, an error is thrown
	*
	* @param {Function} callback
	*/
	async traverseBreadthFirst(callback) {
		// TODO: Add parameter to define point of entry, defaulting to root

		const queue = [{
			projectNames: [this._rootProjectName],
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
					const dependencies = Object.keys(this._adjList[projectName]);

					queue.push({
						projectNames: dependencies,
						predecessors: newPredecessors
					});

					await callback({
						project: this.getProject(projectName),
						getDependencies: () => {
							return dependencies.map(($) => this.getProject($.projectName));
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
	* @param {Function} callback
	*/
	async traverseDepthFirst(callback) {
		// TODO: Add parameter to define point of entry, defaulting to root
		return this._traverseDepthFirst(this._rootProjectName, {}, [], callback);
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
			const dependencies = Object.keys(this._adjList[projectName]);
			await Promise.all(dependencies.map((depName) => {
				return this._traverseDepthFirst(depName, visited, newPredecessors, callback);
			}));

			await callback({
				project: this.getProject(projectName),
				getDependencies: () => {
					return dependencies.map(($) => this.getProject($.projectName));
				}
			});
		})();
	}
}

module.exports = ProjectGraph;
