import type * as taskRepositoryModule from "@ui5/builder/internal/taskRepository";
import {createReaderCollection} from "@ui5/fs/resourceFactory";
import {getLogger} from "@ui5/logger";
import type ProjectBuildLogger from "@ui5/logger/internal/loggers/ProjectBuild";
import type ProjectGraph from "../graph/ProjectGraph.js";
import type Project from "../specifications/Project.js";
import {type BuildConfig} from "./helpers/BuildContext.js";
import composeTaskList from "./helpers/composeTaskList.js";
import type TaskUtil from "./helpers/TaskUtil.js";
import type AbstractReader from "@ui5/fs/AbstractReader";
import type AbstractReaderWriter from "@ui5/fs/AbstractReaderWriter";
import type ReaderCollection from "@ui5/fs/ReaderCollection";
import type Task from "../specifications/extensions/Task.js";
import {
	type CustomTaskParams_2_1, type CustomTaskParams_3_0, type CustomTaskParamsBase,
	type DetermineRequiredDependenciesParams} from "../specifications/extensions/Task.js";
import {type TaskUtilInterface3_0} from "./helpers/TaskUtil.js";
import {type TaskDefinition} from "../specifications/Project.js";

type TaskOptions = Record<string, unknown>;

export interface TaskParamsBase {
	workspace: AbstractReaderWriter;
	dependencies?: AbstractReader;
	options: TaskOptions;
}

export interface StandardTaskParams extends TaskParamsBase {
	taskUtil: TaskUtil;
}
export type TaskFunction = (params: TaskParamsBase) => Promise<void>;
export type TaskFunctionWrapper = (log: ProjectBuildLogger) => Promise<void>;

interface TaskInfo {
	// null indicates the task is skipped
	task: TaskFunctionWrapper | null;
	requiredDependencies: Set<string>;
}

export interface StandardTaskDefinition {
	requiresDependencies?: boolean;
	options?: TaskOptions;
	taskFunction?: TaskFunction | null; // Setting task function to null skips the task
}
export interface ProjectBuildDefinitionParams<T> {
	project: T;
	taskUtil: TaskUtil;
	getTask: typeof taskRepositoryModule["getTask"];
}
export type ProjectBuildDefinition<T extends Project = Project> =
	(params: ProjectBuildDefinitionParams<T>) => Map<string, StandardTaskDefinition>;

/**
 * TaskRunner
 *
 * @hideconstructor
 */
class TaskRunner {
	_project: Project;
	_graph: ProjectGraph;
	_taskUtil: TaskUtil;
	_taskRepository: typeof taskRepositoryModule;
	_buildConfig: BuildConfig;
	_log: ProjectBuildLogger;
	_directDependencies: Set<string>;

	_tasks!: Map<string, TaskInfo>;
	_taskExecutionOrder!: string[];

	_allDependenciesReader!: ReaderCollection;
	_taskStart: number | undefined;

	constructor({graph, project, log, taskUtil, taskRepository, buildConfig}: {
		graph: ProjectGraph;
		project: Project;
		log: ProjectBuildLogger;
		taskUtil: TaskUtil;
		taskRepository: typeof taskRepositoryModule;
		buildConfig: BuildConfig;
	}) {
		if (!graph || !project || !log || !taskUtil || !taskRepository || !buildConfig) {
			throw new Error("TaskRunner: One or more mandatory parameters not provided");
		}
		this._project = project;
		this._graph = graph;
		this._taskUtil = taskUtil;
		this._taskRepository = taskRepository;
		this._buildConfig = buildConfig;
		this._log = log;

		this._directDependencies = new Set(this._taskUtil.getDependencies());
	}

