const path = require("path");
const resourceFactory = require("@ui5/fs").resourceFactory;
const Project = require("../Project");

/*
* Private configuration class for use in Module and specifications
*/

class Application extends Project {
	constructor(parameters) {
		super(parameters);

		this._pManifests = {};
		this._webappPath = "webapp";
		this._propertiesFilesSourceEncoding = "UTF-8";
	}

	/* === Attributes === */
	/**
	* @public
	*/
	getPropertiesFileSourceEncoding() {
		return this._propertiesFilesSourceEncoding;
	}

	getNamespace() {
		return this._namespace;
	}

	/* === Resource Access === */
	/**
	* @public
	*/
	getRuntimeReader() {
		return resourceFactory.createReader({
			fsBasePath: path.join(this.getPath(), this._webappPath),
			virBasePath: "/", // Applications are served at "/"
			name: `Source reader for ${this.getType()} ${this.getKind()} ${this.getName()}`
		});
	}

	/**
	* @public
	*/
	getBuildtimeReader() {
		return resourceFactory.createReader({
			fsBasePath: path.join(this.getPath(), this._webappPath),
			virBasePath: `/resources/${this.getNamespace()}/`,
			name: `Source reader for ${this.getType()} ${this.getKind()} ${this.getName()}`
		});
	}

	/* === Internals === */
	/**
	 * @private
	 * @param {object} config Configuration object
	*/
	async _parseConfiguration(config) {
		await super._parseConfiguration(config);

		if (config.resources && config.resources.configuration) {
			if (config.resources.configuration.paths &&
				config.resources.configuration.paths.webapp) {
				// "webapp" path mapping
				this._webappPath = config.resources.configuration.paths.webapp;
			}
			if (config.resources.configuration.propertiesFileSourceEncoding) {
				// .properties files encoding
				this._propertiesFilesSourceEncoding = config.resources.configuration.propertiesFileSourceEncoding;
			}
		}

		this._namespace = await this._getNamespace();
	}


	async _validate() {
		await super._validate();
		if (this.getType() !== "application") {
			throw new Error(
				`Configuration missmatch: Supplied configuration must be of type 'application' but ` +
				`is of type '${this.getType()}'`);
		}
		if (!await this._dirExists("/" + this._webappPath)) {
			throw new Error(
				`Unable to find directory '${this._webappPath}' in application project ${this.getName()}`);
		}
	}

	/**
	 * Determine application namespace either based on a project`s
	 * manifest.json or manifest.appdescr_variant (fallback if present)
	 *
	 * @returns {string} Namespace of the project
	 * @throws {Error} if namespace can not be determined
	 */
	async _getNamespace() {
		try {
			return await this._getNamespaceFromManifestJson();
		} catch (manifestJsonError) {
			if (manifestJsonError.code !== "ENOENT") {
				throw manifestJsonError;
			}
			// No manifest.json present
			// => attempt fallback to manifest.appdescr_variant (typical for App Variants)
			try {
				return await this._getNamespaceFromManifestAppDescVariant();
			} catch (appDescVarError) {
				if (appDescVarError.code === "ENOENT") {
					// Fallback not possible: No manifest.appdescr_variant present
					// => Throw error indicating missing manifest.json
					// 	(do not mention manifest.appdescr_variant since it is only
					// 	relevant for the rather "uncommon" App Variants)
					throw new Error(
						`Could not find required manifest.json for project ` +
						`${this.getName()}: ${manifestJsonError.message}`);
				}
				throw appDescVarError;
			}
		}
	}

	/**
	 * Determine application namespace by checking manifest.json.
	 * Any maven placeholders are resolved from the projects pom.xml
	 *
	 * @returns {string} Namespace of the project
	 * @throws {Error} if namespace can not be determined
	 */
	async _getNamespaceFromManifestJson() {
		const manifest = await this._getManifest("/manifest.json");
		let appId;
		// check for a proper sap.app/id in manifest.json to determine namespace
		if (manifest["sap.app"] && manifest["sap.app"].id) {
			appId = manifest["sap.app"].id;
		} else {
			throw new Error(
				`No sap.app/id configuration found in manifest.json of project ${this.getName()}`);
		}

		if (this._hasMavenPlaceholder(appId)) {
			try {
				appId = await this.resolveMavenPlaceholder(appId);
			} catch (err) {
				throw new Error(
					`Failed to resolve namespace of project ${this.getName()}: ${err.message}`);
			}
		}
		const namespace = appId.replace(/\./g, "/");
		this._log.verbose(
			`Namespace of project ${this.getName()} is ${namespace} (from manifest.appdescr_variant)`);
		return namespace;
	}

	/**
	 * Determine application namespace by checking manifest.appdescr_variant.
	 *
	 * @returns {string} Namespace of the project
	 * @throws {Error} if namespace can not be determined
	 */
	async _getNamespaceFromManifestAppDescVariant() {
		const manifest = await this._getManifest("/manifest.appdescr_variant");
		let appId;
		// check for the id property in manifest.appdescr_variant to determine namespace
		if (manifest && manifest.id) {
			appId = manifest.id;
		} else {
			throw new Error(
				`No "id" property found in manifest.appdescr_variant of project ${this.getName()}`);
		}

		const namespace = appId.replace(/\./g, "/");
		this._log.verbose(
			`Namespace of project ${this.getName()} is ${namespace} (from manifest.appdescr_variant)`);
		return namespace;
	}

	/**
	 * Reads and parses a JSON file with the provided name from the projects source directory
	 *
	 * @param {string} filePath Name of the JSON file to read. Typically "manifest.json" or "manifest.appdescr_variant"
	 * @returns {Promise<object>} resolves with an object containing the content requested manifest file
	 */
	async _getManifest(filePath) {
		if (this._pManifests[filePath]) {
			return this._pManifests[filePath];
		}
		return this._pManifests[filePath] = this.getRuntimeReader().byPath(filePath)
			.then(async (resource) => {
				if (!resource) {
					throw new Error(
						`Could not find resource ${filePath} in project ${this.getName()}`);
				}
				return JSON.parse(await resource.getString());
			})
			.catch((err) => {
				throw new Error(
					`Failed to read ${filePath} for project ` +
					`${this.getName()}: ${err.message}`);
			});
	}
}

module.exports = Application;
