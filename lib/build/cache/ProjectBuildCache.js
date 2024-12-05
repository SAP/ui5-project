import path from "node:path";
import {stat} from "node:fs/promises";
import {createResource, createAdapter} from "@ui5/fs/resourceFactory";
import {getLogger} from "@ui5/logger";
import BuildTaskCache from "./BuildTaskCache.js";
const log = getLogger("build:cache:ProjectBuildCache");

/**
 * A project's build cache can have multiple states
 * - Initial build without existing build manifest or cache:
 *   * No build manifest
 *   * Tasks are unknown
 *   * Resources are unknown
 *   * No persistence of workspaces
 * - Build of project with build manifest
 *   * (a valid build manifest implies that the project will not be built initially)
 *   * Tasks are known
 *   * Resources required and produced by tasks are known
 *   * No persistence of workspaces
 *   * => In case of a rebuild, all tasks need to be executed once to restore the workspaces
 * - Build of project with build manifest and cache
 *   * Tasks are known
 *   * Resources required and produced by tasks are known
 *   * Workspaces can be restored from cache
 */

export default class ProjectBuildCache {
	#taskCache = new Map();
	#project;
	#cacheKey;
	#cacheDir;
	#cacheRoot;

	#invalidatedTasks = new Map();
	#updatedResources = new Set();
	#restoreFailed = false;