	async _initTasks() {
		if (this._tasks) {
			return;
		}

		this._tasks = new Map();
		this._taskExecutionOrder = [];

		const project = this._project;
		let buildDefinition;

		switch (project.getType()) {
			case "application":
				buildDefinition = "./definitions/application.js";
				break;
			case "library":
				buildDefinition = "./definitions/library.js";
				break;
			case "module":
				buildDefinition = "./definitions/module.js";
				break;
			case "theme-library":
				buildDefinition = "./definitions/themeLibrary.js";
				break;
			default:
				throw new Error(`Unknown project type ${project.getType()}`);
		}

		const {default: getStandardTasks} = await import(buildDefinition) as {default: ProjectBuildDefinition};

		const standardTasks = getStandardTasks({
			project,
			taskUtil: this._taskUtil,
			getTask: this._taskRepository.getTask,
		});

		for (const [taskName, params] of standardTasks) {
			this._addTask(taskName, params);
		}

		await this._addCustomTasks();

		// Create readers for *all* dependencies
		const depReaders: AbstractReader[] = [];
		await this._graph.traverseBreadthFirst(project.getName(), function ({project: dep}) {
			if (dep.getName() === project.getName()) {
				// Ignore project itself
				return;
			}
			depReaders.push(dep.getReader());
		});

		this._allDependenciesReader = createReaderCollection({
			name: `Dependency reader collection of project ${project.getName()}`,
			readers: depReaders,
		});
	}

	/**
	 * Takes a list of tasks which should be executed from the available task list of the current builder
	 *
	 * @returns Returns promise resolving once all tasks have been executed
	 */
	async runTasks() {
		await this._initTasks();
		const tasksToRun = composeTaskList([...this._tasks.keys()], this._buildConfig);
		const allTasks = this._taskExecutionOrder.filter((taskName) => {
			// There might be a numeric suffix in case a custom task is configured multiple times.
			// The suffix needs to be removed in order to check against the list of tasks to run.
			//
			// Note: The 'tasksToRun' parameter only allows to specify the custom task name
			// (without suffix), so it executes either all or nothing.
			// It's currently not possible to just execute some occurrences of a custom task.
			// This would require a more robust contract to identify task executions
			// (e.g. via an 'id' that can be assigned to a specific execution in the configuration).
			const taskWithoutSuffixCounter = taskName.replace(/--\d+$/, "");
			return tasksToRun.includes(taskWithoutSuffixCounter) &&
				// Task can be explicitly excluded by making its taskFunction = null
				this._tasks.get(taskName)!.task !== null;
		});

		this._log.setTasks(allTasks);
		for (const taskName of allTasks) {
			const taskFunction = this._tasks.get(taskName)!.task;

			if (typeof taskFunction === "function") {
				await this._executeTask(taskName, taskFunction);
			}
		}
	}

	/**
	 * First compiles a list of all tasks that will be executed, then a list of all direct project
	 * dependencies that those tasks require access to.
	 *
	 * @returns Returns a set containing the names of all required direct project dependencies
	 */
	async getRequiredDependencies() {
		await this._initTasks();
		const tasksToRun = composeTaskList([...this._tasks.keys()], this._buildConfig);
		const allTasks = this._taskExecutionOrder.filter((taskName) => {
			// There might be a numeric suffix in case a custom task is configured multiple times.
			// The suffix needs to be removed in order to check against the list of tasks to run.
			//
			// Note: The 'tasksToRun' parameter only allows to specify the custom task name
			// (without suffix), so it executes either all or nothing.
			// It's currently not possible to just execute some occurrences of a custom task.
			// This would require a more robust contract to identify task executions
			// (e.g. via an 'id' that can be assigned to a specific execution in the configuration).
			const taskWithoutSuffixCounter = taskName.replace(/--\d+$/, "");
			return tasksToRun.includes(taskWithoutSuffixCounter);
		});
		return allTasks.reduce((requiredDependencies, taskName) => {
			if (this._tasks.get(taskName)!.requiredDependencies.size) {
				this._log.verbose(`Task ${taskName} for project ${this._project.getName()} requires dependencies`);
			}
			for (const depName of this._tasks.get(taskName)!.requiredDependencies) {
				requiredDependencies.add(depName);
			}
			return requiredDependencies;
		}, new Set());
	}

