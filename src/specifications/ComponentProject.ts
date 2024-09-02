import Project, {type ProjectReaderStyle, type ProjectReaderOptions} from "./Project.js";
import * as resourceFactory from "@ui5/fs/resourceFactory";
import type ReaderCollection from "@ui5/fs/ReaderCollection";
import type AbstractReaderWriter from "@ui5/fs/AbstractReaderWriter";
import type AbstractReader from "@ui5/fs/AbstractReader";

type MavenPropertyValue = string | Record<string, MavenProperty>;
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
interface MavenProperty {
	[key: string]: MavenPropertyValue;
}

interface Pom extends MavenProperty {
	project: {
		properties: Record<string, string>;
	};
}

export interface Manifest {
	"sap.app"?: {
		id: string;
		applicationVersion: {
			version: string;
		};
	};
};

/**
 * Subclass for projects potentially containing Components
 *
 * @hideconstructor
 */
abstract class ComponentProject extends Project {
	_pPom: null | Promise<Pom> = null;
	_namespace!: string; // Must be set during initialization of child class
	_isRuntimeNamespaced: boolean;
	_writers: undefined | {
		namespaceWriter: AbstractReaderWriter;
		generalWriter: AbstractReaderWriter;
		collection: AbstractReaderWriter;
	};

	constructor() {
		super();
		if (new.target === ComponentProject) {
			throw new TypeError("Class 'ComponentProject' is abstract. Please use one of the 'types' subclasses");
		}

		this._isRuntimeNamespaced = true;
	}

	/* === Attributes === */
	/**
	 * Get the project namespace
	 *
	 * @returns Project namespace in slash notation (e.g. <code>my/project/name</code>)
	 */
	public getNamespace() {
		return this._namespace;
	}

	public getCopyright() {
		return this._config.metadata.copyright;
	}

	public getComponentPreloadPaths() {
		return this._config.builder?.componentPreload?.paths ?? [];
	}

	public getComponentPreloadNamespaces() {
		return this._config.builder?.componentPreload?.namespaces ?? [];
	}

	public getComponentPreloadExcludes() {
		return this._config.builder?.componentPreload?.excludes ?? [];
	}

	public getMinificationExcludes() {
		return this._config.builder?.minification?.excludes ?? [];
	}

	public getBundles() {
		return this._config.builder?.bundles ?? [];
	}

