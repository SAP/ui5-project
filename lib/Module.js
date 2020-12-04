const fs = require("graceful-fs");
const path = require("path");
const {promisify} = require("util");
const readFile = promisify(fs.readFile);
const jsyaml = require("js-yaml");
const resourceFactory = require("@ui5/fs").resourceFactory;
const Project = require("./specifications/Project");
const Extension = require("./specifications/Extension");
const ProjectConfiguration = require("./configurations/ProjectConfiguration");
const ExtensionConfiguration = require("./configurations/ExtensionConfiguration");
const {validate} = require("./validation/validator");

const log = require("@ui5/logger").getLogger("Module");

const defaultConfigPath = "ui5.yaml";

function clone(obj) {
	return JSON.parse(JSON.stringify(obj));
}

class Module {
	/**
	 * @param {object} parameters Module parameters
	 * @param {string} parameters.id Unique ID for the project
	 * @param {string} parameters.version Version of the project
	 * @param {string} parameters.modulePath File System path to access the projects resources
	 * @param {string} [parameters.configPath=ui5.yaml]
	 *						Either a path relative to `modulePath` which will be resolved by @ui5/fs (default),
	 *						or an absolute File System path to the project configuration file.
	 * @param {object} [parameters.configuration]
	 * 						Configuration object to use. If supplied, no ui5.yaml will be read
	 * @param {@ui5/extension.extensions.ShimCollection} [parameters.shimCollection]
	 *						Collection of shims that might be relevant for this module
	 */
	constructor({id, version, modulePath, configPath = defaultConfigPath, configuration, shimCollection}) {
		if (!id || !version || !modulePath) {
			throw new Error(`Could not create Module: One or more required parameters are missing`);
		}

		this._id = id;
		this._version = version;
		this._modulePath = modulePath;
		this._configPath = configPath;
		this._dependencies = {};

		if (shimCollection) {
			// Retrieve and clone shims in constructor
			// Shims added to the collection at a later point in time should not be applied in this module
			const shims = shimCollection.getConfigurationShims(this.getId());
			if (shims && shims.length) {
				this._configShims = clone(shims);
			}
		}

		if (configuration) {
			if (!configuration.kind) {
				throw new Error(
					`Could not create module with supplied configuration object: Missing 'kind' property.`);
			}
			if (!["project", "extension"].includes(configuration.kind)) {
				throw new Error(
					`Could not create module with supplied configuration object: ` +
					`Unknown kind '${configuration.kind}'. Expected 'project' or 'extension'`);
			}
			this._suppliedConfig = configuration;
		}
	}

	/**
	* @private
	*/
	getId() {
		return this._id;
	}

	/**
	* @private
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

	getDependencies() {
		return [];
	}

	async getProject() {
		const configs = await this.getConfigurations();
		// getConfigurations promises us to return none or exactly one project configuration
		const projectConfig = configs.find((config) => {
			return (config instanceof ProjectConfiguration);
		});

		if (projectConfig) {
			return new Project({
				id: this.getId(),
				version: this.getVersion(),
				modulePath: this.getPath(),
				configuration: projectConfig
			});
		}
	}

	async getExtensions() {
		const configs = await this.getConfigurations();
		const extensionConfigs = configs.filter((config) => {
			return (config instanceof ExtensionConfiguration);
		});
		return extensionConfigs.map((config) => {
			return new Extension({
				id: this.getId(),
				version: this.getVersion(),
				modulePath: this.getPath(),
				configuration: config
			});
		});
	}

	/**
	* Configuration
	*/
	async getConfigurations() {
		if (this._pGetConfigurations) {
			return this._pGetConfigurations;
		}

		return this._pGetConfigurations = this._getConfigurations();
	}

	async _getConfigurations() {
		let configurations;
		if (this._suppliedConfig) {
			configurations = [this._createConfigurationInstance(this._suppliedConfig)];
		} else {
			configurations = await this._loadProjectConfiguration();
		}
		return configurations;
	}

	_createConfigurationInstance(config) {
		if (config.kind === "project") {
			this._applyShims(config);
			return new ProjectConfiguration(config);
		} else if (config.kind === "extension") {
			return new ExtensionConfiguration(config);
		}
	}

	_createProjectConfigurationFromShim() {
		const config = {};
		this._applyShims(config);
		if (config) {
			return new ProjectConfiguration(config);
		}
	}

	_applyShims(config) {
		if (!this._configShims) {
			return;
		}
		this._configShims.forEach(({name, shim}) => {
			log.verbose(`Applying project shim ${name} for module ${this.getId()}...`);
			Object.assign(config, shim);
		});
		return config;
	}