	/**
	 * Adds an executable task to the builder
	 *
	 * The order this function is being called defines the build order. FIFO.
	 *
	 * @param taskName Name of the task which should be in the list availableTasks.
	 * @param [parameters] Params
	 * @param [parameters.requiresDependencies] TODO
	 * @param [parameters.options] TODO
	 * @param [parameters.taskFunction] TODO
	 */
	_addTask(taskName: string, {
		requiresDependencies = false, options = {}, taskFunction}: StandardTaskDefinition = {}
	) {
		if (this._tasks.has(taskName)) {
			throw new Error(`Failed to add duplicate task ${taskName} for project ${this._project.getName()}`);
		}
		if (this._taskExecutionOrder.includes(taskName)) {
			throw new Error(`Failed to add task ${taskName} for project ${this._project.getName()}. ` +
				`It has already been scheduled for execution`);
		}

		let task: TaskFunctionWrapper | null;
		if (taskFunction === null) {
			this._log.verbose(`Task ${taskName} is set to be explicitly skipped in definitions.`);
			task = null;
		} else {
			task = async (_log: ProjectBuildLogger) => {
				options.projectName = this._project.getName();
				options.projectNamespace = this._project.getNamespace();

				const params: StandardTaskParams = {
					workspace: this._project.getWorkspace(),
					taskUtil: this._taskUtil,
					options,
				};

				if (requiresDependencies) {
					params.dependencies = this._allDependenciesReader;
				}

				if (!taskFunction) {
					taskFunction = (await this._taskRepository.getTask(taskName)).task as TaskFunction;
				}
				return taskFunction(params);
			};
		}
		this._tasks.set(taskName, {
			task,
			requiredDependencies: requiresDependencies ? this._directDependencies : new Set(),
		});
		this._taskExecutionOrder.push(taskName);
	}

	private async _addCustomTasks() {
		const projectCustomTasks = this._project.getCustomTasks();
		if (!projectCustomTasks || projectCustomTasks.length === 0) {
			return; // No custom tasks defined
		}
		for (let i = 0; i < projectCustomTasks.length; i++) {
			// Add tasks one-by-one to keep order as defined in project configuration
			await this._addCustomTask(projectCustomTasks[i]);
		}
	}

