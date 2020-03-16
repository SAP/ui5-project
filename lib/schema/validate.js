const Ajv = require("ajv");
const path = require("path");
const {promisify} = require("util");
const readFile = promisify(require("fs").readFile);

async function loadSchema(schemaPath) {
	const filePath = schemaPath.replace("http://ui5.sap/schema/", "");
	const schemaFile = await readFile(path.join(__dirname, filePath), {encoding: "utf8"});
	return JSON.parse(schemaFile);
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
	constructor() {
		this.ajv = new Ajv({
			allErrors: true,
			loadSchema
		});
	}

	_compileSchema() {
		if (!this._compiling) {
			this._compiling = Promise.resolve().then(async () => {
				const schema = await loadSchema("ui5.json");
				const validate = await this.ajv.compileAsync(schema);
				return validate;
			});
		}
		return this._compiling;
	}

	async validate({config}) {
		const fnValidate = await this._compileSchema();
		const valid = fnValidate(config);
		if (!valid) {
			throw new ValidationError(fnValidate.errors);
		} else {
			return undefined;
		}
	}
}

const validator = new Validator();

module.exports = (options) => {
	return validator.validate(options);
};

module.exports._Validator = Validator; // For testing only
