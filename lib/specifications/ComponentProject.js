const {promisify} = require("util");
const Project = require("./Project");

/*
* Private configuration class for use in Module and specifications
*/

class ComponentProject extends Project {
	constructor(parameters) {
		super(parameters);
		if (new.target === ComponentProject) {
			throw new TypeError("Class 'ComponentProject' is abstract. Please use one of the 'types' subclasses");
		}

		this._pPom = null;

		this._namespace = null;
	}

	/* === Attributes === */
	/**
	* @public
	*/
	getNamespace() {
		return this._namespace;
	}

	/**
	* @public
	*/
	getCopyright() {
		return this._config.metadata.copyright;
	}

	/**
	* @public
	*/
	getComponentPreloadPaths() {
		return this._config.builder && this._config.builder.componentPreload &&
			this._config.builder.componentPreload.paths || [];
	}

	/**
	* @public
	*/
	getComponentPreloadNamespaces() {
		return this._config.builder && this._config.builder.componentPreload &&
			this._config.builder.componentPreload.namespaces || [];
	}

	getJsdocExcludes() {
		return this._config.builder && this._config.builder.jsdoc && this._config.builder.jsdoc.excludes || [];
	}

	/**
	* @public
	*/
	getBundles() {
		return this._config.builder && this._config.builder.bundles || [];
	}

	/* === Internals === */
	/**
	 * @private
	 * @param {object} config Configuration object
	*/
	async _parseConfiguration(config) {
		await super._parseConfiguration(config);

		this._namespace = await this._getNamespace();
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
			const pom = await this.getPom();
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
					`"${parts[1]}" of pom.xml of project ${this._project.metadata.name}`);
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
