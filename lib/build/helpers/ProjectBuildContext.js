import ui5Fs from "@ui5/fs";
const {ResourceTagCollection} = ui5Fs;

import TaskUtil from "./TaskUtil.js";
import TaskRunner from "../TaskRunner.js";

/**
 * Build context of a single project. Always part of an overall
 * [Build Context]{@link module:@ui5/project.build.helpers.BuildContext}
 *
 * @private
 * @memberof module:@ui5/project.build.helpers
 */
class ProjectBuildContext {
	constructor({buildContext, log, project}) {
		if (!buildContext) {
			throw new Error(`Missing parameter 'buildContext'`);
		}
		if (!log) {
			throw new Error(`Missing parameter 'log'`);
		}
		if (!project) {
			throw new Error(`Missing parameter 'project'`);
		}
		this._buildContext = buildContext;
		this._project = project;
		this._log = log;
		this._queues = {
			cleanup: []
		};

		this._resourceTagCollection = new ResourceTagCollection({
			allowedTags: ["ui5:OmitFromBuildResult", "ui5:IsBundle"],
			allowedNamespaces: ["build"]
		});
	}

	isRootProject() {
		return this._project === this._buildContext.getRootProject();
	}

	getOption(key) {
		return this._buildContext.getOption(key);
	}

	registerCleanupTask(callback) {
		this._queues.cleanup.push(callback);
	}

	async executeCleanupTasks() {
		await Promise.all(this._queues.cleanup.map((callback) => {
			return callback();
		}));
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
			return this._buildContext.getGraph().getProject(projectName);
		}
		return this._project;
	}

	getResourceTagCollection(resource, tag) {
		if (!resource.hasProject()) {
			this._log.silly(`Associating resource ${resource.getPath()} with project ${this._project.getName()}`);
			resource.setProject(this._project);
			// throw new Error(
			// 	`Unable to get tag collection for resource ${resource.getPath()}: ` +
			// 	`Resource must be associated to a project`);
		}
		const projectCollection = resource.getProject().getResourceTagCollection();
		if (projectCollection.acceptsTag(tag)) {
			return projectCollection;
		}
		if (this._resourceTagCollection.acceptsTag(tag)) {
			return this._resourceTagCollection;
		}
		throw new Error(`Could not find collection for resource ${resource.getPath()} and tag ${tag}`);
	}

	getTaskUtil() {
		if (!this._taskUtil) {
			this._taskUtil = new TaskUtil({
				projectBuildContext: this
			});
		}

		return this._taskUtil;
	}

	getTaskRunner() {
		if (this._taskRunner) {
			return this._taskRunner;
		}

		this._taskRunner = new TaskRunner({
			graph: this._buildContext.getGraph(),
			project: this._project,
			taskUtil: this.getTaskUtil(),
			taskRepository: this._buildContext.getTaskRepository(),
			parentLogger: this._log,
			buildConfig: this._buildContext.getBuildConfig()
		});
		return this._taskRunner;
	}
}

export default ProjectBuildContext;
