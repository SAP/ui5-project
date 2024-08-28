import path from "node:path";
import type Logger from "@ui5/logger/Logger";
import {getLogger} from "@ui5/logger";
import {createReader} from "@ui5/fs/resourceFactory";
import SpecificationVersion from "./SpecificationVersion.js";

export interface SpecificationConfiguration {
	kind: string;
	type: string;
	specVersion: string;
	metadata: {
		name: string;
	};
}

interface LegacySpecificationConfiguration extends SpecificationConfiguration {
	resources?: {
		configuration?: {
			propertiesFileSourceEncoding?: string;
		};
	};
}

interface SpecificationParameters {
	id: string;
	version: string;
	modulePath: string;
	configuration: SpecificationConfiguration;
}

/**
 * Abstract superclass for all projects and extensions
 *
 * @hideconstructor
 */
class Specification {
	_log: Logger;
	_version!: string;
	_modulePath!: string;
	__id!: string;
	_name!: string;
	_kind!: string;
	_type!: string;
	_specVersionString!: string;
	_specVersion!: SpecificationVersion;
	_config!: SpecificationConfiguration;

	public static async create(parameters: SpecificationParameters) {
		if (!parameters.configuration) {
			throw new Error(
				`Unable to create Specification instance: Missing configuration parameter`);
		}
		const {kind, type} = parameters.configuration;
		if (!["project", "extension"].includes(kind)) {
			throw new Error(`Unable to create Specification instance: Unknown kind '${kind}'`);
		}

		switch (type) {
			case "application": {
				return createAndInitializeSpec("types/Application.js", parameters);
			}
			case "library": {
				return createAndInitializeSpec("types/Library.js", parameters);
			}
			case "theme-library": {
				return createAndInitializeSpec("types/ThemeLibrary.js", parameters);
			}
			case "module": {
				return createAndInitializeSpec("types/Module.js", parameters);
			}
			case "task": {
				return createAndInitializeSpec("extensions/Task.js", parameters);
			}
			case "server-middleware": {
				return createAndInitializeSpec("extensions/ServerMiddleware.js", parameters);
			}
			case "project-shim": {
				return createAndInitializeSpec("extensions/ProjectShim.js", parameters);
			}
			default:
				throw new Error(
					`Unable to create Specification instance: Unknown specification type '${type}'`);
		}
	}

	constructor() {
		if (new.target === Specification) {
			throw new TypeError("Class 'Specification' is abstract. Please use one of the 'types' subclasses");
		}
		this._log = getLogger(`specifications:types:${this.constructor.name}`);
	}

	/**
	 * @param parameters Specification parameters
	 * @param parameters.id Unique ID
	 * @param parameters.version Version
	 * @param parameters.modulePath Absolute File System path to access resources
	 * @param parameters.configuration Configuration object
	 */
	async init({id, version, modulePath, configuration}: {
		id: string;
		version: string;
		modulePath: string;
		configuration: object;
	}) {
		if (!id) {
			throw new Error(`Could not create Specification: Missing or empty parameter 'id'`);
		}
		if (!version) {
			throw new Error(`Could not create Specification: Missing or empty parameter 'version'`);
		}
		if (!modulePath) {
			throw new Error(`Could not create Specification: Missing or empty parameter 'modulePath'`);
		}
		if (!path.isAbsolute(modulePath)) {
			throw new Error(`Could not create Specification: Parameter 'modulePath' must contain an absolute path`);
		}
		if (!configuration) {
			throw new Error(`Could not create Specification: Missing or empty parameter 'configuration'`);
		}

		this._version = version;
		this._modulePath = modulePath;

		// The ID property is filled from the provider (e.g. package.json "name") and might differ between providers.
		// It is mainly used to detect framework libraries marked by @openui5 / @sapui5 scopes of npm package.
		// (see Project#isFrameworkProject)
		// In general, the configured name (metadata.name) should be used instead as the unique identifier of a project.
		this.__id = id;

		// Deep clone config to prevent changes by reference
		const config = JSON.parse(JSON.stringify(configuration)) as SpecificationConfiguration;
		const {validate} = await import("../validation/validator.js");

		if (SpecificationVersion.major(config.specVersion) <= 1) {
			const originalSpecVersion = config.specVersion;
			this._log.verbose(`Detected legacy Specification Version ${config.specVersion}, defined for ` +
			`${config.kind} ${config.metadata.name}. ` +
			`Attempting to migrate the project to a supported specification version...`);
			this._migrateLegacyProject(config as LegacySpecificationConfiguration);
			try {
				await validate({
					config,
					project: {
						id,
					},
				});
			} catch (err) {
				if (err instanceof Error) {
					this._log.verbose(
						`Validation error after migration of ${config.kind} ${config.metadata.name}:`);
					this._log.verbose(err.message);
					throw new Error(
						`${config.kind} ${config.metadata.name} defines unsupported Specification Version ` +
						`${originalSpecVersion}. Please manually upgrade to 3.0 or higher. ` +
						`For details see https://sap.github.io/ui5-tooling/pages/Configuration/#specification-versions - ` +
						`An attempted migration to a supported specification version failed, ` +
						`likely due to unrecognized configuration. Check verbose log for details.`);
				}
				throw err;
			}
		} else {
			await validate({
				config,
				project: {
					id,
				},
			});
		}

		// Check whether the given configuration matches the class by guessing the type name from the class name
		if (config.type.replace("-", "") !== this.constructor.name.toLowerCase()) {
			throw new Error(
				`Configuration mismatch: Supplied configuration of type '${config.type}' does not match with ` +
				`specification class ${this.constructor.name}`);
		}

		this._name = config.metadata.name;
		this._kind = config.kind;
		this._type = config.type;
		this._specVersionString = config.specVersion;
		this._specVersion = new SpecificationVersion(this._specVersionString);
		this._config = config;

		return this;
	}

