const ResourceTagCollection = require("@ui5/fs").ResourceTagCollection;
const resourceFactory = require("@ui5/fs").resourceFactory;
const ProjectBuildContext = require("./ProjectBuildContext");

// Note: When adding standard tags, always update the public documentation in TaskUtil
// (Type "module:@ui5/builder.tasks.TaskUtil~StandardBuildTags")
const GLOBAL_TAGS = Object.freeze({
	IsDebugVariant: "ui5:IsDebugVariant",
	HasDebugVariant: "ui5:HasDebugVariant",
});

/**
 * Context of a build process
 *
 * @private
 * @memberof module:@ui5/builder.builder
 */
class BuildContext {
	constructor({graph, options = {}}) {
		if (!graph) {
			throw new Error(`Missing parameter 'graph'`);
		}
		this._graph = graph;
		this.projectBuildContexts = [];
		this._resourceTagCollection = new ResourceTagCollection({
			allowedTags: Object.values(GLOBAL_TAGS)
		});
		this.options = options;

		this._readerCollectionCache = {};
		this._readerCollectionCacheWithTestResources = {};
	}

	getRootProject() {
		return this._graph.getRoot();
	}

	getOption(key) {
		return this.options[key];
	}

	createProjectContext({project}) {
		const projectBuildContext = new ProjectBuildContext({
			buildContext: this,
			globalTags: GLOBAL_TAGS,
			project
		});
		this.projectBuildContexts.push(projectBuildContext);
		return projectBuildContext;
	}

	async executeCleanupTasks() {
		await Promise.all(this.projectBuildContexts.map((ctx) => {
			return ctx.executeCleanupTasks();
		}));
	}

	getResourceTagCollection() {
		return this._resourceTagCollection;
	}

	async getDependenciesReader({projectName, includeTestResources}) {
		if (!includeTestResources && this._readerCollectionCache[projectName]) {
			return this._readerCollectionCache[projectName];
		} else if (includeTestResources && this._readerCollectionCacheWithTestResources[projectName]) {
			return this._readerCollectionCacheWithTestResources[projectName];
		}
		const readers = [];
		await this._graph.traverseBreadthFirst(async function(dep) {
			readers.push(dep.getReader({
				includeTestResources
			}));
		}, projectName);
		const readerCollection = resourceFactory.createReaderCollection({
			name: `Dependency reader collection for project ${projectName}`,
			readers
		});

		if (!includeTestResources) {
			return this._readerCollectionCache[projectName] = readerCollection;
		} else if (includeTestResources) {
			return this._readerCollectionCacheWithTestResources[projectName] = readerCollection;
		}
	}
}

module.exports = BuildContext;
