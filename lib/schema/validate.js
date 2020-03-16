const Ajv = require("ajv");
const ajvErrors = require("ajv-errors");
const path = require("path");
const {promisify} = require("util");
const readFile = promisify(require("fs").readFile);

async function loadSchema(schemaPath) {
	const filePath = schemaPath.replace("http://ui5.sap/schema/", "");
	const schemaFile = await readFile(path.join(__dirname, filePath), {encoding: "utf8"});
	return JSON.parse(schemaFile);
}

class ValidationError extends Error {
	constructor({errors, project, yaml}) {
		super();

		this.name = "ValidationError";

		this.errors = ValidationError.filterErrors(errors);
		this.project = project;
		this.yaml = yaml;

		this.message = ValidationError.formatMessage({
			errors: this.errors,
			project: this.project,
			yaml: this.yaml
		});

		Error.captureStackTrace(this, this.constructor);
	}

	static formatMessage({errors, project, yaml}) {
		let message = `Invalid ui5.yaml configuration for project ${project.id}\n`;
		message += errors.map((error) => {
			let errorMessage = error.message;
			if (yaml) {
				const errorLines = errorMessage.split("\n");
				const yamlExtract = ValidationError.getYamlExtract({error, yaml});
				errorLines.splice(1, 0, "\n" + yamlExtract);
				errorMessage = errorLines.join("\n");
			}
			return "\n" + errorMessage;
		}).join("\n");
		return message;
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

	static getYamlExtract({error, yaml}) {
		return `${yaml.path}:?

${yaml.source}
`;
	}
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
				project,
				yaml
			});
		} else {
			return undefined;
		}
	}
}

const validator = new Validator();

module.exports = (options) => {
	return validator.validate(options);
};
module.exports.ValidationError = ValidationError;

module.exports._Validator = Validator; // For testing only
