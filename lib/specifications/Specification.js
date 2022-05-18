const resourceFactory = require("@ui5/fs").resourceFactory;

class Specification {
	constructor() {
		if (new.target === Specification) {
			throw new TypeError("Class 'Specification' is abstract. Please use one of the 'types' subclasses");
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

		const config = JSON.parse(JSON.stringify(configuration));

		// Deep clone config to prevent changes by reference
		const {validate} = require("../validation/validator");
		await validate({
			config,
			project: {
				id
			}
		});

		// Check whether the given configuration matches the class by guessing the type name from the class name
		if (config.type.replace("-", "") !== this.constructor.name.toLowerCase()) {
			throw new Error(
				`Configuration missmatch: Supplied configuration of type '${config.type}' does not match with ` +
				`specification class ${this.constructor.name}`);
		}

		if (!id.startsWith("@openui5/") && !id.startsWith("@sapui5/")) {
			if (config.specVersion === "0.1" || config.specVersion === "1.0" ||
				config.specVersion === "1.1") {
				throw new Error(
					`Unsupported specification version ${config.specVersion} defined for ` +
					`${config.kind} ${config.metadata.name}. The new Specification API can only be ` +
					`used with specification versions >= 2.0. For details see https://sap.github.io/ui5-tooling/pages/Configuration/#specification-versions`);
			}
			if (config.specVersion !== "2.0" &&
				config.specVersion !== "2.1" && config.specVersion !== "2.2" &&
				config.specVersion !== "2.3") {
				throw new Error(
					`Unsupported specification version ${config.specVersion} defined in ${config.kind} ` +
					`${config.metadata.name}. Your UI5 CLI installation might be outdated. ` +
					`For details see https://sap.github.io/ui5-tooling/pages/Configuration/#specification-versions`);
			}
		}

		this._name = config.metadata.name;
		this._kind = config.kind;
		this._type = config.type;
		this._specVersion = config.specVersion;

		await this._configureAndValidatePaths(config);
		await this._parseConfiguration(config);
		this._config = config;
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
	* Might not be POSIX
	*
	* @private
	*/
	getPath() {
		return this._modulePath;
	}

	/* === Resource Access === */
	/**
	* Get a resource reader for the root directory of the project
	*
	* @public
	* @returns {module:@ui5/fs.ReaderCollection} Reader collection
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
	async _configureAndValidatePaths(config) {}

	/**
	 * @private
	 * @param {object} config Configuration object
	*/
	async _parseConfiguration(config) {}

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

	static async create(params) {
		if (!params.configuration) {
			throw new Error(
				`Unable to create Specification instance: Missing configuration parameter`);
		}
		const {kind, type} = params.configuration;
		if (!["project", "extension"].includes(kind)) {
			throw new Error(`Unable to create Specification instance: Unknown kind '${kind}'`);
		}

		switch (type) {
		case "application": {
			return createAndInitializeSpec("Application", params);
		}
		case "library": {
			return createAndInitializeSpec("Library", params);
		}
		case "theme-library": {
			return createAndInitializeSpec("ThemeLibrary", params);
		}
		case "module": {
			return createAndInitializeSpec("Module", params);
		}
		case "task": {
			return createAndInitializeSpec("Task", params);
		}
		case "server-middleware": {
			return createAndInitializeSpec("ServerMiddleware", params);
		}
		case "project-shim": {
			return createAndInitializeSpec("ProjectShim", params);
		}
		default:
			throw new Error(
				`Unable to create Specification instance: Unknown specification type '${type}'`);
		}
	}
}

function createAndInitializeSpec(moduleName, params) {
	const Spec = require(`./types/${moduleName}`);
	return new Spec().init(params);
}

module.exports = Specification;
