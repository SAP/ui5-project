const path = require("path");
const jsyaml = require("js-yaml");
const resourceFactory = require("@ui5/fs").resourceFactory;
const ProjectConfiguration = require("../configurations/ProjectConfiguration");

class Project {
	/**
	 * @param {object} parameters Project parameters
	 * @param {string} parameters.id Unique ID for the project
	 * @param {string} parameters.version Version of the project
	 * @param {string} parameters.modulePath File System path to access the projects resources
	 * @param {module:@ui5/project.configurations.ProjectConfiguration} parameters.configuration
	 * 						Configuration instance for the project
	 */
	constructor({id, version, modulePath, configuration}) {
		if (!id || !version || !modulePath || !configuration) {
			throw new Error(`Could not create Project: One or more required parameters are missing`);
		}

		if (!(configuration instanceof ProjectConfiguration)) {
			throw new Error(`Could not create project: 'configuration' must be an instance of ` +
				`@ui5/project.configurations.ProjectConfiguration`);
		}

		this._version = version;
		this._modulePath = modulePath;
		this._configuration = configuration;

		// Projects should be identified by their configured name
		// The ID property as supplied by the translators is only here for debugging and potential tracing purposes
		this.__id = id;
	}

	static getKind() {
		return "project";
	}

	/**
	* @private
	*/
	getName() {
		return this.getConfiguration().getName();
	}

	/**
	* @private
	*/
	getVersion() {
		return this._version;
	}

	/**
	* @private
	*/
	getPath() {
		return this._modulePath;
	}

	/**
	* Configuration
	*/
	getConfiguration() {
		return this._configuration;
	}

	/**
	* Resource Access
	*/

	async getRootReader() {
		return resourceFactory.createReader({
			fsBasePath: this.getPath(),
			virBasePath: "/",
			name: `Root reader for project ${this.getName()}`
		});
	}

	/**
	* General functions
	*/
	async validate() {

	}
}

module.exports = Project;
