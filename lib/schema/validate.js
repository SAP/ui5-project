const Ajv = require("ajv");

const ajv = new Ajv({
	allErrors: true
});
ajv.addSchema(require("./specVersion-2.0/schema.json"));

ajv.addSchema(require("./specVersion-2.0/kind-project.json"));
ajv.addSchema(require("./specVersion-2.0/kind-project/application.json"));
ajv.addSchema(require("./specVersion-2.0/kind-project/library.json"));
ajv.addSchema(require("./specVersion-2.0/kind-project/theme-library.json"));
ajv.addSchema(require("./specVersion-2.0/kind-project/module.json"));

ajv.addSchema(require("./specVersion-2.0/kind-extension.json"));
ajv.addSchema(require("./specVersion-2.0/kind-extension/task.json"));
ajv.addSchema(require("./specVersion-2.0/kind-extension/server-middleware.json"));
ajv.addSchema(require("./specVersion-2.0/kind-extension/project-shim.json"));

const schema = require("./ui5.json");

function filterErrors(allErrors) {
	return allErrors.filter((error, i, errors) => {
		if (error.keyword === "if") {
			return false;
		}

		if (errors.findIndex(($) => {
			return $.dataPath === error.dataPath &&
			$.keyword === error.keyword &&
			$.params.missingProperty === error.params.missingProperty;
		}) === i) {
			return true;
		} else {
			return false;
		}
	});
}

function validate(data) {
	const valid = ajv.validate(schema, data);
	if (!valid) {
		return filterErrors(ajv.errors);
	} else {
		return undefined;
	}
}

module.exports = validate;