	constructor(project, cacheKey, cacheDir) {
		this.#project = project;
		this.#cacheKey = cacheKey;
		this.#cacheDir = cacheDir;
		this.#cacheRoot = cacheDir && createAdapter({
			fsBasePath: cacheDir,
			virBasePath: "/"
		});
	}

	// setTasks(tasks) {
	// 	// "tasks" is a list of all tasks that will be run, in the order of their execution
	// 	if (this.#taskToStage.size > 0) {
	// 		// Cache is filled, check if the tasks are the same
	// 		if (tasks.length !== this.#taskToStage.size) {
	// 			throw new Error(`Unexpected change of tasks for project ${this.#project.getName()}`);
	// 		}
	// 		for (const task of tasks) {
	// 			if (!this.#taskToStage.has(task)) {
	// 				throw new Error(`Unexpected change of tasks for project ${this.#project.getName()}`);
	// 			}
	// 		}
	// 	} else {
	// 		// Cache is empty
	// 		for (let i = 0; i < tasks.length; i++) {
	// 			this.#taskToStage.set(tasks[i], i);
	// 		}
	// 	}
	// }

	async updateTaskResult(taskName, workspace, dependencies) {
		// if (this.#taskToStage.get(taskName) !== stage) {
		// 	throw new Error(`Unexpected order of task execution for task: ` +
		// 		`Expected workspace stage for task ${taskName}: ${this.#taskToStage.get(taskName)} ` +
		// 		`but got ${stage}`);
		// }
		// this.#taskToStage.set(taskName, stage);
		const projectResourceTrace = workspace.getTrace();
		const dependenciesResourcesTrace = dependencies?.getTrace();

		const resourcesRead = projectResourceTrace.resourcesRead;
		if (dependenciesResourcesTrace) {
			for (const [resourcePath, resource] of Object.entries(dependenciesResourcesTrace.resourcesRead)) {
				resourcesRead[resourcePath] = resource;
			}
		}
		const resourcesWritten = projectResourceTrace.resourcesWritten;

		// 	resourcesIn = [...resourcesIn];
		// 	resourcesInPatterns = [...resourcesInPatterns];
		// 	const depTrace = dependencies.getTrace();
		// 	for (const res of depTrace.resourcesIn) {
		// 		resourcesIn.push(res);
		// 	}
		// 	for (const res of depTrace.resourcesInPatterns) {
		// 		resourcesInPatterns.push(res);
		// 	}
		// }
		// if (this.#taskCache.has(stage)) {
		// 	this.#ensureResourceConsistency(stage, taskName, resourcesRead, resourcesWritten);
		// 	// stage already exists, nothing further to do
		// 	return;
		// }
		if (this.#taskCache.has(taskName)) {
			log.verbose(`Updating task cache ${taskName} for task ${taskName} in project ${this.#project.getName()}`);
			const taskCache = this.#taskCache.get(taskName);

			const writtenResourcePaths = Object.keys(resourcesWritten);
			if (writtenResourcePaths.length) {
				log.verbose(`Task ${taskName} wrote ${writtenResourcePaths.length} resources`);

				const changedPaths = new Set((await Promise.all(writtenResourcePaths
					.map(async (resourcePath) => {
						// Check whether resource content actually changed
						if (await taskCache.isResourceInWriteCache(resourcesWritten[resourcePath])) {
							return undefined;
						}
						return resourcePath;
					}))).filter((resourcePath) => resourcePath !== undefined));

				if (!changedPaths.size) {
					log.verbose(`Task ${taskName} did not write any resources that have changed`);
					return;
				}
				for (const resourcePath of changedPaths) {
					this.#updatedResources.add(resourcePath);
				}
				// Check whether other tasks need to be invalidated
				const allTasks = Array.from(this.#taskCache.keys());
				const taskIndex = allTasks.indexOf(taskName);
				const emptySet = new Set();
				for (let i = taskIndex + 1; i < allTasks.length; i++) {
					const nextTaskName = allTasks[i];
					if (!this.#taskCache.get(nextTaskName).checkPossiblyInvalidatesTask(changedPaths, emptySet)) {
						continue;
					}
					if (this.#invalidatedTasks.has(taskName)) {
						const {changedDependencyResourcePaths} =
							this.#invalidatedTasks.get(taskName);
						for (const resourcePath of changedPaths) {
							changedDependencyResourcePaths.add(resourcePath);
						}
					} else {
						this.#invalidatedTasks.set(taskName, {
							changedProjectResourcePaths: changedPaths,
							changedDependencyResourcePaths: emptySet
						});
					}
				}
			}
			taskCache.updateResources(
				projectResourceTrace.requests,
				dependenciesResourcesTrace?.requests,
				resourcesRead,
				resourcesWritten
			);
		} else {
			log.verbose(`Adding task cache ${taskName} for task ${taskName} in project ${this.#project.getName()}`);
			// log.verbose(
			// 	`Task ${taskName} read ${resourcesIn.length + resourcesInPatterns.length} resources or patterns and ` +
			// 	`wrote ${resourcesOut.length} resources`);
			this.#taskCache.set(taskName,
				new BuildTaskCache(this.#project.getName(), taskName, {
					projectRequests: projectResourceTrace.requests,
					dependencyRequests: dependenciesResourcesTrace?.requests,
					resourcesRead,
					resourcesWritten
				})
			);
		}

		if (this.#invalidatedTasks.has(taskName)) {
			this.#invalidatedTasks.delete(taskName);
		}
	}

	harvestUpdatedResources() {
		const updatedResources = new Set(this.#updatedResources);
		this.#updatedResources.clear();
		return updatedResources;
	}

	resourceChanged(projectResourcePaths, dependencyResourcePaths) {
		let taskInvalidated = false;
		for (const [taskName, taskCache] of this.#taskCache) {
			if (!taskCache.checkPossiblyInvalidatesTask(projectResourcePaths, dependencyResourcePaths)) {
				continue;
			}
			taskInvalidated = true;
			if (this.#invalidatedTasks.has(taskName)) {
				const {changedProjectResourcePaths, changedDependencyResourcePaths} =
					this.#invalidatedTasks.get(taskName);
				for (const resourcePath of projectResourcePaths) {
					changedProjectResourcePaths.add(resourcePath);
				}
				for (const resourcePath of dependencyResourcePaths) {
					changedDependencyResourcePaths.add(resourcePath);
				}
			} else {
				this.#invalidatedTasks.set(taskName, {
					changedProjectResourcePaths: new Set(projectResourcePaths),
					changedDependencyResourcePaths: new Set(dependencyResourcePaths)
				});
			}
		}
		return taskInvalidated;
	}

	async validateChangedProjectResources(taskName, workspace, dependencies) {
		// Check whether the supposedly changed resources for the task have actually changed
		if (!this.#invalidatedTasks.has(taskName)) {
			return;
		}
		const {changedProjectResourcePaths, changedDependencyResourcePaths} = this.#invalidatedTasks.get(taskName);
		await this._validateChangedResources(taskName, workspace, changedProjectResourcePaths);
		await this._validateChangedResources(taskName, dependencies, changedDependencyResourcePaths);

		if (!changedProjectResourcePaths.size && !changedDependencyResourcePaths.size) {
			// Task is no longer invalidated
			this.#invalidatedTasks.delete(taskName);
		}
	}

	async _validateChangedResources(taskName, reader, changedResourcePaths) {
		for (const resourcePath of changedResourcePaths) {
			const resource = await reader.byPath(resourcePath);
			if (!resource) {
				// Resource was deleted, no need to check further
				continue;
			}

			const taskCache = this.#taskCache.get(taskName);
			if (!taskCache) {
				// TODO: Expected?
				throw new Error(`Failed to validate changed resources for task ${taskName}: Task cache not found`);
			}
			if (await taskCache.isResourceInReadCache(resource)) {
				changedResourcePaths.delete(resourcePath);
			}
			// const cacheEntry = this.#taskCache.get(taskName).getReadResourceCacheEntry(resourcePath);
			// if (!cacheEntry ||
			// 		// cacheEntry.lastModified !== resource.getStatInfo()?.mtimeMs ||
			// 		cacheEntry.hash !== (await resource.getHash())) {
			// 	// Resource content has changed, no need to check further
			// 	continue;
			// }
			// log.verbose(`Resource content has not changed for task ${taskName}, ` +
			// 	`removing ${resourcePath} from set of changed resource paths`);
			// log.verbose(`Hash: ${cacheEntry?.hash}`);
			// Resource content has not changed, remove from invalidated resources
		}
	}

	getChangedProjectResourcePaths(taskName) {
		return this.#invalidatedTasks.get(taskName)?.changedProjectResourcePaths ?? new Set();
	}

	getChangedDependencyResourcePaths(taskName) {
		return this.#invalidatedTasks.get(taskName)?.changedDependencyResourcePaths ?? new Set();
	}

	hasCache() {
		return this.#taskCache.size > 0;
	}

	/*
		Check whether the project's build cache has an entry for the given stage.
		This means that the cache has been filled with the output of the given stage.
	*/
	hasCacheForTask(taskName) {
		return this.#taskCache.has(taskName);
	}

	hasValidCacheForTask(taskName) {
		return this.#taskCache.has(taskName) && !this.#invalidatedTasks.has(taskName);
	}

	getCacheForTask(taskName) {
		return this.#taskCache.get(taskName);
	}

	/*
		TODO
	*/
	// isTaskInvalidated(taskName) {
	// 	return this.#invalidatedTasks.has(taskName);
	// }

	// getDepsOfInvalidatedResourcesForTask(taskName) {
	// 	return this.#invalidatedTasks.get(taskName)?.depsOfInvalidatedResources;
	// }

	requiresBuild() {
		return !this.hasCache() || this.#invalidatedTasks.size > 0;
	}

	async toObject() {
		// const globalResourceIndex = Object.create(null);
		// function addResourcesToIndex(taskName, resourceMap) {
		// 	for (const resourcePath of Object.keys(resourceMap)) {
		// 		const resource = resourceMap[resourcePath];
		// 		const resourceKey = `${resourcePath}:${resource.hash}`;
		// 		if (!globalResourceIndex[resourceKey]) {
		// 			globalResourceIndex[resourceKey] = {
		// 				hash: resource.hash,
		// 				lastModified: resource.lastModified,
		// 				tasks: [taskName]
		// 			};
		// 		} else if (!globalResourceIndex[resourceKey].tasks.includes(taskName)) {
		// 			globalResourceIndex[resourceKey].tasks.push(taskName);
		// 		}
		// 	}
		// }
		const taskCache = [];
		for (const cache of this.#taskCache.values()) {
			const cacheObject = await cache.toObject();
			taskCache.push(cacheObject);
			// addResourcesToIndex(taskName, cacheObject.resources.project.resourcesRead);
			// addResourcesToIndex(taskName, cacheObject.resources.project.resourcesWritten);
			// addResourcesToIndex(taskName, cacheObject.resources.dependencies.resourcesRead);
		}
		// Collect metadata for all relevant source files
		const sourceReader = this.#project.getSourceReader();
		// const resourceMetadata = await Promise.all(Array.from(relevantSourceFiles).map(async (resourcePath) => {
		const resources = await sourceReader.byGlob("/**/*");
		const sourceMetadata = Object.create(null);
		await Promise.all(resources.map(async (resource) => {
			sourceMetadata[resource.getOriginalPath()] = {
				lastModified: resource.getStatInfo()?.mtimeMs,
				hash: await resource.getHash(),
			};
		}));

		return {
			timestamp: Date.now(),
			cacheKey: this.#cacheKey,
			taskCache,
			sourceMetadata,
			// globalResourceIndex,
		};
	}

	async #serializeMetadata() {
		const serializedCache = await this.toObject();
		const cacheContent = JSON.stringify(serializedCache, null, 2);
		const res = createResource({
			path: `/cache-info.json`,
			string: cacheContent,
		});
		await this.#cacheRoot.write(res);
	}

	async #serializeTaskOutputs() {
		log.info(`Serializing task outputs for project ${this.#project.getName()}`);
		await Promise.all(Array.from(this.#taskCache.keys()).map(async (taskName, idx) => {
			const reader = this.#project.getWritersForStage(taskName);
			if (!reader) {
				log.verbose(
					`Skipping serialization of empty writer for task ${taskName} in project ${this.#project.getName()}`
				);
				return;
			}
			const resources = await reader.byGlob("/**/*");

			const target = createAdapter({
				fsBasePath: path.join(this.#cacheDir, "taskCache", `${idx}-${taskName}`),
				virBasePath: "/"
			});

			for (const res of resources) {
				// if (res.getSourceMetadata().contentModified === undefined ||
				// 	res.getSourceMetadata().contentModified === true) {
				await target.write(res);
				// }
			}
		}));
	}

	async #checkSourceChanges(sourceMetadata) {
		log.verbose(`Checking for source changes for project ${this.#project.getName()}`);
		const sourceReader = this.#project.getSourceReader();
		const resources = await sourceReader.byGlob("/**/*");
		const changedResources = new Set();
		for (const resource of resources) {
			const resourcePath = resource.getOriginalPath();
			const resourceMetadata = sourceMetadata[resourcePath];
			if (!resourceMetadata) {
				// New resource
				log.verbose(`New resource: ${resourcePath}`);
				changedResources.add(resourcePath);
				continue;
			}
			if (resourceMetadata.lastModified !== resource.getStatInfo()?.mtimeMs) {
				log.verbose(`Resource changed: ${resourcePath}`);
				changedResources.add(resourcePath);
			}
			// TODO: Hash-based check can be requested by user and per project
			// The performance impact can be quite high for large projects
			/*
			if (someFlag) {
				const currentHash = await resource.getHash();
				if (currentHash !== resourceMetadata.hash) {
					log.verbose(`Resource changed: ${resourcePath}`);
					changedResources.add(resourcePath);
				}
			}*/
		}
		if (changedResources.size) {
			const tasksInvalidated = this.resourceChanged(changedResources, new Set());
			if (tasksInvalidated) {
				log.info(`Invalidating tasks due to changed resources for project ${this.#project.getName()}`);
			}
		}
	}

	async #deserializeWriter() {
		const cachedStages = await Promise.all(Array.from(this.#taskCache.keys()).map(async (taskName, idx) => {
			const fsBasePath = path.join(this.#cacheDir, "taskCache", `${idx}-${taskName}`);
			let cacheReader;
			if (await exists(fsBasePath)) {
				cacheReader = createAdapter({
					name: `Cache reader for task ${taskName} in project ${this.#project.getName()}`,
					fsBasePath,
					virBasePath: "/",
					project: this.#project,
				});
			}

			return {
				stageId: taskName,
				reader: cacheReader
			};
		}));
		this.#project.importCachedStages(cachedStages);
	}

	async serializeToDisk() {
		if (!this.#cacheRoot) {
			log.error("Cannot save cache to disk: No cache persistence available");
			return;
		}
		await Promise.all([
			await this.#serializeTaskOutputs(),
			await this.#serializeMetadata()
		]);
	}

	async attemptDeserializationFromDisk() {
		if (this.#restoreFailed || !this.#cacheRoot) {
			return;
		}
		const res = await this.#cacheRoot.byPath(`/cache-info.json`);
		if (!res) {
			this.#restoreFailed = true;
			return;
		}
		const cacheContent = JSON.parse(await res.getString());
		try {
			const projectName = this.#project.getName();
			for (const {taskName, resourceMetadata} of cacheContent.taskCache) {
				this.#taskCache.set(taskName, new BuildTaskCache(projectName, taskName, resourceMetadata));
			}
			await Promise.all([
				this.#checkSourceChanges(cacheContent.sourceMetadata),
				this.#deserializeWriter()
			]);
		} catch (err) {
			throw new Error(
				`Failed to restore cache from disk for project ${this.#project.getName()}: ${err.message}`, {
					cause: err
				});
		}
	}
}

async function exists(filePath) {
	try {
		await stat(filePath);
		return true;
	} catch (err) {
		// "File or directory does not exist"
		if (err.code === "ENOENT") {
			return false;
		} else {
			throw err;
		}
	}
}