	private async _addCustomTask(taskDef: TaskDefinition) {
		const project = this._project;
		const graph = this._graph;
		const taskUtil = this._taskUtil;

		if (!taskDef.name) {
			throw new Error(`Missing name for custom task in configuration of project ${project.getName()}`);
		}
		if (taskDef.beforeTask && taskDef.afterTask) {
			throw new Error(`Custom task definition ${taskDef.name} of project ${project.getName()} ` +
				`defines both "beforeTask" and "afterTask" parameters. Only one must be defined.`);
		}
		if (this._taskExecutionOrder.length && !taskDef.beforeTask && !taskDef.afterTask) {
			// Iff there are tasks configured, beforeTask or afterTask must be given
			throw new Error(`Custom task definition ${taskDef.name} of project ${project.getName()} ` +
				`defines neither a "beforeTask" nor an "afterTask" parameter. One must be defined.`);
		}
		const standardTasks = this._taskRepository.getAllTaskNames();
		if (standardTasks.includes(taskDef.name)) {
			throw new Error(
				`Custom task configuration of project ${project.getName()} ` +
				`references standard task ${taskDef.name}. Only custom tasks must be provided here.`);
		}

		let newTaskName = taskDef.name;
		if (this._tasks.has(newTaskName)) {
			// Task is already known
			// => add a suffix to allow for multiple configurations of the same task
			let suffixCounter = 1;
			while (this._tasks.has(newTaskName)) {
				suffixCounter++; // Start at 2
				newTaskName = `${taskDef.name}--${suffixCounter}`;
			}
		}
		const task = graph.getExtension(taskDef.name) as Task | undefined;
		if (!task) {
			throw new Error(
				`Could not find custom task ${taskDef.name}, referenced by project ${project.getName()} ` +
				`in project graph with root node ${graph.getRoot().getName()}`);
		}

		// Tasks can provide an optional callback to tell build process which dependencies they require
		const requiredDependenciesCallback = await task.getRequiredDependenciesCallback();
		const specVersion = task.getSpecVersion();
		let requiredDependencies: Set<string> | undefined;

		// Always provide a dependencies-reader, even if empty. Unless the task is specVersion >=3.0
		// and did not define the respective callback.
		// This is to distinguish between tasks semi-intentionally not requesting any dependencies,
		// because none are available (i.e. because the project does not have any) and tasks that
		// intentionally do not request any dependencies, by not providing a dependency-determination callback function
		let provideDependenciesReader = true;
		if (!requiredDependenciesCallback) {
			if (specVersion.gte("3.0")) {
				// Default for new spec versions: Provide no dependencies if no callback is provided
				this._log.verbose(
					`Custom task ${task.getName()} of project ${this._project.getName()} ` +
					`does not provide a callback for determining its required dependencies. ` +
					`Defaulting to not providing any dependencies to the task`);
				requiredDependencies = new Set();

				// Ensure that no reader is provided, in order to produce an exception if
				// access is still attempted
				provideDependenciesReader = false;
			} else {
				// Default for old spec versions: Assume all dependencies are required
				requiredDependencies = this._directDependencies;
			}
		} else {
			const dependencyDeterminationParams: DetermineRequiredDependenciesParams = {
				availableDependencies: new Set(this._directDependencies),
				options: {
					projectName: project.getName(),
					projectNamespace: project.getNamespace()!,
					configuration: taskDef.configuration,
					taskName: newTaskName,
				},
			};

			if (specVersion.gte("3.0")) {
				// Add getProjects, getDependencies and options to parameters
				const taskUtilInterface = taskUtil.getInterface(specVersion) as TaskUtilInterface3_0;
				dependencyDeterminationParams.getProject =
					taskUtilInterface.getProject.bind(taskUtilInterface);
				dependencyDeterminationParams.getDependencies =
					taskUtilInterface.getDependencies.bind(taskUtilInterface);
			}

			requiredDependencies = await requiredDependenciesCallback(dependencyDeterminationParams);
			if (!(requiredDependencies instanceof Set)) {
				throw new Error(
					`'determineRequiredDependencies' callback function of custom task ${task.getName()} of ` +
					`project ${project.getName()} must resolve with Set.`);
			}
			requiredDependencies.forEach((depName) => {
				// Returned requiredDependencies must be a subset of all direct dependencies of the project
				if (!this._directDependencies.has(depName)) {
					throw new Error(
						`'determineRequiredDependencies' callback function of custom task ${task.getName()} ` +
						`of project ${project.getName()} must resolve with a subset of the the direct ` +
						`dependencies of the project. ${depName} is not a direct dependency of the project.`);
				}
			});
		}

		this._tasks.set(newTaskName, {
			task: this._createCustomTaskWrapper(
				task,
				project,
				taskUtil,
				newTaskName,
				taskDef.configuration,
				provideDependenciesReader,
				() => {
					// Create the dependencies reader on-demand
					return this._createDependenciesReader(requiredDependencies);
				}
			),
			requiredDependencies,
		});

		if (this._taskExecutionOrder.length) {
			// There is at least one task configured. Use before- and afterTask to add the custom task
			const refTaskName = taskDef.beforeTask ?? taskDef.afterTask!;
			let refTaskIdx = this._taskExecutionOrder.indexOf(refTaskName);
			if (refTaskIdx === -1) {
				if (this._taskRepository.getRemovedTaskNames().includes(refTaskName)) {
					throw new Error(
						`Standard task ${refTaskName}, referenced by custom task ${newTaskName} ` +
						`in project ${project.getName()}, ` +
						`has been removed in this version of UI5 Tooling and can't be referenced anymore. ` +
						`Please see the migration guide at https://sap.github.io/ui5-tooling/updates/migrate-v3/`);
				}
				throw new Error(`Could not find task ${refTaskName}, referenced by custom task ${newTaskName}, ` +
					`to be scheduled for project ${project.getName()}`);
			}
			if (taskDef.afterTask) {
				// Insert after index of referenced task
				refTaskIdx++;
			}
			this._taskExecutionOrder.splice(refTaskIdx, 0, newTaskName);
		} else {
			// There is no task configured so far. Just add the custom task
			this._taskExecutionOrder.push(newTaskName);
		}
	}

