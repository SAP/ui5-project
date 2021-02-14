// const ProjectGraph = require("../ProjectGraph");
// const log = require("@ui5/logger").getLogger("graph:providers:npm");

/**
 * Graph provider for npm based projects
 *
 * @public
 * @namespace
 * @alias module:@ui5/project.graph.providers.npm
 */
module.exports = {
	/**
	 * Generates a project graph from npm modules
	 *
	 * @public
	 * @param {string} dirPath Project path
	 * @returns {Promise<object>} Promise resolving with a project graph
	 */
	createProjectGraph(dirPath) {
		// TODO: Make arborist happen
		// https://github.com/npm/arborist
	}
};
