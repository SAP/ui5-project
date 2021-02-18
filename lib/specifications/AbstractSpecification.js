const resourceFactory = require("@ui5/fs").resourceFactory;

class AbstractSpecification {
	constructor() {
		if (new.target === AbstractSpecification) {
			throw new TypeError("Class 'AbstractSpecification' is abstract");
		}
		this._log = require("@ui5/logger").getLogger(`specifications:types:${this.constructor.name}`);
	}

	/**
	 * @param {object} parameters Specification parameters
	 * @param {string} parameters.id Unique ID
	 * @param {string} parameters.version Version
	 * @param {string} parameters.modulePath File System path to access resources
	 * @param {object} parameters.configuration Configuration object
	 */
	async init({id, version, modulePath, configuration}) {
		if (!id) {
			throw new Error(`Could not create specification: Missing or empty parameter 'id'`);
		}
		if (!version) {
			throw new Error(`Could not create specification: Missing or empty parameter 'version'`);
		}
		if (!modulePath) {
			throw new Error(`Could not create specification: Missing or empty parameter 'modulePath'`);
		}
		if (!configuration) {
			throw new Error(`Could not create specification: Missing or empty parameter 'configuration'`);
		}

		this._version = version;
		this._modulePath = modulePath;

		// The configured name (metadata.name) should be the unique identifier
		// The ID property as supplied by the translators is only here for debugging and potential tracing purposes
		this.__id = id;

		const {validate} = require("../validation/validator");
		await validate({
			config: configuration,
			project: {
				id
			}
		});

		if (!id.startsWith("@openui5/") && !id.startsWith("@sapui5/")) {
			if (configuration.specVersion === "0.1" || configuration.specVersion === "1.0" ||
				configuration.specVersion === "1.1") {
				throw new Error(
					`Unsupported specification version ${configuration.specVersion} defined for ` +
					`${configuration.kind} ${configuration.metadata.name}. The new Specification API can only be ` +
					`used with specification versions >= 2.0. For details see https://sap.github.io/ui5-tooling/pages/Configuration/#specification-versions`);
			}
			if (configuration.specVersion !== "2.0" &&
				configuration.specVersion !== "2.1" && configuration.specVersion !== "2.2" &&
				configuration.specVersion !== "2.3") {
				throw new Error(
					`Unsupported specification version ${configuration.specVersion} defined in ${configuration.kind} ` +
					`${configuration.metadata.name}. Your UI5 CLI installation might be outdated. ` +
					`For details see https://sap.github.io/ui5-tooling/pages/Configuration/#specification-versions`);
			}
		}

		await this._parseConfiguration(configuration);
		await this._validate();
		return this;
	}

	/* === Attributes === */
	/**
	* @public
	*/
	getName() {
		return this._name;
	}

	/**
	* @public
	*/
	getKind() {
		return this._kind;
	}

	/**
	* @public
	*/
	getType() {
		return this._type;
	}

	/**
	* @public
	*/
	getSpecVersion() {
		return this._specVersion;
	}

	/**
	* @public
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

	/* === Resource Access === */
	/**
	* @public
	*/
	getRootReader() {
		return resourceFactory.createReader({
			fsBasePath: this.getPath(),
			virBasePath: "/",
			name: `Root reader for ${this.getType()} ${this.getKind()} ${this.getName()}`
		});
	}

	/* === Internals === */
	/**
	 * @private
	 * @param {object} config Configuration object
	*/
	async _parseConfiguration(config) {
		this._name = config.metadata.name;
		this._kind = config.kind;
		this._type = config.type;
		this._specVersion = config.specVersion;
	}

	async _validate() {}

	/* === Helper === */
	/**
	 * @private
	 * @param {string} dirPath Path of directory, relative to the project root
	*/
	async _dirExists(dirPath) {
		if (await this.getRootReader().byPath(dirPath, {nodir: false})) {
			return true;
		}
		return false;
	}
}

module.exports = AbstractSpecification;
