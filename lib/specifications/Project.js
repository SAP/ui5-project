const Specification = require("./Specification");

class Project extends Specification {
	constructor(parameters) {
		super(parameters);
		if (new.target === Project) {
			throw new TypeError("Class 'Project' is abstract. Please use one of the 'types' subclasses");
		}
	}

	/* === Attributes === */
	/**
	* @public
	*/
	getFrameworkName() {
		return this._config.framework && this._config.framework.name;
	}
	/**
	* @public
	*/
	getFrameworkVersion() {
		return this._config.framework && this._config.framework.version;
	}
	/**
	* @public
	*/
	getFrameworkDependencies() {
		// TODO: Clone or freeze object before exposing?
		return this._config.framework && this._config.framework.libraries || [];
	}

	isFrameworkProject() {
		return this.__id.startsWith("@openui5/") || this.__id.startsWith("@sapui5/");
	}

	getCustomConfiguration() {
		return this._config.customConfiguration;
	}

	getBuilderResourceExcludes() {
		return this._config.builder && this._config.builder.resources && this._config.builder.resources.excludes || [];
	}

	getCustomTasks() {
		return this._config.builder && this._config.builder.customTasks || [];
	}

	getServerSettings() {
		return this._config.server && this._config.server.settings;
	}

	/* === Resource Access === */
	/**
	* Get a resource reader for the sources of the project (excluding any test resources)
	*
	* @public
	 * @returns {module:@ui5/fs.ReaderCollection} Reader collection
	*/
	getSourceReader() {
		throw new Error(`getSourceReader must be implemented by subclass ${this.constructor.name}`);
	}

	/**
	* Get a resource reader for accessing the project resources the same way the UI5 runtime would do
	*
	* @public
	* @returns {module:@ui5/fs.ReaderCollection} Reader collection
	*/
	getRuntimeReader() {
		throw new Error(`getRuntimeReader must be implemented by subclass ${this.constructor.name}`);
	}

	/**
	* Get a resource reader for accessing the project resources during the build process
	*
	* @public
	* @returns {module:@ui5/fs.ReaderCollection} Reader collection
	*/
	getBuildtimeReader() {
		throw new Error(`getBuildtimeReader must be implemented by subclass ${this.constructor.name}`);
	}

	/* === Internals === */
	/**
	 * @private
	 * @param {object} config Configuration object
	*/
	async _parseConfiguration(config) {
		await super._parseConfiguration(config);
	}

	async _validate() {
		await super._validate();
		if (this.getKind() !== "project") {
			throw new Error(
				`Configuration missmatch: Supplied configuration must be of kind 'project' but ` +
				`is of kind '${this.getKind()}'`);
		}
	}
}

module.exports = Project;
