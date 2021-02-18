const AbstractSpecification = require("./AbstractSpecification");

class Project extends AbstractSpecification {
	constructor(parameters) {
		super(parameters);
		if (new.target === Project) {
			throw new TypeError("Class 'Project' is abstract");
		}
		this._frameworkName = null;
		this._frameworkVersion = null;
		this._frameworkDependencies = null;
	}

	/* === Attributes === */
	/**
	* @public
	*/
	getFrameworkName() {
		return this._frameworkName;
	}
	/**
	* @public
	*/
	getFrameworkVersion() {
		return this._frameworkVersion;
	}
	/**
	* @public
	*/
	getFrameworkDependencies() {
		// TODO: Clone or freeze object before exposing?
		return this._frameworkDependencies || [];
	}

	isFrameworkProject() {
		return this.__id.startsWith("@openui5/") || this.__id.startsWith("@sapui5/");
	}

	/* === Internals === */
	/**
	 * @private
	 * @param {object} config Configuration object
	*/
	async _parseConfiguration(config) {
		await super._parseConfiguration(config);

		if (config.framework) {
			if (config.framework.name) {
				this._frameworkName = config.framework.name;
			}
			if (config.framework.version) {
				this._frameworkVersion = config.framework.version;
			}
			if (config.framework.libraries) {
				this._frameworkDependencies = JSON.parse(JSON.stringify(config.framework.libraries));
			}
		}
	}

	async _validate() {
		await super._validate();
		if (this.getKind() !== "project") {
			throw new Error(
				`Configuration missmatch: Supplied configuration must be of kind 'project' but ` +
				`is of kind '${this.getKind()}'`);
		}
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
		const fsPath = path.join(this._project.path, "pom.xml");
		return this._pPom = readFile(fsPath).then(async (content) => {
			const xml2js = require("xml2js");
			const parser = new xml2js.Parser({
				explicitArray: false,
				ignoreAttrs: true
			});
			const readXML = promisify(parser.parseString);
			return readXML(content);
		}).catch((err) => {
			throw new Error(
				`Failed to read pom.xml for project ${this._project.metadata.name}: ${err.message}`);
		});
	}
}

module.exports = Project;