	async _loadProjectConfiguration() {
		const configs = await this._readConfigFile();

		if (!configs || !configs.length) {
			// No project configuration found
			//	=> Try to create one from shims
			const shimConfiguration = this._createProjectConfigurationFromShim();
			if (shimConfiguration) {
				return [shimConfiguration];
			}
			return [];
		}

		for (let i = configs.length - 1; i >= 0; i--) {
			this._normalizeConfig(configs[i]);
		}

		const projectConfigs = configs.filter((config) => {
			return config.kind === "project";
		});

		const extensionConfigs = configs.filter((config) => {
			return config.kind === "extension";
		});

		// While a project can contain multiple configurations,
		//	from a dependency tree perspective it is always a single project
		// This means it can represent one "project", plus multiple extensions or
		//	one extension, plus multiple extensions

		if (projectConfigs.length > 1) {
			throw new Error(
				`Found ${projectConfigs.length} configurations of kind 'project' for ` +
				`project ${this.getId()}. There is only one project per configuration allowed.`);
		} else if (projectConfigs.length === 0 && extensionConfigs.length === 0) {
			throw new Error(
				`Found ${configs.length} configurations for ` +
				`project ${this.getId()}. However, none of them are of kind 'project' or 'extension'.`);
		}

		const configurations = [];
		if (projectConfigs.length) {
			configurations.push(this._createConfigurationInstance(projectConfigs[0]));
		} else {
			// No project configuration found
			//	=> Try to create one from shims
			const shimConfiguration = this._createProjectConfigurationFromShim();
			if (shimConfiguration) {
				configurations.push(shimConfiguration);
			}
		}

		extensionConfigs.forEach((config) => {
			configurations.push(this._createConfigurationInstance(config));
		});

		return configurations;
	}

	async _readConfigFile() {
		const configPath = this._configPath;
		let configFile;
		if (path.isAbsolute(configPath)) {
			try {
				configFile = await readFile(configPath, {encoding: "utf8"});
			} catch (err) {
				// TODO: Caller might want to ignore this exception for ENOENT errors if non-root projects
				// However, this decision should not be made here
				throw new Error("Failed to read configuration for project " +
						`${this.getId()} at '${configPath}'. Error: ${err.message}`);
			}
		} else {
			const reader = await this.getReader();
			let configResource;
			try {
				configResource = await reader.byPath(path.posix.join("/", configPath));
			} catch (err) {
				throw new Error("Failed to read configuration for module " +
						`${this.getId()} at "${configPath}". Error: ${err.message}`);
			}
			if (!configResource) {
				if (configPath !== defaultConfigPath) {
					throw new Error("Failed to read configuration for module " +
							`${this.getId()}: Could not find configuration file in module at path '${configPath}'`);
				}
				return null;
			}
			configFile = await configResource.getBuffer();
		}

		let configs;

		try {
			// Using loadAll with DEFAULT_SAFE_SCHEMA instead of safeLoadAll to pass "filename".
			// safeLoadAll doesn't handle its parameters properly.
			// See https://github.com/nodeca/js-yaml/issues/456 and https://github.com/nodeca/js-yaml/pull/381
			configs = jsyaml.loadAll(configFile, undefined, {
				filename: configPath,
				schema: jsyaml.DEFAULT_SAFE_SCHEMA
			});
		} catch (err) {
			if (err.name === "YAMLException") {
				throw new Error("Failed to parse configuration for project " +
				`${this.getId()} at '${configPath}'\nError: ${err.message}`);
			} else {
				throw err;
			}
		}

		if (!configs || !configs.length) {
			return configs;
		}

		const validationResults = await Promise.all(
			configs.map(async (config, documentIndex) => {
				// Catch validation errors to ensure proper order of rejections within Promise.all
				try {
					await validate({
						config,
						project: {
							id: this.getId()
						},
						yaml: {
							path: configPath,
							source: configFile,
							documentIndex
						}
					});
				} catch (error) {
					return error;
				}
			})
		);

		const validationErrors = validationResults.filter(($) => $);

		if (validationErrors.length > 0) {
			// For now just throw the error of the first invalid document
			throw validationErrors[0];
		}

		return configs;
	}

	_normalizeConfig(config) {
		if (!config.kind) {
			config.kind = "project"; // default
		}
	}

	/**
	* Resource Access
	*/
	async getReader() {
		return resourceFactory.createReader({
			fsBasePath: this.getPath(),
			virBasePath: "/",
			name: `Reader for module ${this.getId()}`
		});
	}
}

module.exports = Module;
