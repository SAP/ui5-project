/**
 * @param {object} parameters Specification parameters
 * @param {string} parameters.id Unique ID
 * @param {string} parameters.version Version
 * @param {string} parameters.modulePath File System path to access resources
 * @param {object} parameters.configuration Configuration object to use
 */
module.exports = {
	// async create(specParams) {
	// 	if (!specParams.configuration) {
	// 		throw new Error(`Unable to create Specification: No configuration provided`);
	// 	}
	// 	switch (specParams.configuration.kind) {
	// 	case "project":
	// 		return Project.create(specParams);
	// 	case "extension":
	// 		return Extension.create(specParams);
	// 	default:
	// 		throw new Error(
	// 			`Encountered unexpected specification configuration of kind ${specParams.configuration.kind} ` +
	// 			`Supported kinds are 'project' and 'extension'`);
	// 	}
	// }

	async create(params) {
		if (!["project", "extension"].includes(params.configuration.kind)) {
			throw new Error(`Unable to create Specification instance: Unknown kind '${params.configuration.kind}'`);
		}

		switch (params.configuration.type) {
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
				`Unable to create Specification instance: Unknown specification type '${params.configuration.type}'`);
		}
	}
};

function createAndInitializeSpec(moduleName, params) {
	const Spec = require(`./specifications/types/${moduleName}`);
	const bla = new Spec().init(params);
	return bla;
}
