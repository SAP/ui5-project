import Specification, {type SpecificationConfiguration, type SpecificationParameters} from "./Specification.js";
import type AbstractReader from "@ui5/fs/AbstractReader";
import type DuplexCollection from "@ui5/fs/DuplexCollection";
import ResourceTagCollection from "@ui5/fs/internal/ResourceTagCollection";
import {type BuildManifest} from "../build/helpers/createBuildManifest.js";

interface ProjectParameters extends SpecificationParameters {
	buildManifest?: BuildManifest;
}

export interface TaskDefinition {
	name: string;
	beforeTask?: string;
	afterTask?: string;
	configuration?: unknown;
}

export interface ProjectConfiguration extends SpecificationConfiguration {
	metadata: {
		name: string;
		copyright?: string;
		deprecated?: boolean;
		sapInternal?: boolean;
		allowSapInternal?: boolean;
	};
	resources?: {
		configuration?: {
			propertiesFileSourceEncoding: string;
			paths: Record<string, string>;
		};
	};
	framework?: {
		name: string;
		version: string;
		libraries?: {
			name: string;
			development?: boolean;
			optional?: boolean;
		}[];
	};
	builder?: {
		resources?: {
			excludes: string[];
		};
		customTasks?: TaskDefinition[];
		settings?: object;
		componentPreload?: {
			paths?: string[];
			namespaces?: string[];
			excludes?: string[];
		};
		libraryPreload?: {
			excludes?: string[];
		};
		minification?: {
			excludes?: string[];
		};
		jsdoc?: {
			excludes?: string[];
		};
		bundles?: object[];
		cachebuster?: {
			signatureType: "time" | "hash";
		};
	};
	server?: {
		customMiddleware?: string[];
		settings?: object;
	};
	customConfiguration?: object;
}

export type ProjectReaderStyle = "buildtime" | "dist" | "runtime" | "flat";

export interface ProjectReaderOptions {
	style?: ProjectReaderStyle;
}

/**
 * Project
 *
 * @hideconstructor
 */
abstract class Project extends Specification {
	_resourceTagCollection: ResourceTagCollection | null;
	_buildManifest?: BuildManifest;
	declare _config: ProjectConfiguration;

	constructor() {
		super();
		if (new.target === Project) {
			throw new TypeError("Class 'Project' is abstract. Please use one of the 'types' subclasses");
		}

		this._resourceTagCollection = null;
	}

	/**
	 * @param parameters Specification parameters
	 * @param parameters.id Unique ID
	 * @param parameters.version Version
	 * @param parameters.modulePath File System path to access resources
	 * @param parameters.configuration Configuration object
	 * @param [parameters.buildManifest] Build metadata object
	 */
	async init(parameters: ProjectParameters) {
		await super.init(parameters);

		this._buildManifest = parameters.buildManifest;

		await this._configureAndValidatePaths(this._config);
		await this._parseConfiguration(this._config, this._buildManifest);

		return this;
	}

	/* === Attributes === */
	/**
	 * Get the project namespace. Returns `null` for projects that have none or multiple namespaces,
	 * for example Modules or Theme Libraries.
	 *
	 * @returns Project namespace in slash notation (e.g. <code>my/project/name</code>) or null
	 */
	public getNamespace(): string | null {
		// Default namespace for general Projects:
		// Their resources should be structured with globally unique paths, hence their namespace is undefined
		return null;
	}

	/**
	 * Check whether the project is a UI5-Framework project
	 *
	 * @returns True if the project is a framework project
	 */
	public isFrameworkProject() {
		const id = this.getId();
		return id.startsWith("@openui5/") || id.startsWith("@sapui5/");
	}

	/**
	 * Get the project's customConfiguration
	 *
	 * @returns Custom Configuration
	 */
	public getCustomConfiguration() {
		return this._config.customConfiguration;
	}

	// eslint-disable-next-line jsdoc/require-returns-check
	/**
	 * Get the path of the project's source directory. This might not be POSIX-style on some platforms.
	 * Projects with multiple source paths will throw an error. For example Modules.
	 *
	 * @returns Absolute path to the source directory of the project
	 * @throws {Error} In case a project has multiple source directories
	 */
	public getSourcePath() {
		throw new Error(`getSourcePath must be implemented by subclass ${this.constructor.name}`);
	}

	/**
	 * Get the project's framework name configuration
	 *
	 * @returns Framework name configuration, either <code>OpenUI5</code> or <code>SAPUI5</code>
	 */
	public getFrameworkName() {
		return this._config.framework?.name;
	}

	/**
	 * Get the project's framework version configuration
	 *
	 * @returns Framework version configuration, e.g <code>1.110.0</code>
	 */
	public getFrameworkVersion() {
		return this._config.framework?.version;
	}

