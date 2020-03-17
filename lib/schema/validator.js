const Ajv = require("ajv");
const ajvErrors = require("ajv-errors");
const path = require("path");
const {promisify} = require("util");
const readFile = promisify(require("fs").readFile);

const ValidationError = require("./ValidationError");

async function loadSchema(schemaPath) {
	const filePath = schemaPath.replace("http://ui5.sap/schema/", "");
	const schemaFile = await readFile(path.join(__dirname, filePath), {encoding: "utf8"});
	return JSON.parse(schemaFile);
}

class Validator {
	constructor() {
		this.ajv = new Ajv({
			allErrors: true,
			jsonPointers: true,
			loadSchema
		});
		ajvErrors(this.ajv);
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

	async validate({config, project, yaml}) {
		const fnValidate = await this._compileSchema();
		const valid = fnValidate(config);
		if (!valid) {
			throw new ValidationError({
				errors: fnValidate.errors,
				schema: fnValidate.schema,
				data: config,
				project,
				yaml
			});
		} else {
			return undefined;
		}
	}
}

const validator = new Validator();

module.exports = {
	validate: (options) => {
		return validator.validate(options);
	},
	ValidationError,
	_Validator: Validator // For testing only
};
