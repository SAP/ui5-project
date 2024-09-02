import {type ResourceInterface} from "@ui5/fs/Resource";
import {
	createReaderCollection,
	createReaderCollectionPrioritized,
	createResource,
	createFilterReader,
	createLinkReader,
	createFlatReader,
} from "@ui5/fs/resourceFactory";
import type * as resourceFactory from "@ui5/fs/resourceFactory";
import type ProjectBuildContext from "./ProjectBuildContext.js";
import type SpecificationVersion from "../../specifications/SpecificationVersion.js";
import {type BuildContextOptions} from "./BuildContext.js";
import {type CleanupCallback} from "./ProjectBuildContext.js";
import type Project from "../../specifications/Project.js";

export interface TaskUtilInterfaceBase extends Pick<TaskUtil,
"setTag" | "clearTag" | "getTag" | "isRootProject" | "registerCleanupTask"> {
	STANDARD_TAGS: object;
}

type ProjectInterface3_0 = Pick<Project,
"getType" | "getName" | "getVersion" | "getNamespace" | "getRootReader" | "getReader" |
"getRootPath" | "getSourcePath" | "getCustomConfiguration" | "isFrameworkProject" | "getFrameworkName" |
"getFrameworkVersion" | "getFrameworkDependencies">;

type ResourceFactoryInterface = {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	[key in keyof typeof resourceFactory]: Function;
};

interface ResourceFactoryInterface_3_0 extends ResourceFactoryInterface {
	createResource: typeof createResource;
	createReaderCollection: typeof createReaderCollection;
	createReaderCollectionPrioritized: typeof createReaderCollectionPrioritized;
	createFilterReader: typeof createFilterReader;
	createLinkReader: typeof createLinkReader;
	createFlatReader: typeof createFlatReader;
}

export interface TaskUtilInterface3_0 extends TaskUtilInterfaceBase {
	getProject(projectNameOrResource?: string | ResourceInterface): ProjectInterface3_0 | undefined;
	getDependencies: TaskUtil["getDependencies"];
	resourceFactory: ResourceFactoryInterface_3_0;
}

/**
 * Convenience functions for UI5 tasks.
 * An instance of this class is passed to every standard UI5 task that requires it.
 *
 * Custom tasks that define a specification version >= 2.2 will receive an interface
 * to an instance of this class when called.
 * The set of available functions on that interface depends on the specification
 * version defined for the extension.
 *
 * @hideconstructor
 */
class TaskUtil {
	/**
	 * Standard Build Tags. See UI5 Tooling
	 * [RFC 0008]{@link https://github.com/SAP/ui5-tooling/blob/main/rfcs/0008-resource-tagging-during-build.md}
	 * for details.
	 *
	 * OmitFromBuildResult
	 * Setting this tag to true will prevent the resource from being written to the build target directory
	 *
	 * IsBundle
	 * This tag identifies resources that contain (i.e. bundle) multiple other resources
	 *
	 * IsDebugVariant
	 * This tag identifies resources that are a debug variant (typically named with a "-dbg" suffix)
	 * of another resource. This tag is part of the build manifest.
	 *
	 * HasDebugVariant
	 * 		This tag identifies resources for which a debug variant has been created.
	 * 		This tag is part of the build manifest.
	 */

	/**
	 * Since <code>@ui5/project/build/helpers/ProjectBuildContext</code> is a private class, TaskUtil must not be
	 * instantiated by modules other than @ui5/project itself.
	 *
	 * @param parameters
	 * @param parameters.projectBuildContext ProjectBuildContext
	 */
	STANDARD_TAGS: object;

	_projectBuildContext: ProjectBuildContext;

	constructor({projectBuildContext}: {projectBuildContext: ProjectBuildContext}) {
		this._projectBuildContext = projectBuildContext;
		/**
		 */
		this.STANDARD_TAGS = Object.freeze({
			// "Project" tags:
			// Will be stored on project instance and are hence part of the build manifest
			IsDebugVariant: "ui5:IsDebugVariant",
			HasDebugVariant: "ui5:HasDebugVariant",

			// "Build" tags:
			// Will be stored on the project build context
			// They are only available to the build tasks of a single project
			OmitFromBuildResult: "ui5:OmitFromBuildResult",
			IsBundle: "ui5:IsBundle",
		});
	}

