import {fileURLToPath} from "node:url";
import {readFile} from "node:fs/promises";

/**
 * @module @ui5/project/validation/validator
 * @description A collection of validation related APIs
 */

/**
 */
export const SCHEMA_VARIANTS = {
	"ui5": "ui5.json",
	"ui5-workspace": "ui5-workspace.json",
};

class Validator {
	constructor({Ajv, ajvErrors, schemaName, ajvConfig}) {
		if (!schemaName || !SCHEMA_VARIANTS[schemaName]) {
			throw new Error(
				`"schemaName" is missing or incorrect. The available schemaName variants are ${Object.keys(
					SCHEMA_VARIANTS
				).join(", ")}`
			);
		}

		this._schemaName = SCHEMA_VARIANTS[schemaName];

		ajvConfig = Object.assign({
			allErrors: true,
			jsonPointers: true,
			loadSchema: Validator.loadSchema,
		}, ajvConfig);
		this.ajv = new Ajv(ajvConfig);
		ajvErrors(this.ajv);
	}

	_compileSchema() {
		const schemaName = this._schemaName;

		if (!this._compiling) {
			this._compiling = Promise.resolve().then(async () => {
				const schema = await Validator.loadSchema(schemaName);
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
			// Read errors/schema from fnValidate before lazy loading ValidationError module.
			// Otherwise they might be cleared already.
			const {errors, schema} = fnValidate;
			const {default: ValidationError} = await import("./ValidationError.js");
			throw new ValidationError({
				errors,
				schema,
				project,
				yaml,
			});
		}
	}

	static async loadSchema(schemaPath) {
		const filePath = schemaPath.replace("http://ui5.sap/schema/", "");
		const schemaFile = await readFile(
			fileURLToPath(new URL(`./schema/${filePath}`, import.meta.url)), {encoding: "utf8"}
		);
		return JSON.parse(schemaFile);
	}
}

const validator = Object.create(null);
const defaultsValidator = Object.create(null);

/**
 *
 * @param schemaName
 * @param options
 */
async function _validate(schemaName, options) {
	if (!validator[schemaName]) {
		validator[schemaName] = (async () => {
			const {default: Ajv} = await import("ajv");
			const {default: ajvErrors} = await import("ajv-errors");
			return new Validator({Ajv, ajvErrors, schemaName});
		})();
	}

	const schemaValidator = await validator[schemaName];
	await schemaValidator.validate(options);
}

/**
 *
 * @param schemaName
 * @param options
 */
async function _validateAndSetDefaults(schemaName, options) {
	if (!defaultsValidator[schemaName]) {
		defaultsValidator[schemaName] = (async () => {
			const {default: Ajv} = await import("ajv");
			const {default: ajvErrors} = await import("ajv-errors");
			return new Validator({Ajv, ajvErrors, ajvConfig: {useDefaults: true}, schemaName});
		})();
	}

	// When AJV is configured with useDefaults: true, it may add properties to the
	// provided configuration that were not initially present. This behavior can
	// lead to unexpected side effects and potential issues. To avoid these
	// problems, we create a copy of the configuration. If we need the altered
	// configuration later, we return this copied version.
	const optionsCopy = structuredClone(options);
	const schemaValidator = await defaultsValidator[schemaName];
	await schemaValidator.validate(optionsCopy);

	return optionsCopy;
}

/**
 * Validates the given ui5 configuration.
 *
 * @param options
 * @param options.config UI5 Configuration to validate
 * @param options.project Project information
 * @param options.project.id ID of the project
 * @param [options.yaml] YAML information
 * @param options.yaml.path Path of the YAML file
 * @param options.yaml.source Content of the YAML file
 * @param {number} [options.yaml.documentIndex=0] Document index in case the YAML file contains multiple documents
 * @throws {@ui5/project/validation/ValidationError}
 *   Rejects with a {@link @ui5/project/validation/ValidationError ValidationError}
 *   when the validation fails.
 * @returns {Promise<undefined>} Returns a Promise that resolves when the validation succeeds
 */
export async function validate(options: {
	config: object;
	project: {
		id: string;
	};
	yaml?: {
		path: string;
		source: string;
		documentIndex?: number;
	};
}) {
	await _validate("ui5", options);
}

/**
 * Validates the given ui5 configuration and returns default values if none are provided.
 *
 * @param options
 * @param options.config The UI5 Configuration to validate
 * @param options.project Project information
 * @param options.project.id ID of the project
 * @param [options.yaml] YAML information
 * @param options.yaml.path Path of the YAML file
 * @param options.yaml.source Content of the YAML file
 * @param {number} [options.yaml.documentIndex=0] Document index in case the YAML file contains multiple documents
 * @throws {module:@ui5/project/validation/ValidationError}
 *   Rejects with a {@link @ui5/project/validation/ValidationError ValidationError}
 *   when the validation fails.
 * @returns {Promise<options>} Returns a Promise that resolves when the validation succeeds
 */
export async function getDefaults(options: {
	config: object;
	project: {
		id: string;
	};
	yaml?: {
		path: string;
		source: string;
		documentIndex?: number;
	};
}) {
	return await _validateAndSetDefaults("ui5", options);
}

/**
 * Enhances bundleDefinition by adding missing properties with their respective default values.
 *
 * @param bundles Bundles to be enhanced
 * @param bundles[].bundleDefinition
 *   Module bundle definition
 * @param [bundles[].bundleOptions]
 *   Module bundle options
 * @param bundles.bundleDefinition
 * @param project The project to get metadata from
 * @param bundles.bundleOptions
 * @returns The enhanced BundleDefinition & BundleOptions
 */
export async function enhanceBundlesWithDefaults(bundles: {
	bundleDefinition: object;
	bundleOptions?: object;
}, project: object) {
	const config = {
		specVersion: `${project.getSpecVersion()}`,
		type: `${project.getType()}`,
		metadata: {name: project.getName()},
		builder: {bundles},
	};
	const result = await getDefaults({config, project: {id: project.getName()}});

	return result.config.builder.bundles;
}

/**
 * Validates the given ui5-workspace configuration.
 *
 * @param options
 * @param options.config ui5-workspace Configuration to validate
 * @param [options.yaml] YAML information
 * @param options.yaml.path Path of the YAML file
 * @param options.yaml.source Content of the YAML file
 * @param [options.yaml.documentIndex] Document index in case the YAML file contains multiple documents
 * @throws {@ui5/project/validation/ValidationError}
 *   Rejects with a {@link @ui5/project/validation/ValidationError ValidationError}
 *   when the validation fails.
 * @returns {Promise<undefined>} Returns a Promise that resolves when the validation succeeds
 */
export async function validateWorkspace(options: {
	config: object;
	yaml?: {
		path: string;
		source: string;
		documentIndex?: number;
	};
}) {
	await _validate("ui5-workspace", options);
}

export {
	/**
	 * For testing only!
	 *
	 */
	Validator as _Validator,
};
