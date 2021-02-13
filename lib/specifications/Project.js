const AbstractSpecification = require("./AbstractSpecification");

class Project extends AbstractSpecification {
	/**
	 * @param {object} parameters Project parameters
	 * @param {string} parameters.id Unique ID for the project
	 * @param {string} parameters.version Version of the project
	 * @param {string} parameters.modulePath File System path to access the projects resources
	 * @param {module:@ui5/project.specifications.Configuration} parameters.configuration
	 * 						Configuration instance for the project
	 */
	constructor(parameters) {
		super(parameters);
		if (this.getKind() !== "project") {
			throw new Error(`Could not create project: Supplied configuration must be of kind project but is ` +
				this.getKind());
		}
	}

	/*
	* TODO: Expose project specific APIs
	*/
}

module.exports = Project;