	/**
	 * Stores a tag with value for a given resource's path. Note that the tag is independent of the supplied
	 * resource instance. For two resource instances with the same path, the same tag value is returned.
	 * If the path of a resource is changed, any tag information previously stored for that resource is lost.
	 *
	 * </br></br>
	 * This method is only available to custom task extensions defining
	 * <b>Specification Version 2.2 and above</b>.
	 *
	 * @param resource Resource-instance the tag should be stored for
	 * @param tag Name of the tag. Currently only the
	 * 	[STANDARD_TAGS]{@link @ui5/project/build/helpers/TaskUtil#STANDARD_TAGS} are allowed
	 * @param [value] Tag value. Must be primitive
	 */
	public setTag(resource: ResourceInterface, tag: string, value?: string | boolean | number) {
		if (typeof resource === "string") {
			throw new Error("Deprecated parameter: " +
				"Since UI5 Tooling 3.0, #setTag requires a resource instance. Strings are no longer accepted");
		}

		const collection = this._projectBuildContext.getResourceTagCollection(resource, tag);
		return collection.setTag(resource, tag, value);
	}

	/**
	 * Retrieves the value for a stored tag. If no value is stored, <code>undefined</code> is returned.
	 *
	 * </br></br>
	 * This method is only available to custom task extensions defining
	 * <b>Specification Version 2.2 and above</b>.
	 *
	 * @param resource Resource-instance the tag should be retrieved for
	 * @param tag Name of the tag
	 * @returns Tag value for the given resource.
	 * 										<code>undefined</code> if no value is available
	 */
	public getTag(resource: ResourceInterface, tag: string) {
		if (typeof resource === "string") {
			throw new Error("Deprecated parameter: " +
				"Since UI5 Tooling 3.0, #getTag requires a resource instance. Strings are no longer accepted");
		}
		const collection = this._projectBuildContext.getResourceTagCollection(resource, tag);
		return collection.getTag(resource, tag);
	}

	/**
	 * Clears the value of a tag stored for the given resource's path.
	 * It's like the tag was never set for that resource.
	 *
	 * </br></br>
	 * This method is only available to custom task extensions defining
	 * <b>Specification Version 2.2 and above</b>.
	 *
	 * @param resource Resource-instance the tag should be cleared for
	 * @param tag Tag
	 */
	public clearTag(resource: ResourceInterface, tag: string) {
		if (typeof resource === "string") {
			throw new Error("Deprecated parameter: " +
				"Since UI5 Tooling 3.0, #clearTag requires a resource instance. Strings are no longer accepted");
		}
		const collection = this._projectBuildContext.getResourceTagCollection(resource, tag);
		return collection.clearTag(resource, tag);
	}

	/**
	 * Check whether the project currently being built is the root project.
	 *
	 * </br></br>
	 * This method is only available to custom task extensions defining
	 * <b>Specification Version 2.2 and above</b>.
	 *
	 * @returns <code>true</code> if the currently built project is the root project
	 */
	public isRootProject() {
		return this._projectBuildContext.isRootProject();
	}

	/**
	 * Retrieves a build option defined by its <code>key</code.
	 * If no option with the given <code>key</code> is stored, <code>undefined</code> is returned.
	 *
	 * @param key The option key
	 * @returns The build option (or undefined)
	 */
	public getBuildOption(key: BuildContextOptions) {
		return this._projectBuildContext.getOption(key);
	}

	/**
	 * Callback that is executed once the build has finished
	 *
	 * @param {boolean} force Whether the cleanup callback should
	 * 							gracefully wait for certain jobs to be completed (<code>false</code>)
	 * 							or enforce immediate termination (<code>true</code>)
	 */

