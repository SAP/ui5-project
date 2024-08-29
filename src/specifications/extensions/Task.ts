import path from "node:path";
import Extension from "../Extension.js";
import {pathToFileURL} from "node:url";
import {SpecificationConfiguration} from "../Specification.js";
import AbstractReader from "@ui5/fs/AbstractReader";
import Logger from "@ui5/logger/Logger";
import TaskUtil from "../../build/helpers/TaskUtil.js";
import AbstractReaderWriter from "@ui5/fs/AbstractReaderWriter";

interface TaskConfiguration extends SpecificationConfiguration {
	task: {
		path: string;
	};
}

interface CustomTaskParams {
	dependencies: AbstractReader;
	log: Logger;
	options: Record<string, unknown>;
	taskUtil: TaskUtil;
	workspace: AbstractReaderWriter;
}
type CustomTask = ({dependencies, log, options, taskUtil, workspace}: CustomTaskParams) => Promise<void>;

interface CustomTaskModule {
	default: CustomTask;
	determineRequiredDependencies?: (dependencies: AbstractReader) => Promise<void>;
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
