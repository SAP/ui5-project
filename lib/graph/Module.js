const fs = require("graceful-fs");
const path = require("path");
const {promisify} = require("util");
const readFile = promisify(fs.readFile);
const jsyaml = require("js-yaml");
const resourceFactory = require("@ui5/fs").resourceFactory;
const Specification = require("../Specification");
const {validate} = require("../validation/validator");

const log = require("@ui5/logger").getLogger("graph:Module");

const defaultConfigPath = "ui5.yaml";

function clone(obj) {
	return JSON.parse(JSON.stringify(obj));
}
/**
 * Raw representation of a UI5 Project. A module can contain zero to one projects and n extensions.
 * This class is intended for private use by the
 * [@ui5/project.graph.projectGraphFromTree]{@link module:@ui5/project.graph.projectGraphFromTree} module
 *
 * @private
 * @memberof module:@ui5/project.graph
 */
class Module {
	/**
	 * @param {object} parameters Module parameters
	 * @param {string} parameters.id Unique ID for the module
	 * @param {string} parameters.version Version of the module
	 * @param {string} parameters.modulePath File System path to access the projects resources
	 * @param {string} [parameters.configPath=ui5.yaml]
	 *						Either a path relative to `modulePath` which will be resolved by @ui5/fs (default),
	 *						or an absolute File System path to the configuration file.
	 * @param {object|object[]} [parameters.configuration]
	 * 						Configuration object or array of objects to use. If supplied, no ui5.yaml will be read
	 * @param {@ui5/project.graph.ShimCollection} [parameters.shimCollection]
	 *						Collection of shims that might be relevant for this module
	 */
	constructor({id, version, modulePath, configPath = defaultConfigPath, configuration = [], shimCollection}) {
		if (!id) {
			throw new Error(`Could not create Module: Missing or empty parameter 'id'`);
		}
		if (!version) {
			throw new Error(`Could not create Module: Missing or empty parameter 'version'`);
		}
		if (!modulePath) {
			throw new Error(`Could not create Module: Missing or empty parameter 'modulePath'`);
		}

		this._id = id;
		this._version = version;
		this._modulePath = modulePath;
		this._configPath = configPath;
		this._dependencies = {};

		if (!Array.isArray(configuration)) {
			configuration = [configuration];
		}
		this._suppliedConfigs = configuration;

		if (shimCollection) {
			// Retrieve and clone shims in constructor
			// Shims added to the collection at a later point in time should not be applied in this module
			const shims = shimCollection.getConfigurationShims(this.getId());
			if (shims && shims.length) {
				this._configShims = clone(shims);
			}
		}
	}

	getId() {
		return this._id;
	}

	getVersion() {
		return this._version;
	}

	getPath() {
		return this._modulePath;
	}

	async getSpecifications() {
		if (this._pGetSpecifications) {
			return this._pGetSpecifications;
		}

		return this._pGetSpecifications = this._getSpecifications();
	}

	async _getSpecifications() {
		const configs = await this._getConfigurations();

		// let project;
		// const extensions = [];
		const specs = await Promise.all(configs.map(async (configuration) => {
			const spec = await Specification.create({
				id: this.getId(),
				version: this.getVersion(),
				modulePath: this.getPath(),
				configuration
			});

			log.verbose(`Module ${this.getId()} contains ${spec.getKind()} ${spec.getName()}`);
			return spec;

			// switch (configuration.kind) {
			// case "project":
			// 	if (project) {
			// 		throw new Error(
			// 			`Invalid configuration for module ${this.getId()}: Per module there ` +
			// 			`must be no more than one configuration of kind 'project'`);
			// 	}
			// 	log.verbose(`Module ${this.getId()} contains project ${configuration.getName()}`);
			// 	project = await Project.create({
			// 		id: this.getId(),
			// 		version: this.getVersion(),
			// 		modulePath: this.getPath(),
			// 		configuration
			// 	});
			// 	break;
			// case "extension":
			// 	log.verbose(`Module ${this.getId()} contains extension ${configuration.getName()}`);
			// 	extensions.push(new Extension({
			// 		id: this.getId(),
			// 		version: this.getVersion(),
			// 		modulePath: this.getPath(),
			// 		configuration
			// 	}));
			// 	break;
			// default:
			// 	throw new Error(
			// 		`Encountered unexpected specification configuration of kind ${configuration.kind} ` +
			// 		`Supported kinds are 'project' and 'extension'`);
			// }
		}));

		const projects = specs.filter((spec) => {
			return spec.getKind() === "project";
		});

		const extensions = specs.filter((spec) => {
			return spec.getKind() === "extension";
		});

		if (projects.length > 1) {
			throw new Error(
				`Found ${projects.length} configurations of kind 'project' for ` +
				`module ${this.getId()}. There must be only one project per module.`);
		}

		return {
			project: projects[0],
			extensions
		};
	}

	/**
	* Configuration
	*/
	async _getConfigurations() {
		let configurations;

		configurations = await this._getSuppliedConfigurations();

		if (!configurations || !configurations.length) {
			configurations = await this._getYamlConfigurations();
		}
		if (!configurations || !configurations.length) {
			configurations = await this._getShimConfigurations();
		}
		return configurations || [];
	}

	async _createConfigurationObject(config) {
		this._normalizeConfig(config);
		if (config.kind === "project") {
			this._applyShims(config);
		}
		// await this._validateConfig(config);
		return config;
	}