	/**
	 * Register a function that must be executed once the build is finished. This can be used to, for example,
	 * clean up files temporarily created on the file system. If the callback returns a Promise, it will be waited for.
	 * It will also be executed in cases where the build has failed or has been aborted.
	 *
	 * </br></br>
	 * This method is only available to custom task extensions defining
	 * <b>Specification Version 2.2 and above</b>.
	 *
	 * @param callback Callback to
	 * 									register; it will be waited for if it returns a Promise
	 */
	public registerCleanupTask(callback: CleanupCallback) {
		return this._projectBuildContext.registerCleanupTask(callback);
	}

	/**
	 * Specification Version-dependent [Project]{@link @ui5/project/specifications/Project} interface.
	 * For details on individual functions, see [Project]{@link @ui5/project/specifications/Project}
	 *
	 * getType Get the project type
	 *
	 * getName Get the project name
	 *
	 * getVersion Get the project version
	 *
	 * getNamespace Get the project namespace
	 *
	 * getRootReader Get the project rootReader
	 *
	 * getReader Get the project reader
	 *
	 * getRootPath Get the local File System path of the project's root directory
	 *
	 * getSourcePath Get the local File System path of the project's source directory
	 *
	 * getCustomConfiguration Get the project Custom Configuration
	 *
	 * isFrameworkProject Check whether the project is a UI5-Framework project
	 *
	 * getFrameworkName Get the project's framework name configuration
	 *
	 * getFrameworkVersion Get the project's framework version configuration
	 *
	 * getFrameworkDependencies Get the project's framework dependencies configuration
	 */

	/**
	 * Retrieve a single project from the dependency graph
	 *
	 * </br></br>
	 * This method is only available to custom task extensions defining
	 * <b>Specification Version 3.0 and above</b>.
	 *
	 * @param [projectNameOrResource]
	 * Name of the project to retrieve or a Resource instance to retrieve the associated project for.
	 * Defaults to the name of the project currently being built
	 * @returns
	 * Specification Version-dependent interface to the Project instance or <code>undefined</code>
	 * if the project name is unknown or the provided resource is not associated with any project.
	 */
	public getProject(projectNameOrResource?: string | ResourceInterface): Project | undefined {
		if (projectNameOrResource) {
			if (typeof projectNameOrResource === "string" || projectNameOrResource instanceof String) {
				// A project name has been provided
				return this._projectBuildContext.getProject(projectNameOrResource as string);
			} else {
				// A Resource instance has been provided
				return projectNameOrResource.getProject() as Project;
			}
		}
		// No parameter has been provided, default to the project currently being built.
		return this._projectBuildContext.getProject();
	}

	/**
	 * Retrieve a list of direct dependencies of a given project from the dependency graph.
	 * Note that this list does not include transitive dependencies.
	 *
	 * </br></br>
	 * This method is only available to custom task extensions defining
	 * <b>Specification Version 3.0 and above</b>.
	 *
	 * @param [projectName] Name of the project to retrieve. Defaults to the project currently being built
	 * @returns Names of all direct dependencies
	 * @throws {Error} If the requested project is unknown to the graph
	 */
	public getDependencies(projectName?: string) {
		return this._projectBuildContext.getDependencies(projectName);
	}

	/**
	 * Specification Version-dependent set of [@ui5/fs/resourceFactory]{@link @ui5/fs/resourceFactory}
	 * functions provided to tasks.
	 * For details on individual functions, see [@ui5/fs/resourceFactory]{@link @ui5/fs/resourceFactory}
	 *
	 * createResource Creates a [Resource]{@link @ui5/fs/Resource}.
	 * Accepts the same parameters as the [Resource]{@link @ui5/fs/Resource} constructor.
	 *
	 * createReaderCollection Creates a reader collection:
	 * [ReaderCollection]{@link @ui5/fs/ReaderCollection}
	 *
	 * createReaderCollectionPrioritized Creates a prioritized reader collection:
	 * [ReaderCollectionPrioritized]{@link @ui5/fs/ReaderCollectionPrioritized}
	 *
	 * createFilterReader
	 * Create a [Filter-Reader]{@link @ui5/fs/readers/Filter} with the given reader.
	 *
	 * createLinkReader
	 * Create a [Link-Reader]{@link @ui5/fs/readers/Filter} with the given reader.
	 *
	 * createFlatReader Create a [Link-Reader]{@link @ui5/fs/readers/Link}
	 * where all requests are prefixed with <code>/resources/<namespace></code>.
	 */

