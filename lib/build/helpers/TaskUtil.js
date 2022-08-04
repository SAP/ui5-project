/**
 * Convenience functions for UI5 tasks.
 * An instance of this class is passed to every standard UI5 task that requires it.
 *
 * Custom tasks that define a specification version >= 2.2 will receive an interface
 * to an instance of this class when called.
 * The set of available functions on that interface depends on the specification
 * version defined for the extension.
 *
 * @public
 * @memberof module:@ui5/project.build.helpers
 */
class TaskUtil {
	/**
	 * Standard Build Tags. See UI5 Tooling
	 * [RFC 0008]{@link https://github.com/SAP/ui5-tooling/blob/master/rfcs/0008-resource-tagging-during-build.md}
	 * for details.
	 *
	 * @public
	 * @typedef {object} module:@ui5/project.build.helpers.TaskUtil~StandardBuildTags
	 * @property {string} OmitFromBuildResult
	 * 		Setting this tag to true will prevent the resource from being written to the build target directory
	 * @property {string} IsBundle
	 * 		This tag identifies resources that contain (i.e. bundle) multiple other resources
	 * @property {string} IsDebugVariant
	 * 		This tag identifies resources that are a debug variant (typically named with a "-dbg" suffix)
	 * 		of another resource. This tag is part of the build manifest.
	 * @property {string} HasDebugVariant
	 * 		This tag identifies resources for which a debug variant has been created.
	 * 		This tag is part of the build manifest.
	 */

	/**
	 * Since <code>@ui5/project.build.helpers.ProjectBuildContext</code> is a private class, TaskUtil must not be
	 * instantiated by modules other than @ui5/project itself.
	 *
	 * @param {object} parameters
	 * @param {module:@ui5/project.build.helpers.ProjectBuildContext} parameters.projectBuildContext ProjectBuildContext
	 * @public
	 */
	constructor({projectBuildContext}) {
		this._projectBuildContext = projectBuildContext;
		/**
		 * @member {module:@ui5/project.build.helpers.TaskUtil~StandardBuildTags}
		 * @public
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
			IsBundle: "ui5:IsBundle"
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
	 * @param {module:@ui5/fs.Resource} resource Resource-instance the tag should be stored for
	 * @param {string} tag Name of the tag. Currently only the
	 * 	[STANDARD_TAGS]{@link module:@ui5/project.build.helpers.TaskUtil#STANDARD_TAGS} are allowed
	 * @param {string|boolean|integer} [value=true] Tag value. Must be primitive
	 * @public
	 */
	setTag(resource, tag, value) {
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
	 * @param {module:@ui5/fs.Resource} resource Resource-instance the tag should be retrieved for
	 * @param {string} tag Name of the tag
	 * @returns {string|boolean|integer|undefined} Tag value for the given resource.
	 * 										<code>undefined</code> if no value is available
	 * @public
	 */
	getTag(resource, tag) {
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
	 * @param {module:@ui5/fs.Resource} resource Resource-instance the tag should be cleared for
	 * @param {string} tag Tag
	 * @public
	 */
	clearTag(resource, tag) {
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
	 * @returns {boolean} <code>true</code> if the currently built project is the root project
	 * @public
	 */
	isRootProject() {
		return this._projectBuildContext.isRootProject();
	}

	/**
	 * Retrieves a build option defined by its <code>key</code.
	 * If no option with the given <code>key</code> is stored, <code>undefined</code> is returned.
	 *
	 * @param {string} key The option key
	 * @returns {any|undefined} The build option (or undefined)
	 * @private
	 */
	getBuildOption(key) {
		return this._projectBuildContext.getOption(key);
	}

	/**
	 * Register a function that must be executed once the build is finished. This can be used to, for example,
	 * clean up files temporarily created on the file system. If the callback returns a Promise, it will be waited for.
	 * It will also be executed in cases where the build has failed or has been aborted.
	 *
	 * </br></br>
	 * This method is only available to custom task extensions defining
	 * <b>Specification Version 2.2 and above</b>.
	 *
	 * @param {Function} callback Callback to register. If it returns a Promise, it will be waited for
	 * @public
	 */
	registerCleanupTask(callback) {
		return this._projectBuildContext.registerCleanupTask(callback);
	}

	/**
	 * Retrieve a single project from the dependency graph
	 *
	 * </br></br>
	 * This method is only available to custom task extensions defining
	 * <b>Specification Version 3.0 and above</b>.
	 *
	 * @param {string} projectName Name of the project to retrieve
	 * @returns {module:@ui5/project.specifications.Project|undefined}
	 *					project instance or undefined if the project is unknown to the graph
	 * @public
	 */
	getProject(projectName) {
		return this._projectBuildContext.getProject(projectName);
	}

	/**
	 * Get an interface to an instance of this class that only provides those functions
	 * that are supported by the given custom task extension specification version.
	 *
	 * @param {string} specVersion Specification version of custom task extension
	 * @returns {object} An object with bound instance methods supported by the given specification version
	 */
	getInterface(specVersion) {
		if (["0.1", "1.0", "1.1", "2.0", "2.1"].includes(specVersion)) {
			return undefined;
		}

		const baseInterface = {
			STANDARD_TAGS: this.STANDARD_TAGS,
		};
		bindFunctions(this, baseInterface, [
			"setTag", "clearTag", "getTag", "isRootProject", "registerCleanupTask"
		]);
		switch (specVersion) {
		case "2.2":
		case "2.3":
		case "2.4":
		case "2.5":
		case "2.6":
			return baseInterface;
		case "3.0":
			baseInterface.getProject = (projectName) => {
				const project = this.getProject(projectName);
				const baseProjectInterface = {};
				bindFunctions(project, baseProjectInterface, [
					"getName", "getVersion", "getNamespace"
				]);
				switch (specVersion) {
				case "3.0":
					return baseProjectInterface;
				}
			};
			return baseInterface;
		default:
			throw new Error(`TaskUtil: Unknown or unsupported Specification Version ${specVersion}`);
		}
	}
}

function bindFunctions(sourceObject, targetObject, funcNames) {
	funcNames.forEach((funcName) => {
		targetObject[funcName] = sourceObject[funcName].bind(sourceObject);
	});
}

module.exports = TaskUtil;