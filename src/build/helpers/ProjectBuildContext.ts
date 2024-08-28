import ResourceTagCollection from "@ui5/fs/internal/ResourceTagCollection";
import ProjectBuildLogger from "@ui5/logger/internal/loggers/ProjectBuild";
import TaskUtil from "./TaskUtil.js";
import TaskRunner from "../TaskRunner.js";
import type BuildContext from "./BuildContext.js";
import type Project from "../../specifications/Project.js";

export type CleanupCallback = (force: boolean) => Promise<void>;

/**
 * Build context of a single project. Always part of an overall
 * [Build Context]{@link @ui5/project/build/helpers/BuildContext}
 *
 */
class ProjectBuildContext {
	_buildContext: BuildContext;
	_project: Project;
	_log: ProjectBuildLogger;
	_queues: {cleanup: CleanupCallback[]};
	_resourceTagCollection: ResourceTagCollection;

	constructor({buildContext, project}: {buildContext: BuildContext; project: Project}) {
		if (!buildContext) {
			throw new Error(`Missing parameter 'buildContext'`);
		}
		if (!project) {
			throw new Error(`Missing parameter 'project'`);
		}
		this._buildContext = buildContext;
		this._project = project;
		this._log = new ProjectBuildLogger({
			moduleName: "Build",
			projectName: project.getName(),
			projectType: project.getType(),
		});
		this._queues = {
			cleanup: [],
		};

		this._resourceTagCollection = new ResourceTagCollection({
			allowedTags: ["ui5:OmitFromBuildResult", "ui5:IsBundle"],
			allowedNamespaces: ["build"],
		});
	}

	isRootProject() {
		return this._project === this._buildContext.getRootProject();
	}

	getOption(key: keyof typeof BuildContext.prototype._options) {
		return this._buildContext.getOption(key);
	}

	registerCleanupTask(callback: CleanupCallback) {
		this._queues.cleanup.push(callback);
	}

	async executeCleanupTasks(force: boolean) {
		await Promise.all(this._queues.cleanup.map((callback) => {
			return callback(force);
		}));
	}

	/**
	 * Retrieve a single project from the dependency graph
	 *
	 * @param [projectName] Name of the project to retrieve. Defaults to the project currently being built
	 * @returns
	 *					project instance or undefined if the project is unknown to the graph
	 */
	getProject(projectName?: string) {
		if (projectName) {
			return this._buildContext.getGraph().getProject(projectName);
		}
		return this._project;
	}

	/**
	 * Retrieve a list of direct dependencies of a given project from the dependency graph
	 *
	 * @param [projectName] Name of the project to retrieve. Defaults to the project currently being built
	 * @returns Names of all direct dependencies
	 * @throws {Error} If the requested project is unknown to the graph
	 */
	getDependencies(projectName?: string) {
		return this._buildContext.getGraph().getDependencies(projectName || this._project.getName());
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
				projectBuildContext: this,
			});
		}

		return this._taskUtil;
	}

	getTaskRunner() {
		if (!this._taskRunner) {
			this._taskRunner = new TaskRunner({
				project: this._project,
				log: this._log,
				taskUtil: this.getTaskUtil(),
				graph: this._buildContext.getGraph(),
				taskRepository: this._buildContext.getTaskRepository(),
				buildConfig: this._buildContext.getBuildConfig(),
			});
		}
		return this._taskRunner;
	}

	/**
	 * Determine whether the project has to be built or is already built
	 * (typically indicated by the presence of a build manifest)
	 *
	 * @returns True if the project needs to be built
	 */
	requiresBuild() {
		return !this._project.getBuildManifest();
	}

	getBuildMetadata() {
		const buildManifest = this._project.getBuildManifest();
		if (!buildManifest) {
			return null;
		}
		const timeDiff = (new Date().getTime() - new Date(buildManifest.timestamp).getTime());

		// TODO: Format age properly via a new @ui5/logger util module
		return {
			timestamp: buildManifest.timestamp,
			age: timeDiff / 1000 + " seconds",
		};
	}
}

export default ProjectBuildContext;
