const ResourceTagCollection = require("@ui5/fs").ResourceTagCollection;
const TaskUtil = require("@ui5/builder").tasks.TaskUtil;

// Note: When adding standard tags, always update the public documentation in TaskUtil
// (Type "module:@ui5/builder.tasks.TaskUtil~StandardBuildTags")
const STANDARD_TAGS = {
	OmitFromBuildResult: "ui5:OmitFromBuildResult",
	IsBundle: "ui5:IsBundle",
};

/**
 * Build context of a single project. Always part of an overall
 * [Build Context]{@link module:@ui5/builder.builder.BuildContext}
 *
 * @private
 * @memberof module:@ui5/builder.builder
 */
class ProjectBuildContext {
	constructor({buildContext, globalTags, project}) {
		if (!buildContext || !globalTags || !project) {
			throw new Error(`One or more mandatory parameters are missing`);
		}
		this._buildContext = buildContext;
		this._project = project;
		this.queues = {
			cleanup: []
		};

		this.STANDARD_TAGS = Object.assign({}, STANDARD_TAGS, globalTags);
		Object.freeze(this.STANDARD_TAGS);

		this._resourceTagCollection = new ResourceTagCollection({
			allowedTags: Object.values(this.STANDARD_TAGS),
			superCollection: this._buildContext.getResourceTagCollection()
		});
	}

	isRootProject() {
		return this._project === this._buildContext.getRootProject();
	}

	getOption(key) {
		return this._buildContext.getOption(key);
	}

	registerCleanupTask(callback) {
		this.queues.cleanup.push(callback);
	}

	async executeCleanupTasks() {
		await Promise.all(this.queues.cleanup.map((callback) => {
			return callback();
		}));
	}

	getResourceTagCollection() {
		return this._resourceTagCollection;
	}

	getTaskUtil() {
		if (!this._taskUtil) {
			this._taskUtil = new TaskUtil({
				projectBuildContext: this
			});
		}

		return this._taskUtil;
	}

	/**
	 * Retrieve a single project from the dependency graph
	 *
	 * @param {string} [projectName] Name of the project to retrieve. Defaults to the project currently being built
	 * @returns {module:@ui5/project.specifications.Project|undefined}
	 *					project instance or undefined if the project is unknown to the graph
	 */
	getProject(projectName) {
		if (projectName) {
			return this._buildContext.getProject(projectName);
		}
		return this._project;
	}
}

module.exports = ProjectBuildContext;
