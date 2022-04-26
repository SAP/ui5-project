const Specification = require("./Specification");

/**
 * Project
 *
 * @public
 * @memberof module:@ui5/project.specifications
 * @augments  module:@ui5/project.specifications.Specification
 */
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
	getNamespace() {
		// Default namespace for general Projects:
		// Their resources should be structured with globally unique paths, hence their namespace is undefined
		return null;
	}

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

	getBuilderSettings() {
		return this._config.builder && this._config.builder.settings;
	}

	/* === Resource Access === */
	/**
	* Get a resource reader for the sources of the project (excluding any test resources)
	*
	* @public
	 * @returns {module:@ui5/fs.ReaderCollection} Reader collection
	*/
	_getSourceReader() {
		throw new Error(`_getSourceReader must be implemented by subclass ${this.constructor.name}`);
	}

	/**
	* TODO
	*
	* @public
	* @returns {module:@ui5/fs.ReaderCollection} Reader collection
	*/
	_getSourceReaderFlat() {
		throw new Error(`_getSourceReaderFlat must be implemented by subclass ${this.constructor.name}`);
	}

	/**
	* TODO
	*
	* @public
	* @returns {module:@ui5/fs.ReaderCollection} Reader collection
	*/
	_getTestReaderFlat() {
		throw new Error(`_getTestReaderFlat must be implemented by subclass ${this.constructor.name}`);
	}

	_getDesignatedPath({namespace, isFlattable, isTestResources, isFramework}) {

	}

	/**
	* TODO
	*
	* @public
	* @returns {module:@ui5/fs.ReaderCollection} Reader collection
	*/
	getReader() {
		throw new Error(`getReader must be implemented by subclass ${this.constructor.name}`);
	}
	/**
	* TODO
	*
	* @public
	* @returns {module:@ui5/fs.DuplexCollection} DuplexCollection
	*/
	getWorkspace() {
		throw new Error(`getWorkspace must be implemented by subclass ${this.constructor.name}`);
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
