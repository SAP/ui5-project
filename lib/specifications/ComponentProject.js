const {promisify} = require("util");
const Project = require("./Project");
const resourceFactory = require("@ui5/fs").resourceFactory;

/*
* Subclass for projects potentially containing Components
*/

class ComponentProject extends Project {
	constructor(parameters) {
		super(parameters);
		if (new.target === ComponentProject) {
			throw new TypeError("Class 'ComponentProject' is abstract. Please use one of the 'types' subclasses");
		}

		this._pPom = null;
		this._namespace = null;
		this._isRuntimeNamespaced = true;
	}

	/* === Attributes === */
	/**
	* @public
	*/
	getNamespace() {
		return this._namespace;
	}

	/**
	* @private
	*/
	getCopyright() {
		return this._config.metadata.copyright;
	}

	/**
	* @private
	*/
	getComponentPreloadPaths() {
		return this._config.builder && this._config.builder.componentPreload &&
			this._config.builder.componentPreload.paths || [];
	}

	/**
	* @private
	*/
	getComponentPreloadNamespaces() {
		return this._config.builder && this._config.builder.componentPreload &&
			this._config.builder.componentPreload.namespaces || [];
	}

	/**
	* @private
	*/
	getComponentPreloadExcludes() {
		return this._config.builder && this._config.builder.componentPreload &&
			this._config.builder.componentPreload.excludes || [];
	}

	/**
	* @private
	*/
	getJsdocExcludes() {
		return this._config.builder && this._config.builder.jsdoc && this._config.builder.jsdoc.excludes || [];
	}

	/**
	* @private
	*/
	getMinificationExcludes() {
		return this._config.builder && this._config.builder.minification &&
			this._config.builder.minification.excludes || [];
	}

	/**
	* @private
	*/
	getBundles() {
		return this._config.builder && this._config.builder.bundles || [];
	}

	/**
	* @private
	*/
	getPropertiesFileSourceEncoding() {
		return this._config.resources && this._config.resources.configuration &&
			this._config.resources.configuration.propertiesFileSourceEncoding || "UTF-8";
	}

	/* === Resource Access === */

	/**
	 * Get a resource reader for accessing the project resources in a given style.
	 * If project resources have been changed through the means of a workspace, those changes
	 * are reflected in the provided reader too.
	 *
	 * @public
	 * @param {object} [options]
	 * @param {string} [options.style=buildtime] Path style to access resources. Can be "buildtime", "runtime" or "flat"
	 * 												TODO: describe styles
	 * @returns {module:@ui5/fs.ReaderCollection} A reader collection instance
	 */
	getReader({style = "buildtime"} = {}) {
		// TODO: Additional parameter 'includeWorkspace' to include reader to relevant Memory Adapter?
		// TODO: Additional style 'ABAP' using "sap.platform.abap".uri from manifest.json?
		let reader;
		let testReader;
		switch (style) {
		case "buildtime":
			reader = this._getFlatSourceReader(`/resources/${this._namespace}/`);
			testReader = this._getFlatTestReader(`/test-resources/${this._namespace}/`);
			if (testReader) {
				reader = resourceFactory.createReaderCollection({
					name: `Reader collection for project ${this.getName()}`,
					readers: [reader, testReader]
				});
			}
			break;
		case "runtime":
			if (this._isRuntimeNamespaced) {
				// Same as buildtime
				return this.getReader();
			}
			reader = this._getFlatSourceReader("/");
			break;
		case "flat":
			reader = this._getFlatSourceReader("/");
			break;
		default:
			throw new Error(`Unknown path mapping style ${style}`);
		}

		reader = this._addWriter(reader, style);
		return reader;
	}

	/**
	* Get a resource reader for the sources of the project (not including any test resources)
	*
	 * @returns {module:@ui5/fs.ReaderCollection} Reader collection
	*/
	_getFullSourceReader() {
		throw new Error(`_getFullSourceReader must be implemented by subclass ${this.constructor.name}`);
	}

	/**
	* TODO
	*
	* @returns {module:@ui5/fs.ReaderCollection} Reader collection
	*/
	_getFlatSourceReader() {
		throw new Error(`_getFlatSourceReader must be implemented by subclass ${this.constructor.name}`);
	}

	/**
	* Get a resource reader for the test-sources of the project
	*
	 * @returns {module:@ui5/fs.ReaderCollection} Reader collection
	*/
	_getFullTestReader() {
		throw new Error(`_getFullTestReader must be implemented by subclass ${this.constructor.name}`);
	}
	/**
	* TODO
	*
	* @returns {module:@ui5/fs.ReaderCollection} Reader collection
	*/
	_getFlatTestReader() {
		throw new Error(`_getFlatTestReader must be implemented by subclass ${this.constructor.name}`);
	}

