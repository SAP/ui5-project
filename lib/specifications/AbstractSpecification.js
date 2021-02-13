const Configuration = require("./Configuration");
const resourceFactory = require("@ui5/fs").resourceFactory;

class AbstractSpecification {
	/**
	 * @param {object} parameters Specification parameters
	 * @param {string} parameters.id Unique ID
	 * @param {string} parameters.version Version
	 * @param {string} parameters.modulePath File System path to access resources
	 * @param {module:@ui5/project.specifications.Configuration} parameters.configuration
	 * 						Configuration instance to use
	 */
	constructor({id, version, modulePath, configuration}) {
		if (new.target === AbstractSpecification) {
			throw new TypeError("Class 'AbstractSpecification' is abstract");
		}
		if (!id || !version || !modulePath || !configuration) {
			throw new Error(`Could not create Project: One or more required parameters are missing`);
		}

		if (!(configuration instanceof Configuration)) {
			throw new Error(`Could not create project: 'configuration' must be an instance of ` +
				`@ui5/project.specifications.Configuration`);
		}

		this._version = version;
		this._modulePath = modulePath;
		this._configuration = configuration;

		// The configured name (metadata.name) should be the unique identifier
		// The ID property as supplied by the translators is only here for debugging and potential tracing purposes
		this.__id = id;
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
	getName() {
		return this._getConfiguration().getName();
	}

	getKind() {
		return this._getConfiguration().getKind();
	}

	getType() {
		return this._getConfiguration().getType();
	}

	/**
	* @private
	*/
	getConfigurationObject() {
		return this._getConfiguration().getObject();
	}

	/**
	* @private
	*/
	_getConfiguration() {
		return this._configuration;
	}

	/**
	* Resource Access
	*/
	async getRootReader() {
		return resourceFactory.createReader({
			fsBasePath: this.getPath(),
			virBasePath: "/",
			name: `Root reader for ${this.getType()} ${this.getKind()} ${this.getName()}`
		});
	}

	/**
	* General functions
	*/
	async validate() {

	}
}

module.exports = AbstractSpecification;