	_createCustomTaskWrapper(
		task: Task, project: Project, taskUtil: TaskUtil,
		taskName: string, taskConfiguration: unknown, provideDependenciesReader: boolean,
		getDependenciesReader: () => Promise<AbstractReader>
	) {
		return async function () {
			/* Custom Task Interface
				Parameters:
					{Object} parameters Parameters
					{@ui5/fs/DuplexCollection} parameters.workspace DuplexCollection to read and write files
					{@ui5/fs/AbstractReader} parameters.dependencies
						Reader or Collection to read dependency files
					{@ui5/project/build/helpers/TaskUtil} parameters.taskUtil Specification Version-dependent
						interface of a [TaskUtil]{@link @ui5/project/build/helpers/TaskUtil} instance
					{@ui5/logger/Logger} [parameters.log] Logger instance to use by the custom task.
						This parameter is only available to custom task extensions defining
						<b>Specification Version 3.0 and above</b>.
					{Object} parameters.options Options
					{string} parameters.options.projectName Project name
					{string|null} parameters.options.projectNamespace Project namespace if available
					{string} [parameters.options.taskName] Runtime name of the task.
						If a task is executed multiple times, a suffix is added to distinguish the executions.
						This attribute is only available to custom task extensions defining
						<b>Specification Version 3.0 and above</b>.
					{string} [parameters.options.configuration] Task configuration if given in ui5.yaml
				Returns:
					{Promise<undefined>} Promise resolving with undefined once data has been written
			*/
			const params: CustomTaskParamsBase = {
				workspace: project.getWorkspace(),
				options: {
					projectName: project.getName(),
					projectNamespace: project.getNamespace(),
					configuration: taskConfiguration,
				},
			};
			const specVersion = task.getSpecVersion();
			const taskUtilInterface = taskUtil.getInterface(specVersion);
			// Interface is undefined if specVersion does not support taskUtil
			if (taskUtilInterface) {
				(params as CustomTaskParams_2_1).taskUtil = taskUtilInterface;
			}
			const taskFunction = await task.getTask();

			if (specVersion.gte("3.0")) {
				params.options.taskName = taskName;
				(params as CustomTaskParams_3_0).log = getLogger(`builder:custom-task:${taskName}`);
			}

			if (provideDependenciesReader) {
				params.dependencies = await getDependenciesReader();
			}
			return taskFunction(params);
		};
	}

	private async _executeTask(taskName: string, taskFunction: TaskFunctionWrapper) {
		this._log.startTask(taskName);
		this._taskStart = performance.now();
		await taskFunction(this._log);
		if (this._log.isLevelEnabled("perf")) {
			this._log.perf(`Task ${taskName} finished in ${Math.round((performance.now() - this._taskStart))} ms`);
		}
		this._log.endTask(taskName);
	}

	async _createDependenciesReader(requiredDirectDependencies: Set<string>) {
		if (requiredDirectDependencies.size === this._directDependencies.size) {
			// Shortcut: If all direct dependencies are required, just return the already created reader
			return this._allDependenciesReader;
		}
		const rootProject = this._project;

		// Collect readers for all requested dependencies
		const readers: AbstractReader[] = [];

		// Add transitive dependencies to set of required dependencies
		const requiredDependencies = new Set(requiredDirectDependencies);
		for (const projectName of requiredDirectDependencies) {
			this._graph.getTransitiveDependencies(projectName).forEach((depName) => {
				requiredDependencies.add(depName);
			});
		}

		// Collect readers for all (transitive) dependencies
		await this._graph.traverseBreadthFirst(rootProject.getName(), ({project}) => {
			if (requiredDependencies.has(project.getName())) {
				readers.push(project.getReader());
			}
		});

		// Create a reader collection for that
		return createReaderCollection({
			name: `Reduced dependency reader collection of project ${rootProject.getName()}`,
			readers,
		});
	}
}

export default TaskRunner;