	/**
	 * Get a resource reader/writer for accessing and modifying a project's resources
	 *
	 * @public
	 * @returns {module:@ui5/fs.ReaderCollection} A reader collection instance
	 */
	getWorkspace() {
		// Workspace is always of style "buildtime"
		const reader = this.getReader({
			style: "buildtime"
		});

		const writer = this._getWriter();
		return resourceFactory.createWorkspace({
			reader,
			writer
		});
	}

	_getWriter() {
		if (!this._writer) {
			// writer is always of style "buildtime"
			this._writer = resourceFactory.createAdapter({
				virBasePath: "/",
				project: this
			});
		}
		return this._writer;
	}

	_addWriter(reader, style = "buildtime") {
		let writer = this._getWriter();
		switch (style) {
		case "buildtime": {
			// Writer already uses buildtime style
			break;
		}
		case "runtime": {
			if (this._isRuntimeNamespaced) {
				// Same as buildtime
				return this._addWriter(reader);
			}

			// Rewrite paths from "runtime" to "buildtime"
			writer = writer.link({
				linkPath: `/`,
				targetPath: `/resources/${this._namespace}/`
			});
			break;
		}
		case "flat": {
			// Rewrite paths from "flat" to "buildtime"
			writer = writer.link({
				linkPath: `/`,
				targetPath: `/resources/${this._namespace}/`
			});
			break;
		}
		default:
			throw new Error(`Unknown path mapping style ${style}`);
		}

		return resourceFactory.createReaderCollectionPrioritized({
			name: `Reader/Writer collection for project ${this.getName()}`,
			readers: [writer, reader]
		});
	}

	/* === Internals === */
	/**
	 * @private
	 * @param {object} config Configuration object
	*/
	async _parseConfiguration(config) {
		await super._parseConfiguration(config);
	}

	async _getNamespace() {
		throw new Error(`_getNamespace must be implemented by subclass ${this.constructor.name}`);
	}

	/* === Helper === */
	/**
	 * Checks whether a given string contains a maven placeholder.
	 * E.g. <code>${appId}</code>.
	 *
	 * @param {string} value String to check
	 * @returns {boolean} True if given string contains a maven placeholder
	 */
	_hasMavenPlaceholder(value) {
		return !!value.match(/^\$\{(.*)\}$/);
	}

	/**
	 * Resolves a maven placeholder in a given string using the projects pom.xml
	 *
	 * @param {string} value String containing a maven placeholder
	 * @returns {Promise<string>} Resolved string
	 */
	async _resolveMavenPlaceholder(value) {
		const parts = value && value.match(/^\$\{(.*)\}$/);
		if (parts) {
			this._log.verbose(
				`"${value} contains a maven placeholder "${parts[1]}". Resolving from projects pom.xml...`);
			const pom = await this._getPom();
			let mvnValue;
			if (pom.project && pom.project.properties && pom.project.properties[parts[1]]) {
				mvnValue = pom.project.properties[parts[1]];
			} else {
				let obj = pom;
				parts[1].split(".").forEach((part) => {
					obj = obj && obj[part];
				});
				mvnValue = obj;
			}
			if (!mvnValue) {
				throw new Error(`"${value}" couldn't be resolved from maven property ` +
					`"${parts[1]}" of pom.xml of project ${this.getName()}`);
			}
			return mvnValue;
		} else {
			throw new Error(`"${value}" is not a maven placeholder`);
		}
	}

	/**
	 * Reads the projects pom.xml file
	 *
	 * @returns {Promise<object>} Resolves with a JSON representation of the content
	 */
	async _getPom() {
		if (this._pPom) {
			return this._pPom;
		}

		return this._pPom = this.getRootReader().byPath("/pom.xml")
			.then(async (resource) => {
				if (!resource) {
					throw new Error(
						`Could not find pom.xml in project ${this.getName()}`);
				}
				const content = await resource.getString();
				const xml2js = require("xml2js");
				const parser = new xml2js.Parser({
					explicitArray: false,
					ignoreAttrs: true
				});
				const readXML = promisify(parser.parseString);
				return readXML(content);
			}).catch((err) => {
				throw new Error(
					`Failed to read pom.xml for project ${this.getName()}: ${err.message}`);
			});
	}
}

module.exports = ComponentProject;
