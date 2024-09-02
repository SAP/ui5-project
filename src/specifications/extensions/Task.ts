import path from "node:path";
import Extension from "../Extension.js";
import {pathToFileURL} from "node:url";
import {type SpecificationConfiguration} from "../Specification.js";
import type Logger from "@ui5/logger/Logger";
import {type TaskParamsBase} from "../../build/TaskRunner.js";
import {type TaskUtilInterface3_0, type TaskUtilInterfaceBase} from "../../build/helpers/TaskUtil.js";

interface TaskConfiguration extends SpecificationConfiguration {
	task: {
		path: string;
	};
}

export type CustomTaskParamsBase = TaskParamsBase;

export interface CustomTaskParams_2_1 extends CustomTaskParamsBase {
	taskUtil: TaskUtilInterfaceBase;
}

export interface CustomTaskParams_3_0 extends CustomTaskParamsBase {
	log?: Logger;
}

type CustomTaskFunction = (params: CustomTaskParamsBase) => Promise<void>;

export interface DetermineRequiredDependenciesParams {
	availableDependencies: Set<string>;
	// Only provided for specVersion >=3.0
	getProject?: TaskUtilInterface3_0["getProject"];
	// Only provided for specVersion >=3.0
	getDependencies?: TaskUtilInterface3_0["getDependencies"];
	options: {
		projectName: string;
		projectNamespace: string;
		taskName: string;
		configuration: unknown;
	};
}

interface CustomTaskModule {
	default: CustomTaskFunction;
	determineRequiredDependencies?: (params: DetermineRequiredDependenciesParams) => Promise<Set<string>>;
}

/**
 * Task
 *
 * @hideconstructor
 */
class Task extends Extension<TaskConfiguration> {
	public async getTask() {
		return (await this._getImplementation()).task;
	}

	public async getRequiredDependenciesCallback() {
		return (await this._getImplementation()).determineRequiredDependencies;
	}

	private async _getImplementation() {
		const taskPath = path.join(this.getRootPath(), this._config.task.path);
		const {default: task, determineRequiredDependencies} =
			await import(pathToFileURL(taskPath)) as CustomTaskModule;
		return {
			task, determineRequiredDependencies,
		};
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	protected async _validateConfig() {
		// TODO: Move to validator
		if (/--\d+$/.test(this.getName())) {
			throw new Error(`Task name must not end with '--<number>'`);
		}
		// TODO: Check that paths exist
	}
}

export default Task;
