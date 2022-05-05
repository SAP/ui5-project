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

		this._resourceTagCollection = null;
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

	getArchiveMetadata() {
		return this._config.customConfiguration?._archive;
	}

	/* === Resource Access === */
	/**
	 * TODO
	 *
	 * @public
	 * @param {object} [options]
	 * @param {string} [options.style=buildtime] Path style to access resources. Can be "buildtime", "runtime" or "flat"
	 * 												TODO: describe styles
	 *											This parameter might be ignored by some specifications
	 * @returns {module:@ui5/fs.ReaderCollection} Reader collection
	 */
	getReader(options) {
		throw new Error(`getReader must be implemented by subclass ${this.constructor.name}`);
	}

	getResourceTagCollection() {
		if (!this._resourceTagCollection) {
			const ResourceTagCollection = require("@ui5/fs").ResourceTagCollection;
			this._resourceTagCollection = new ResourceTagCollection({
				allowedTags: ["ui5:IsDebugVariant", "ui5:HasDebugVariant"],
				allowedNamespaces: ["project"],
				tags: this.getArchiveMetadata()?.tags
			});
		}
		return this._resourceTagCollection;
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