	async _createConfigurationFromShim() {
		const config = this._applyShims();
		if (config) {
			this._normalizeConfig(config);
			// await this._validateConfig(config);
			return config;
		}
	}

	_applyShims(config = {}) {
		if (!this._configShims) {
			return;
		}
		this._configShims.forEach(({name, shim}) => {
			log.verbose(`Applying project shim ${name} for module ${this.getId()}...`);
			Object.assign(config, shim);
		});
		return config;
	}

	async _getSuppliedConfigurations() {
		if (this._suppliedConfigs.length) {
			log.verbose(`Configuration for module ${this.getId()} has been supplied directly`);
			return await Promise.all(this._suppliedConfigs.map(async (config) => {
				return this._createConfigurationObject(config);
			}));
		}
	}

	async _getShimConfigurations() {
		// No project configuration found
		//	=> Try to create one from shims
		const shimConfiguration = await this._createConfigurationFromShim();
		if (shimConfiguration) {
			log.verbose(`Created configuration from shim extensions for module ${this.getId()}`);
			return [shimConfiguration];
		}
	}

	async _getYamlConfigurations() {
		const configs = await this._readConfigFile();

		if (!configs || !configs.length) {
			log.verbose(`Could not find a configuration file for module ${this.getId()}`);
			return [];
		}

		// for (let i = configs.length - 1; i >= 0; i--) {
		// 	this._normalizeConfig(configs[i]);
		// }

		// const projectConfigs = configs.filter((config) => {
		// 	return config.kind === "project";
		// });

		// const extensionConfigs = configs.filter((config) => {
		// 	return config.kind === "extension";
		// });

		// // While a project can contain multiple configurations,
		// //	from a dependency tree perspective it is always a single project
		// // This means it can represent one "project", plus multiple extensions or
		// //	one extension, plus multiple extensions

		// if (projectConfigs.length > 1) {
		// 	throw new Error(
		// 		`Found ${projectConfigs.length} configurations of kind 'project' for ` +
		// 		`project ${this.getId()}. There is only one project per configuration allowed.`);
		// } else if (projectConfigs.length === 0 && extensionConfigs.length === 0) {
		// 	throw new Error(
		// 		`Found ${configs.length} configurations for ` +
		// 		`project ${this.getId()}. However, none of them are of kind 'project' or 'extension'.`);
		// }

		// const configurations = [];
		// if (projectConfigs.length) {
		// 	configurations.push(await this._createConfigurationObject(projectConfigs[0]));
		// }

		// await Promise.all(extensionConfigs.map(async (config) => {
		// 	configurations.push(await this._createConfigurationObject(config));
		// }));

		return await Promise.all(configs.map((config) => {
			return this._createConfigurationObject(config);
		}));
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
			configFile = await configResource.getString();
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
		return config;
	}

	// async _validateConfig(config) {
	// 	const moduleId = this.getId();
	// 	if (!moduleId.startsWith("@openui5/") && !moduleId.startsWith("@sapui5/")) {
	// 		if (config.specVersion === "0.1" || config.specVersion === "1.0" ||
	// 			config.specVersion === "1.1") {
	// 			throw new Error(
	// 				`Unsupported specification version ${config.specVersion} defined in module ` +
	// 				`${this.getId()}. The new Module API can only be used with specification versions >= 2.0. ` +
	// 				`For details see https://sap.github.io/ui5-tooling/pages/Configuration/#specification-versions`);
	// 		}
	// 		if (config.specVersion !== "2.0" &&
	// 			config.specVersion !== "2.1" && config.specVersion !== "2.2" &&
	// 			config.specVersion !== "2.3") {
	// 			throw new Error(
	// 				`Unsupported specification version ${config.specVersion} defined in module ` +
	// 				`${this.getId()}. Your UI5 CLI installation might be outdated. ` +
	// 				`For details see https://sap.github.io/ui5-tooling/pages/Configuration/#specification-versions`);
	// 		}
	// 	}

	// 	await validate({
	// 		config,
	// 		project: {
	// 			id: moduleId
	// 		}
	// 	});
	// }

	_isConfigValid(project) {
		if (!project.type) {
			if (project._isRoot) {
				throw new Error(`No type configured for root project ${project.id}`);
			}
			log.verbose(`No type configured for project ${project.id}`);
			return false; // ignore this project
		}

		if (project.kind !== "project" && project._isRoot) {
			// This is arguable. It is not the concern of ui5-project to define the entry point of a project tree
			// On the other hand, there is no known use case for anything else right now and failing early here
			//	makes sense in that regard
			throw new Error(`Root project needs to be of kind "project". ${project.id} is of kind ${project.kind}`);
		}

		if (project.kind === "project" && project.type === "application") {
			// There must be exactly one application project per dependency tree
			// If multiple are found, all but the one closest to the root are rejected (ignored)
			// If there are two projects equally close to the root, an error is being thrown
			if (!this.qualifiedApplicationProject) {
				this.qualifiedApplicationProject = project;
			} else if (this.qualifiedApplicationProject._level === project._level) {
				throw new Error(`Found at least two projects ${this.qualifiedApplicationProject.id} and ` +
					`${project.id} of type application with the same distance to the root project. ` +
					"Only one project of type application can be used. Failed to decide which one to ignore.");
			} else {
				return false; // ignore this project
			}
		}

		return true;
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
