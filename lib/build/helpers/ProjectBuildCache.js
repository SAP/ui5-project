import {getLogger} from "@ui5/logger";
const log = getLogger("build:helpers:ProjectBuildCache");

export default class ProjectBuildCache {
	#versions = new Map();
	#taskToVersion = new Map();
	#project;
	constructor(project) {
		this.#project = project;
	}

	setTasks(tasks) {
		// "tasks" is a list of all tasks that will be run, in the order of their execution
		if (this.#taskToVersion.size > 0) {
			// Cache is filled, check if the tasks are the same
			if (tasks.length !== this.#taskToVersion.size) {
				throw new Error(`Unexpected change of tasks for project ${this.#project.getName()}`);
			}
			for (const task of tasks) {
				if (!this.#taskToVersion.has(task)) {
					throw new Error(`Unexpected change of tasks for project ${this.#project.getName()}`);
				}
			}
		} else {
			// Cache is empty
			for (let i = 0; i < tasks.length; i++) {
				this.#taskToVersion.set(tasks[i], i);
			}
		}
	}

	addLevel(taskName, version, workspace, dependencies) {
		if (this.#taskToVersion.get(taskName) !== version) {
			throw new Error(`Unexpected order of task execution for task: ` +
				`Expected workspace version for task ${taskName}: ${this.#taskToVersion.get(taskName)} ` +
				`but got ${version}`);
		}
		const resourcesWritten = workspace.getResourcesWritten();
		const resourcesRead = workspace.getResourcesRead();
		if (dependencies) {
			resourcesRead.add(...dependencies.getResourcesRead());
		}

		if (this.#versions.has(version)) {
			// Check whether something changed
			const {resourcesRead, resourcesWritten} = this.#versions.get(version);
			if (resourcesRead.size !== resourcesRead.size ||
				resourcesWritten.size !== resourcesWritten.size) {
				throw new Error(
					`Unexpected change of resources for task ${taskName} in project ${this.#project.getName()}`);
			}

			// Check whether the resources are the same
			for (const resource of resourcesRead) {
				if (!resourcesRead.has(resource)) {
					throw new Error(
						`Unexpected change of resources read for task ${taskName} in project ` +
						`${this.#project.getName()}. Expected to read ${resource} but did not`);
				}
			}
			for (const resource of resourcesWritten) {
				if (!resourcesWritten.has(resource)) {
					throw new Error(
						`Unexpected change of resources written for task ${taskName} in project ` +
						`${this.#project.getName()}. Expected to write ${resource} but did not`);
				}
			}
			return;
		}
		log.info(`Adding level ${version} for task ${taskName} in project ${this.#project.getName()}`);
		log.info(`Task ${taskName} read ${resourcesRead.size} resources and wrote ${resourcesWritten.size} resources`);
		this.#versions.set(version, {
			taskName,
			resourcesRead,
			resourcesWritten,
		});
	}

	hasValidCacheForTask(taskName) {
		return this.#versions.has(this.#taskToVersion.get(taskName));
	}

	serialize() {
		const serialized = [];
		for (const [version, {taskName, resourcesRead, resourcesWritten}] of this.#versions) {
			serialized.push({
				version,
				taskName,
				resourcesRead: Array.from(resourcesRead),
				resourcesWritten: Array.from(resourcesWritten),
			});
		}
		return serialized;
	}

	deserialize(serializedCache) {
		for (const {version, taskName, resourcesRead, resourcesWritten} of serializedCache) {
			this.#versions.set(version, {
				taskName,
				resourcesRead: new Set(resourcesRead),
				resourcesWritten: new Set(resourcesWritten),
			});
			this.#taskToVersion.set(taskName, version);
		}
	}
}
