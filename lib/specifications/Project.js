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
	* @private
	*/
	getFrameworkName() {
		return this._config.framework?.name;
	}
	/**
	* @private
	*/
	getFrameworkVersion() {
		return this._config.framework?.version;
	}
	/**
	* @private
	*/
	getFrameworkDependencies() {
		return this._config.framework?.libraries || [];
	}

	isFrameworkProject() {
		return this.__id.startsWith("@openui5/") || this.__id.startsWith("@sapui5/");
	}

	getCustomConfiguration() {
		return this._config.customConfiguration;
	}

	getBuilderResourcesExcludes() {
		return this._config.builder?.resources?.excludes || [];
	}

	getCustomTasks() {
		return this._config.builder?.customTasks || [];
	}

	getCustomMiddleware() {
		return this._config.builder?.customMiddleware || [];
	}

	getServerSettings() {
		return this._config.server?.settings;
	}

	getBuilderSettings() {
		return this._config.builder?.settings;
	}

	getArchiveMetadata() {
		return this._config.customConfiguration?._archive;
	}

	/* === Resource Access === */
	/**
	 * Get a [ReaderCollection]{@link module:@ui5/fs.ReaderCollection} for accessing all resources of the
	 * project in the specified "style":
	 *
	 * <ul>
	 * <li><b>buildtime</b>: Resource paths are always prefixed with <code>/resources/</code>
	 *  or <code>/test-resources/</code> followed by the project's namespace</li>
	 * <li><b>runtime</b>: Access resources the same way the UI5 runtime would do</li>
	 * <li><b>flat:</b> No prefix, no namespace</li>
	 * </ul>
	 *
	 * @public
	 * @param {object} [options]
	 * @param {string} [options.style=buildtime] Path style to access resources. Can be "buildtime", "runtime" or "flat"
	 *											This parameter might be ignored by some project types
	 * @returns {module:@ui5/fs.ReaderCollection} Reader collection allowing access to all resources of the project
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
	* Get a [DuplexCollection]{@link module:@ui5/fs.DuplexCollection} for accessing and modifying a
	* project's resources. This is always of style <code>buildtime</code>.
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
