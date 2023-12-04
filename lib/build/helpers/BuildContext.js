import ProjectBuildContext from "./ProjectBuildContext.js";
import WorkDispatcher from "./WorkDispatcher.js";

/**
 * Context of a build process
 *
 * @private
 * @memberof @ui5/project/build/helpers
 */
class BuildContext {
	#workDispatcher = null;

	constructor(graph, taskRepository, { // buildConfig
		selfContained = false,
		cssVariables = false,
		jsdoc = false,
		createBuildManifest = false,
		includedTasks = [], excludedTasks = [],
	} = {}) {
		if (!graph) {
			throw new Error(`Missing parameter 'graph'`);
		}
		if (!taskRepository) {
			throw new Error(`Missing parameter 'taskRepository'`);
		}

		if (createBuildManifest && !["library", "theme-library"].includes(graph.getRoot().getType())) {
			throw new Error(
				`Build manifest creation is currently not supported for projects of type ` +
				graph.getRoot().getType());
		}

		if (createBuildManifest && selfContained) {
			throw new Error(
				`Build manifest creation is currently not supported for ` +
				`self-contained builds`);
		}

		this._graph = graph;
		this._buildConfig = {
			selfContained,
			cssVariables,
			jsdoc,
			createBuildManifest,
			includedTasks,
			excludedTasks,
		};

		this._taskRepository = taskRepository;

		this._options = {
			cssVariables: cssVariables
		};
		this._projectBuildContexts = [];

		this.#workDispatcher = WorkDispatcher.getInstance(this);
	}

	getRootProject() {
		return this._graph.getRoot();
	}

	getOption(key) {
		return this._options[key];
	}

	getBuildConfig() {
		return this._buildConfig;
	}

	getTaskRepository() {
		return this._taskRepository;
	}

	getGraph() {
		return this._graph;
	}

	getWorkDispatcher() {
		return this.#workDispatcher;
	}

	createProjectContext({project}) {
		const projectBuildContext = new ProjectBuildContext({
			buildContext: this,
			project
		});
		this._projectBuildContexts.push(projectBuildContext);
		return projectBuildContext;
	}

	async executeCleanupTasks(force = false) {
		await Promise.all(this._projectBuildContexts.map((ctx) => {
			return ctx.executeCleanupTasks(force);
		}));
		await this.#workDispatcher.cleanup(this, force);
	}
}

export default BuildContext;
