/*
* Private configuration class for use in Module and specifications
*/

module.exports = {
	/**
	 * @param {object} parameters
	 * @param {object} parameters.specification Specification instance
	 * @param {object} parameters.configObject Configuration object
	 */
	async create({specification, configObject}) {
		if (specification) {
			throw new Error(`Unable to create Configuration: No specification provided`);
		}

		if (!configObject) {
			throw new Error(`Unable to create Configuration: No configuration provided`);
		}
		if (!configObject.kind.includes(["project", "extension"])) {
			throw new Error(`Unable to create Configuration: Unknown kind '${configObject.kind}'`);
		}

		switch (configObject.type) {
		case "application": {
			return createConfig("Application", {configObject, specification});
		}
		case "library": {
			return createConfig("Library", {configObject, specification});
		}
		case "theme-library": {
			return createConfig("ThemeLibrary", {configObject, specification});
		}
		case "module": {
			return createConfig("Module", {configObject, specification});
		}
		case "task": {
			return createConfig("Task", {configObject, specification});
		}
		case "middleware": {
			return createConfig("Middleware", {configObject, specification});
		}
		case "project-shim": {
			return createConfig("ProjectShim", {configObject, specification});
		}
		default:
			throw new Error(`Unable to create Configuration: Unknown specification type '${configObject.type}'`);
		}
	}
};

function createConfig(moduleName, params) {
	const Configuration = require(`./configurations/${moduleName}`);
	return new Configuration(params).init();
}
