import type ProjectGraph from "../../graph/ProjectGraph.js";
import type Project from "../../specifications/Project.js";
import ProjectBuildContext from "./ProjectBuildContext.js";
import OutputStyleEnum from "./ProjectBuilderOutputStyle.js";
import type * as taskRepositoryModule from "@ui5/builder/internal/taskRepository";

export interface BuildConfig {
	selfContained?: boolean;
	cssVariables?: boolean;
	jsdoc?: boolean;
	createBuildManifest?: boolean;
	outputStyle?: typeof OutputStyleEnum[keyof typeof OutputStyleEnum];
	includedTasks?: string[];
	excludedTasks?: string[];
}

export type BuildContextOptions = keyof typeof BuildContext.prototype._options;

/**
 * Context of a build process
 *
 */
class BuildContext {
	_graph: ProjectGraph;
	_buildConfig: BuildConfig;
	_taskRepository: typeof taskRepositoryModule;
	_options: {cssVariables: boolean};
	_projectBuildContexts: ProjectBuildContext[];

	constructor(graph: ProjectGraph, taskRepository: typeof taskRepositoryModule, { // buildConfig
		selfContained = false,
		cssVariables = false,
		jsdoc = false,
		createBuildManifest = false,
		outputStyle = OutputStyleEnum.Default,
		includedTasks = [], excludedTasks = [],
	} = {} as BuildConfig) {
		if (!graph) {
			throw new Error(`Missing parameter 'graph'`);
		}
		if (!taskRepository) {
			throw new Error(`Missing parameter 'taskRepository'`);
		}

		const rootProjectType = graph.getRoot().getType();

		if (createBuildManifest && !["library", "theme-library"].includes(rootProjectType)) {
			throw new Error(
				`Build manifest creation is currently not supported for projects of type ` +
				rootProjectType);
		}

		if (createBuildManifest && selfContained) {
			throw new Error(
				`Build manifest creation is currently not supported for ` +
				`self-contained builds`);
		}

		if (createBuildManifest && outputStyle === OutputStyleEnum.Flat) {
			throw new Error(
				`Build manifest creation is not supported in conjunction with flat build output`);
		}
		if (outputStyle !== OutputStyleEnum.Default) {
			if (rootProjectType === "theme-library") {
				throw new Error(
					`${outputStyle} build output style is currently not supported for projects of type` +
					`theme-library since they commonly have more than one namespace. ` +
					`Currently only the Default output style is supported for this project type.`
				);
			}
			if (rootProjectType === "module") {
				throw new Error(
					`${outputStyle} build output style is currently not supported for projects of type` +
					`module. Their path mappings configuration can't be mapped to any namespace.` +
					`Currently only the Default output style is supported for this project type.`
				);
			}
		}

		this._graph = graph;
		this._buildConfig = {
			selfContained,
			cssVariables,
			jsdoc,
			createBuildManifest,
			outputStyle,
			includedTasks,
			excludedTasks,
		};

		this._taskRepository = taskRepository;

		this._options = {
			cssVariables: cssVariables,
		};
		this._projectBuildContexts = [];
	}

	getRootProject() {
		return this._graph.getRoot();
	}

	getOption(key: BuildContextOptions) {
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

	createProjectContext({project}: {project: Project}) {
		const projectBuildContext = new ProjectBuildContext({
			buildContext: this,
			project,
		});
		this._projectBuildContexts.push(projectBuildContext);
		return projectBuildContext;
	}

	async executeCleanupTasks(force = false) {
		await Promise.all(this._projectBuildContexts.map((ctx) => {
			return ctx.executeCleanupTasks(force);
		}));
	}
}

export default BuildContext;