	/**
	 * Provides limited access to [@ui5/fs/resourceFactory]{@link @ui5/fs/resourceFactory} functions
	 *
	 * </br></br>
	 * This attribute is only available to custom task extensions defining
	 * <b>Specification Version 3.0 and above</b>.
	 *
	 */
	resourceFactory = {
		createResource,
		createReaderCollection,
		createReaderCollectionPrioritized,
		createFilterReader,
		createLinkReader,
		createFlatReader,
	};

	/**
	 * Get an interface to an instance of this class that only provides those functions
	 * that are supported by the given custom task extension specification version.
	 *
	 * @param specVersion
	 * SpecVersionComparator instance of the custom task
	 * @returns An object with bound instance methods supported by the given specification version
	 */
	getInterface(specVersion: SpecificationVersion): TaskUtilInterfaceBase | TaskUtilInterface3_0 | undefined {
		if (specVersion.lte("2.1")) {
			// Tasks defining specVersion <= 2.1 do not have access to any TaskUtil APIs
			return undefined;
		}

		const baseInterface = bindFunctions(this, [
			"setTag", "clearTag", "getTag", "isRootProject", "registerCleanupTask",
		]) as Partial<TaskUtilInterfaceBase>;

		baseInterface.STANDARD_TAGS = this.STANDARD_TAGS;

		if (specVersion.gte("3.0")) {
			const interface_3_0: Partial<TaskUtilInterface3_0> = baseInterface;
			// getProject function, returning an interfaced project instance
			interface_3_0.getProject = (projectName) => {
				const project = this.getProject(projectName);
				if (!project) {
					return undefined;
				}

				const baseProjectInterface = bindFunctions(project, [
					"getType", "getName", "getVersion", "getNamespace",
					"getRootReader", "getReader", "getRootPath", "getSourcePath",
					"getCustomConfiguration", "isFrameworkProject", "getFrameworkName",
					"getFrameworkVersion", "getFrameworkDependencies",
				]);
				return baseProjectInterface as ProjectInterface3_0;
			};
			// getDependencies function, returning an array of project names
			interface_3_0.getDependencies = (projectName?) => {
				return this.getDependencies(projectName);
			};

			interface_3_0.resourceFactory =
				bindFunctions(this.resourceFactory, [
					// Once new functions get added, extract this array into a variable
					// and enhance based on spec version once new functions get added
					"createResource", "createReaderCollection", "createReaderCollectionPrioritized",
					"createFilterReader", "createLinkReader", "createFlatReader",
				]) as TaskUtilInterface3_0["resourceFactory"];

			// interface_3_0.resourceFactory = Object.create(null) as TaskUtilInterface3_0["resourceFactory"];
			// for (const factoryFunction of TASK_UTIL_INTERFACE_FACTORY_FUNCTIONS_3_0) {
			// 	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
			// 	interface_3_0.resourceFactory[factoryFunction] = this.resourceFactory[factoryFunction] as any;
			// }
			return interface_3_0 as TaskUtilInterface3_0;
		} else {
			return baseInterface as TaskUtilInterfaceBase;
		}
	}
}

function bindFunctions<T, K extends keyof T>(object: T, functions: K[]): Record<K, T[K]> {
	const boundFunctions: Partial<Record<K, T[K]>> = {};
	functions.forEach((func) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-function-type
		boundFunctions[func] = (object[func] as Function).bind(object);
	});
	return boundFunctions as Record<K, T[K]>;
}

export default TaskUtil;
