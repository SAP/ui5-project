/**
 * @param {object} parameters Specification parameters
 * @param {string} parameters.id Unique ID
 * @param {string} parameters.version Version
 * @param {string} parameters.modulePath File System path to access resources
 * @param {object} parameters.configuration Configuration object to use
 */
module.exports = {
	async create(params) {
		if (!params.configuration) {
			throw new Error(
				`Unable to create Specification instance: Missing configuration parameter`);
		}
		const {kind, type} = params.configuration;
		if (!["project", "extension"].includes(kind)) {
			throw new Error(`Unable to create Specification instance: Unknown kind '${kind}'`);
		}

		switch (type) {
		case "application": {
			return createAndInitializeSpec("Application", params);
		}
		case "library": {
			return createAndInitializeSpec("Library", params);
		}
		case "theme-library": {
			return createAndInitializeSpec("ThemeLibrary", params);
		}
		case "module": {
			return createAndInitializeSpec("Module", params);
		}
		case "task": {
			return createAndInitializeSpec("Task", params);
		}
		case "middleware": {
			return createAndInitializeSpec("Middleware", params);
		}
		case "project-shim": {
			return createAndInitializeSpec("ProjectShim", params);
		}
		default:
			throw new Error(
				`Unable to create Specification instance: Unknown specification type '${type}'`);
		}
	}
};

function createAndInitializeSpec(moduleName, params) {
	const Spec = require(`./specifications/types/${moduleName}`);
	const bla = new Spec().init(params);
	return bla;
}
