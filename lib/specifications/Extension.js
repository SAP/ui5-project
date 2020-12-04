const path = require("path");
const jsyaml = require("js-yaml");
const resourceFactory = require("@ui5/fs").resourceFactory;
const ExtensionConfiguration = require("../configurations/ExtensionConfiguration");

class Extension {
	/**
	 * @param {object} parameters Extension parameters
	 * @param {string} parameters.id Unique ID for the extension
	 * @param {string} parameters.version Version of the extension
	 * @param {string} parameters.modulePath File System path to access the extensions resources
	 * @param {module:@ui5/project.configurations.ExtensionConfiguration} parameters.configuration
	 * 						Configuration instance for the extension
	 */
	constructor({id, version, modulePath, configuration}) {
		if (!id || !version || !modulePath || !configuration) {
			throw new Error(`Could not create Extension: One or more required parameters are missing`);
		}

		if (!(configuration instanceof ExtensionConfiguration)) {
			throw new Error(`Could not create extension: 'configuration' must be an instance of ` +
				`@ui5/project.configurations.ExtensionConfiguration`);
		}

		this._version = version;
		this._modulePath = modulePath;
		this._configuration = configuration;

		// Extensions should be identified by their configured name
		// The ID property as supplied by the translators is only here for debugging and potential tracing purposes
		this.__id = id;
	}

	static getKind() {
		return "extension";
	}

	/**
	* Extension Metadata
	*/
	getName() {
		const config = this.getConfiguration();
		return config.getName();
	}

	getNamespace() {
		const config = this.getConfiguration();
		return config.getNamespace();
	}

	getSpecVersion() {

	}

	getType() {
		const config = this.getConfiguration();
		return config.getType();
	}

	/**
	* @private
	*/
	getVersion() {
		return this._version;
	}

	/**
	* Configuration
	*/
	getConfiguration() {
		return this._configuration;
	}

	/**
	* @private
	*/
	getPath() {
		return this._modulePath;
	}
}

module.exports = Extension;