	public getPropertiesFileSourceEncoding() {
		return this._config.resources?.configuration?.propertiesFileSourceEncoding ?? "UTF-8";
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
	 * If project resources have been changed through the means of a workspace, those changes
	 * are reflected in the provided reader too.
	 *
	 * Resource readers always use POSIX-style paths.
	 *
	 * @param [options] Reader options
	 * @param [options.style] Path style to access resources.
	 *   Can be "buildtime", "dist", "runtime" or "flat"
	 * @returns A reader collection instance
	 */
	public getReader({style = "buildtime"}: ProjectReaderOptions = {}) {
		// TODO: Additional style 'ABAP' using "sap.platform.abap".uri from manifest.json?

		// Apply builder excludes to all styles but "runtime"
		const excludes = style === "runtime" ? [] : this.getBuilderResourcesExcludes();

		if ((style === "runtime" || style === "dist") && this._isRuntimeNamespaced) {
			// If the project's type requires a namespace at runtime, the
			// dist- and runtime-style paths are identical to buildtime-style paths
			style = "buildtime";
		}
		let reader = this._getReader(excludes);
		switch (style) {
			case "buildtime":
				break;
			case "runtime":
			case "dist":
			// Use buildtime reader and link it to /
			// No test-resources for runtime resource access,
			// unless runtime is namespaced
				reader = resourceFactory.createFlatReader({
					reader,
					namespace: this._namespace,
				});
				break;
			case "flat":
			// Use buildtime reader and link it to /
			// No test-resources for runtime resource access,
			// unless runtime is namespaced
				reader = resourceFactory.createFlatReader({
					reader,
					namespace: this._namespace,
				});
				break;
			default:
				// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
				throw new Error(`Unknown path mapping style ${style}`);
		}

		reader = this._addWriter(reader, style);
		return reader;
	}

	/**
	 * Get a resource reader for the resources of the project
	 *
	 * @returns Reader collection
	 */
	protected abstract _getSourceReader(excludes: string[]): AbstractReader;

	/**
	 * Get a resource reader for the test resources of the project
	 *
	 * @returns Reader collection or null if no dedicated test path exists
	 */
	protected abstract _getTestReader(excludes: string[]): AbstractReader | null;

	/**
	 * Get a resource reader/writer for accessing and modifying a project's resources
	 *
	 * @returns A reader collection instance
	 */
	public getWorkspace() {
		// Workspace is always of style "buildtime"
		// Therefore builder resource-excludes are always to be applied
		const excludes = this.getBuilderResourcesExcludes();
		return resourceFactory.createWorkspace({
			name: `Workspace for project ${this.getName()}`,
			reader: this._getReader(excludes),
			writer: this._getWriter().collection,
		});
	}

	_getWriter() {
		if (this._writers) {
			return this._writers;
		}
		// writer is always of style "buildtime"
		const namespaceWriter = resourceFactory.createAdapter({
			virBasePath: "/",
			project: this,
		});

		const generalWriter = resourceFactory.createAdapter({
			virBasePath: "/",
			project: this,
		});

		const collection = resourceFactory.createWriterCollection({
			name: `Writers for project ${this.getName()}`,
			writerMapping: {
				[`/resources/${this._namespace}/`]: namespaceWriter,
				[`/test-resources/${this._namespace}/`]: namespaceWriter,
				[`/`]: generalWriter,
			},
		});

		this._writers = {
			namespaceWriter,
			generalWriter,
			collection,
		};
		return this._writers;
	}

	_getReader(excludes: string[]) {
		let reader = this._getSourceReader(excludes);
		const testReader = this._getTestReader(excludes);
		if (testReader) {
			reader = resourceFactory.createReaderCollection({
				name: `Reader collection for project ${this.getName()}`,
				readers: [reader, testReader],
			});
		}
		return reader;
	}

	_addWriter(reader: AbstractReader, style: ProjectReaderStyle): ReaderCollection {
		const {namespaceWriter, generalWriter} = this._getWriter();

		if ((style === "runtime" || style === "dist") && this._isRuntimeNamespaced) {
			// If the project's type requires a namespace at runtime, the
			// dist- and runtime-style paths are identical to buildtime-style paths
			style = "buildtime";
		}
		const readers = [];
		switch (style) {
			case "buildtime":
			// Writer already uses buildtime style
				readers.push(namespaceWriter);
				readers.push(generalWriter);
				break;
			case "runtime":
			case "dist":
			// Runtime is not namespaced: link namespace to /
				readers.push(resourceFactory.createFlatReader({
					reader: namespaceWriter,
					namespace: this._namespace,
				}));
				// Add general writer as is
				readers.push(generalWriter);
				break;
			case "flat":
			// Rewrite paths from "flat" to "buildtime"
				readers.push(resourceFactory.createFlatReader({
					reader: namespaceWriter,
					namespace: this._namespace,
				}));
				// General writer resources can't be flattened, so they are not available
				break;
		}
		readers.push(reader);

		return resourceFactory.createReaderCollectionPrioritized({
			name: `Reader/Writer collection for project ${this.getName()}`,
			readers,
		});
	}

	protected abstract _getNamespace(): Promise<string>;

	/* === Helper === */
	/**
	 * Checks whether a given string contains a maven placeholder.
	 * E.g. <code>${appId}</code>.
	 *
	 * @param value String to check
	 * @returns True if given string contains a maven placeholder
	 */
	_hasMavenPlaceholder(value: string) {
		return !!(/^\$\{(.*)\}$/.exec(value));
	}

	/**
	 * Resolves a maven placeholder in a given string using the projects pom.xml
	 *
	 * @param value String containing a maven placeholder
	 * @returns Resolved string
	 */
	async _resolveMavenPlaceholder(value: string) {
		const parts = value && (/^\$\{(.*)\}$/.exec(value));
		if (parts) {
			this._log.verbose(
				`"${value}" contains a maven placeholder "${parts[1]}". Resolving from projects pom.xml...`);
			const pom = await this._getPom();
			let mvnValue: string;
			if (pom.project?.properties?.[parts[1]]) {
				mvnValue = pom.project.properties[parts[1]];
			} else {
				let obj: MavenProperty = pom;
				parts[1].split(".").forEach((part) => {
					obj = obj?.[part] as MavenProperty;
				});
				mvnValue = obj as unknown as string;
			}
			if (!mvnValue) {
				throw new Error(`"${value}" couldn't be resolved from maven property ` +
					`"${parts[1]}" of pom.xml of project ${this.getName()}`);
			}
			return mvnValue;
		} else {
			throw new Error(`"${value}" is not a maven placeholder`);
		}
	}

	/**
	 * Reads the projects pom.xml file
	 *
	 * @returns Resolves with a JSON representation of the content
	 */
	async _getPom() {
		if (this._pPom) {
			return this._pPom;
		}

		return this._pPom = this.getRootReader().byPath("/pom.xml")
			.then(async (resource) => {
				if (!resource) {
					throw new Error(
						`Could not find pom.xml in project ${this.getName()}`);
				}
				const content = await resource.getString();
				const {Parser} = await import("xml2js");
				const parser = new Parser({
					explicitArray: false,
					ignoreAttrs: true,
				});
				return parser.parseStringPromise(content) as Promise<Pom>;
			}).catch((err) => {
				if (err instanceof Error) {
					throw new Error(
						`Failed to read pom.xml for project ${this.getName()}: ${err.message}`);
				}
				throw err;
			});
	}
}

export default ComponentProject;