	/* === Attributes === */
	/**
	 * Gets the ID of this specification.
	 *
	 * <p><b>Note: </b>Only to be used for special occasions as it is specific to the provider that was used and does
	 * not necessarily represent something defined by the project.</p>
	 *
	 * For general purposes of a unique identifier use
	 * {@link @ui5/project/specifications/Specification#getName getName} instead.
	 *
	 * @returns Specification ID
	 */
	public getId() {
		return this.__id;
	}

	/**
	 * Gets the name of this specification. Represents a unique identifier.
	 *
	 * @returns Specification name
	 */
	public getName() {
		return this._name;
	}

	/**
	 * Gets the kind of this specification, for example <code>project</code> or <code>extension</code>
	 *
	 * @returns Specification kind
	 */
	public getKind() {
		return this._kind;
	}

	/**
	 * Gets the type of this specification,
	 * for example <code>application</code> or <code>library</code> in case of projects,
	 * and <code>task</code> or <code>server-middleware</code> in case of extensions
	 *
	 * @returns Specification type
	 */
	public getType() {
		return this._type;
	}

	/**
	 * Returns an instance of a helper class representing a Specification Version
	 *
	 * @returns
	 */
	public getSpecVersion() {
		return this._specVersion;
	}

	/**
	 * Gets the specification's generic version, as typically defined in a <code>package.json</code>
	 *
	 * @returns Project version
	 */
	public getVersion() {
		return this._version;
	}

	/**
	 * Gets the specification's file system path. This might not be POSIX-style on some platforms
	 *
	 * @returns Project root path
	 */
	public getRootPath() {
		return this._modulePath;
	}

	/* === Resource Access === */
	/**
	 * Gets a [ReaderCollection]{@link @ui5/fs/ReaderCollection} for the root directory of the specification.
	 * Resource readers always use POSIX-style
	 *
	 * @param [parameters] Parameters
	 * @param [parameters.useGitignore]
	 *   Whether to apply any excludes defined in an optional .gitignore in the root directory
	 * @returns Reader collection
	 */
	public getRootReader({useGitignore = true}: {
		useGitignore?: boolean;
	} = {}) {
		return createReader({
			fsBasePath: this.getRootPath(),
			virBasePath: "/",
			name: `Root reader for ${this.getType()} ${this.getKind()} ${this.getName()}`,
			useGitignore,
		});
	}

	private async _dirExists(dirPath: string) {
		const resource = await this.getRootReader().byPath(dirPath, {nodir: false});
		if (resource?.getStatInfo().isDirectory()) {
			return true;
		}
		return false;
	}

	_migrateLegacyProject(config: LegacySpecificationConfiguration) {
		// Stick to 2.6 since 3.0 adds further restrictions (i.e. for the name) and enables
		// functionality for extensions that shouldn't be enabled if the specVersion is not
		// explicitly set to 3.x
		config.specVersion = "2.6";

		// propertiesFileSourceEncoding (relevant for applications and libraries) default
		// has been changed to UTF-8 with specVersion 2.0
		// Adding back the old default if no configuration is provided.
		if (config.kind === "project" && ["application", "library"].includes(config.type) &&
			!config.resources?.configuration?.propertiesFileSourceEncoding) {
			config.resources = config.resources ?? {};
			config.resources.configuration = config.resources.configuration ?? {};
			config.resources.configuration.propertiesFileSourceEncoding = "ISO-8859-1";
		}
	}
}

async function createAndInitializeSpec(moduleName: string, params: SpecificationParameters) {
	const {default: Spec} = await import(`./${moduleName}`) as {default: typeof Specification};
	return new Spec().init(params);
}

export default Specification;
