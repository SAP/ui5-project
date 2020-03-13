const Ajv = require("ajv");
const path = require("path");
const {readFileSync} = require("fs");

function loadSchema(schemaPath) {
	return JSON.parse(readFileSync(path.join(__dirname, schemaPath), {encoding: "utf8"}));
}

class ValidationError extends Error {
	constructor(errors) {
		super();

		this.name = "ValidationError";

		this.errors = ValidationError.filterErrors(errors)
			.map(ValidationError.formatError);

		this.message = ValidationError.formatMessage(this.errors);

		Error.captureStackTrace(this, this.constructor);
	}

	static formatMessage(errors) {
		return errors.map((err) => err.message).join("\n");
	}

	static filterErrors(allErrors) {
		return allErrors.filter((error, i, errors) => {
			if (error.keyword === "if") {
				return false;
			}

			if (errors.findIndex(($) => {
				return $.dataPath === error.dataPath &&
				$.keyword === error.keyword &&
				JSON.stringify($.params) === JSON.stringify(error.params);
			}) === i) {
				return true;
			} else {
				return false;
			}
		});
	}

	static formatError({dataPath, keyword, message, params}) {
		return {
			dataPath, keyword, message, params
		};
	}
}

class Validator {
	constructor(ajv) {
		this.ajv = ajv;
		this.schemasAdded = false;
	}

	_addSchemas() {
		if (this.schemasAdded) {
			return;
		}
		this.schemasAdded = true;

		this.ajv.addSchema(loadSchema("ui5.json"));

		this.ajv.addSchema(loadSchema("specVersion/2.0.json"));

		this.ajv.addSchema(loadSchema("specVersion/2.0/kind/project.json"));
		this.ajv.addSchema(loadSchema("specVersion/2.0/kind/project/application.json"));
		this.ajv.addSchema(loadSchema("specVersion/2.0/kind/project/library.json"));
		this.ajv.addSchema(loadSchema("specVersion/2.0/kind/project/theme-library.json"));
		this.ajv.addSchema(loadSchema("specVersion/2.0/kind/project/module.json"));

		this.ajv.addSchema(loadSchema("specVersion/2.0/kind/extension.json"));
		this.ajv.addSchema(loadSchema("specVersion/2.0/kind/extension/task.json"));
		this.ajv.addSchema(loadSchema("specVersion/2.0/kind/extension/server-middleware.json"));
		this.ajv.addSchema(loadSchema("specVersion/2.0/kind/extension/project-shim.json"));
	}

	async validate({config}) {
		this._addSchemas();
		const valid = this.ajv.validate("http://ui5.sap/schema/ui5.json", config);
		if (!valid) {
			throw new ValidationError(this.ajv.errors);
		} else {
			return undefined;
		}
	}
}

const ajv = new Ajv({
	allErrors: true
});
const validator = new Validator(ajv);

module.exports = (options) => {
	return validator.validate(options);
};

module.exports._Validator = Validator; // For testing only