	/**
	 * Framework dependency entry of the project configuration.
	 * Also see [Framework Configuration: Dependencies]{@link https://sap.github.io/ui5-tooling/stable/pages/Configuration/#dependencies}
	 *
	 * name Name of the framework library. For example <code>sap.ui.core</code>
	 *
	 * development Whether the dependency is meant for development purposes only
	 *
	 * optional Whether the dependency should be treated as optional
	 */

	/**
	 * Get the project's framework dependencies configuration
	 *
	 * @returns Framework dependencies configuration
	 */
	public getFrameworkDependencies() {
		return this._config.framework?.libraries ?? [];
	}

	/**
	 * Get the project's deprecated configuration
	 *
	 * @returns True if the project is flagged as deprecated
	 */
	private isDeprecated() {
		return !!this._config.metadata.deprecated;
	}

	/**
	 * Get the project's sapInternal configuration
	 *
	 * @returns True if the project is flagged as SAP-internal
	 */
	private isSapInternal() {
		return !!this._config.metadata.sapInternal;
	}

	/**
	 * Get the project's allowSapInternal configuration
	 *
	 * @returns True if the project allows for using SAP-internal projects
	 */
	private getAllowSapInternal() {
		return !!this._config.metadata.allowSapInternal;
	}

	/**
	 * Get the project's builderResourcesExcludes configuration
	 *
	 * @returns BuilderResourcesExcludes configuration
	 */
	protected getBuilderResourcesExcludes() {
		return this._config.builder?.resources?.excludes ?? [];
	}

	/**
	 * Get the project's customTasks configuration
	 *
	 * @returns CustomTasks configuration
	 */
	public getCustomTasks() {
		return this._config.builder?.customTasks ?? [];
	}

	/**
	 * Get the project's customMiddleware configuration
	 *
	 * @returns CustomMiddleware configuration
	 */
	private getCustomMiddleware() {
		return this._config.server?.customMiddleware ?? [];
	}

	/**
	 * Get the project's serverSettings configuration
	 *
	 * @returns ServerSettings configuration
	 */
	private getServerSettings() {
		return this._config.server?.settings;
	}

	/**
	 * Get the project's builderSettings configuration
	 *
	 * @returns BuilderSettings configuration
	 */
	private getBuilderSettings() {
		return this._config.builder?.settings;
	}

	/**
	 * Get the project's buildManifest configuration
	 *
	 * @returns BuildManifest configuration or null if none is available
	 */
	public getBuildManifest() {
		return this._buildManifest ?? null;
	}

	/* === Resource Access === */
	/**
	 * Get a [ReaderCollection]{@link @ui5/fs/ReaderCollection} for accessing all resources of the
	 * project in the specified "style":
	 *
	 * <ul>
	 * <li><b>buildtime:</b> Resource paths are always prefixed with <code>/resources/</code>
	 *  or <code>/test-resources/</code> followed by the project's namespace.
	 *  Any configured build-excludes are applied</li>
	 * <li><b>dist:</b> Resource paths always match with what the UI5 runtime expects.
	 *  This means that paths generally depend on the project type. Applications for example use a "flat"-like
	 *  structure, while libraries use a "buildtime"-like structure.
	 *  Any configured build-excludes are applied</li>
	 * <li><b>runtime:</b> Resource paths always match with what the UI5 runtime expects.
	 *  This means that paths generally depend on the project type. Applications for example use a "flat"-like
	 *  structure, while libraries use a "buildtime"-like structure.
	 *  This style is typically used for serving resources directly. Therefore, build-excludes are not applied
	 * <li><b>flat:</b> Resource paths are never prefixed and namespaces are omitted if possible. Note that
	 *  project types like "theme-library", which can have multiple namespaces, can't omit them.
	 *  Any configured build-excludes are applied</li>
	 * </ul>
	 *
	 * Resource readers always use POSIX-style paths.
	 *
	 * @param [options]
	 * @param [options.style] Path style to access resources.
	 *   Can be "buildtime", "dist", "runtime" or "flat"
	 * @returns Reader collection allowing access to all resources of the project
	 */
	abstract getReader(options?: ProjectReaderOptions): AbstractReader;

	public getResourceTagCollection(): ResourceTagCollection {
		if (!this._resourceTagCollection) {
			this._resourceTagCollection = new ResourceTagCollection({
				allowedTags: ["ui5:IsDebugVariant", "ui5:HasDebugVariant"],
				allowedNamespaces: ["project"],
				tags: this.getBuildManifest()?.tags,
			});
		}
		return this._resourceTagCollection;
	}

	/**
	 * Get a [DuplexCollection]{@link @ui5/fs/DuplexCollection} for accessing and modifying a
	 * project's resources. This is always of style <code>buildtime</code>.
	 *
	 * @returns DuplexCollection
	 */
	abstract getWorkspace(): DuplexCollection;

	protected abstract _configureAndValidatePaths(config: ProjectConfiguration): Promise<void>;

	protected abstract _parseConfiguration(config: ProjectConfiguration, buildManifest?: BuildManifest): Promise<void>;
}

export default Project;
