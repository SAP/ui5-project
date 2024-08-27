import path from "node:path";
import Extension from "../Extension.js";
import {pathToFileURL} from "node:url";

/**
 * Task
 *
 * @alias @ui5/project/specifications/extensions/Task
 * @hideconstructor
 */
class Task extends Extension {
	constructor(parameters) {
		super(parameters);
	}

	public async getTask() {
		return (await this._getImplementation()).task;
	}

	public async getRequiredDependenciesCallback() {
		return (await this._getImplementation()).determineRequiredDependencies;
	}

	private async _getImplementation() {
		const taskPath = path.join(this.getRootPath(), this._config.task.path);
		const {default: task, determineRequiredDependencies} = await import(pathToFileURL(taskPath));
		return {
			task, determineRequiredDependencies,
		};
	}

	private async _validateConfig() {
		// TODO: Move to validator
		if (/--\d+$/.test(this.getName())) {
			throw new Error(`Task name must not end with '--<number>'`);
		}
		// TODO: Check that paths exist
	}
}

export default Task;
