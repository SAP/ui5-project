import OutputStyleEnum from "../build/helpers/ProjectBuilderOutputStyle.js";
import {getLogger} from "@ui5/logger";
import type Project from "../specifications/Project.js";
import type Extension from "../specifications/Extension.js";
import type * as taskRepositoryModule from "@ui5/builder/internal/taskRepository";
const log = getLogger("graph:ProjectGraph");

type TraversalCallback = (arg: {project: Project; dependencies: string[]}) => void | Promise<void>;
type VisitedNodes = Record<string, void | Promise<void>>;

/**
 * A rooted, directed graph representing a UI5 project, its dependencies and available extensions.
 * <br><br>
 * While it allows defining cyclic dependencies, both traversal functions will throw an error if they encounter cycles.
 *
 */
class ProjectGraph {
	_rootProjectName: string;

	_projects: Map<string, Project>;
	_adjList: Map<string, Set<string>>;
	_optAdjList: Map<string, Set<string>>;
	_extensions: Map<string, Extension>;

	_sealed: boolean;
	_hasUnresolvedOptionalDependencies: boolean;
	_taskRepository: typeof taskRepositoryModule | null;

	/**
	 * @param parameters Parameters
	 * @param parameters.rootProjectName Root project name
	 */
	constructor({rootProjectName}: {
		rootProjectName: string;
	}) {
		if (!rootProjectName) {
			throw new Error(`Could not create ProjectGraph: Missing or empty parameter 'rootProjectName'`);
		}
		this._rootProjectName = rootProjectName;

		this._projects = new Map(); // maps project name to instance (= nodes)
		this._adjList = new Map(); // maps project name to dependencies (= edges)
		this._optAdjList = new Map(); // maps project name to optional dependencies (= edges)

		this._extensions = new Map(); // maps extension name to instance

		this._sealed = false;
		this._hasUnresolvedOptionalDependencies = false; // Performance optimization flag
		this._taskRepository = null;
	}

	/**
	 * Get the root project of the graph
	 *
	 * @returns Root project
	 */
	public getRoot(): Project {
		const rootProject = this._projects.get(this._rootProjectName);
		if (!rootProject) {
			throw new Error(`Unable to find root project with name ${this._rootProjectName} in project graph`);
		}
		return rootProject;
	}

	/**
	 * Add a project to the graph
	 *
	 * @param project Project which should be added to the graph
	 */
	public addProject(project: Project) {
		this._checkSealed();
		const projectName = project.getName();
		if (this._projects.has(projectName)) {
			throw new Error(
				`Failed to add project ${projectName} to graph: A project with that name has already been added. ` +
				`This might be caused by multiple modules containing projects with the same name`);
		}
		if (!isNaN(projectName as unknown as number)) {
			// Reject integer-like project names. They would take precedence when traversing object keys which
			// could lead to unexpected behavior. We don't really expect anyone to use such names anyways
			throw new Error(
				`Failed to add project ${projectName} to graph: Project name must not be integer-like`);
		}
		log.verbose(`Adding project: ${projectName}`);
		this._projects.set(projectName, project);
		this._adjList.set(projectName, new Set());
		this._optAdjList.set(projectName, new Set());
	}

	/**
	 * Retrieve a single project from the dependency graph
	 *
	 * @param projectName Name of the project to retrieve
	 * @returns
	 *					project instance or undefined if the project is unknown to the graph
	 */
	public getProject(projectName: string) {
		return this._projects.get(projectName);
	}

	/**
	 * Get all projects in the graph
	 *
	 * @returns
	 */
	public getProjects() {
		return this._projects.values();
	}

	/**
	 * Get names of all projects in the graph
	 *
	 * @returns Names of all projects
	 */
	public getProjectNames() {
		return Array.from(this._projects.keys());
	}

	/**
	 * Get the number of projects in the graph
	 *
	 * @returns Count of projects in the graph
	 */
	public getSize() {
		return this._projects.size;
	}

	/**
	 * Add an extension to the graph
	 *
	 * @param extension Extension which should be available in the graph
	 */
	public addExtension(extension: Extension) {
		this._checkSealed();
		const extensionName = extension.getName();
		if (this._extensions.has(extensionName)) {
			throw new Error(
				`Failed to add extension ${extensionName} to graph: ` +
				`An extension with that name has already been added. ` +
				`This might be caused by multiple modules containing extensions with the same name`);
		}
		if (!isNaN(extensionName as unknown as number)) {
			// Reject integer-like extension names. They would take precedence when traversing object keys which
			// might lead to unexpected behavior in the future. We don't really expect anyone to use such names anyways
			throw new Error(
				`Failed to add extension ${extensionName} to graph: Extension name must not be integer-like`);
		}
		this._extensions.set(extensionName, extension);
	}

	/**
	 * @param extensionName Name of the extension to retrieve
	 * @returns
	 *					Extension instance or undefined if the extension is unknown to the graph
	 */
	public getExtension(extensionName: string) {
		return this._extensions.get(extensionName);
	}

	/**
	 * Get all extensions in the graph
	 *
	 * @returns
	 */
	public getExtensions() {
		return this._extensions.values();
	}

	/**
	 * Get names of all extensions in the graph
	 *
	 * @returns Names of all extensions
	 */
	public getExtensionNames() {
		return Array.from(this._extensions.keys());
	}

	/**
	 * Declare a dependency from one project in the graph to another
	 *
	 * @param fromProjectName Name of the depending project
	 * @param toProjectName Name of project on which the other depends
	 */
	public declareDependency(fromProjectName: string, toProjectName: string) {
		this._checkSealed();
		try	{
			log.verbose(`Declaring dependency: ${fromProjectName} depends on ${toProjectName}`);
			this._declareDependency(this._adjList, fromProjectName, toProjectName);
		} catch (err) {
			if (err instanceof Error) {
				throw new Error(
					`Failed to declare dependency from project ${fromProjectName} to ${toProjectName}: ` +
					err.message);
			}
			throw err;
		}
	}

	/**
	 * Declare a dependency from one project in the graph to another
	 *
	 * @param fromProjectName Name of the depending project
	 * @param toProjectName Name of project on which the other depends
	 */
	public declareOptionalDependency(fromProjectName: string, toProjectName: string) {
		this._checkSealed();
		try	{
			log.verbose(`Declaring optional dependency: ${fromProjectName} depends on ${toProjectName}`);
			this._declareDependency(this._optAdjList, fromProjectName, toProjectName);
			this._hasUnresolvedOptionalDependencies = true;
		} catch (err) {
			if (err instanceof Error) {
				throw new Error(
					`Failed to declare optional dependency from project ${fromProjectName} to ${toProjectName}: ` +
					err.message);
			}
			throw err;
		}
	}

	/**
	 * Declare a dependency from one project in the graph to another
	 *
	 * @param map Adjacency map to use
	 * @param fromProjectName Name of the depending project
	 * @param toProjectName Name of project on which the other depends
	 */
	_declareDependency(map: typeof this._adjList, fromProjectName: string, toProjectName: string) {
		if (!this._projects.has(fromProjectName)) {
			throw new Error(
				`Unable to find depending project with name ${fromProjectName} in project graph`);
		}
		if (!this._projects.has(toProjectName)) {
			throw new Error(
				`Unable to find dependency project with name ${toProjectName} in project graph`);
		}
		if (fromProjectName === toProjectName) {
			throw new Error(
				`A project can't depend on itself`);
		}
		const adjacencies = map.get(fromProjectName)!;
		if (adjacencies.has(toProjectName)) {
			log.warn(`Dependency has already been declared: ${fromProjectName} depends on ${toProjectName}`);
		} else {
			adjacencies.add(toProjectName);
		}
	}

	/**
	 * Get all direct dependencies of a project as an array of project names
	 *
	 * @param projectName Name of the project to retrieve the dependencies of
	 * @returns Names of all direct dependencies
	 */
	public getDependencies(projectName: string): string[] {
		const adjacencies = this._adjList.get(projectName);
		if (!adjacencies) {
			throw new Error(
				`Failed to get dependencies for project ${projectName}: ` +
				`Unable to find project in project graph`);
		}
		return Array.from(adjacencies);
	}

	/**
	 * Get all (direct and transitive) dependencies of a project as an array of project names
	 *
	 * @param projectName Name of the project to retrieve the dependencies of
	 * @returns Names of all direct and transitive dependencies
	 */
	public getTransitiveDependencies(projectName: string): string[] {
		const dependencies = new Set<string>();
		if (!this._projects.has(projectName)) {
			throw new Error(
				`Failed to get transitive dependencies for project ${projectName}: ` +
				`Unable to find project in project graph`);
		}

		const processDependency = (depName: string) => {
			const adjacencies = this._adjList.get(depName)!;
			adjacencies.forEach((depName) => {
				if (!dependencies.has(depName)) {
					dependencies.add(depName);
					processDependency(depName);
				}
			});
		};

		processDependency(projectName);
		return Array.from(dependencies);
	}

	/**
	 * Checks whether a dependency is optional or not.
	 * Currently only used in tests.
	 *
	 * @param fromProjectName Name of the depending project
	 * @param toProjectName Name of project on which the other depends
	 * @returns True if the dependency is currently optional
	 */
	private isOptionalDependency(fromProjectName: string, toProjectName: string) {
		const adjacencies = this._adjList.get(fromProjectName);
		if (!adjacencies) {
			throw new Error(
				`Failed to determine whether dependency from ${fromProjectName} to ${toProjectName} ` +
				`is optional: ` +
				`Unable to find project with name ${fromProjectName} in project graph`);
		}
		if (adjacencies.has(toProjectName)) {
			return false;
		}
		const optAdjacencies = this._optAdjList.get(fromProjectName)!;
		if (optAdjacencies.has(toProjectName)) {
			return true;
		}
		return false;
	}

	public async resolveOptionalDependencies() {
		this._checkSealed();
		if (!this._hasUnresolvedOptionalDependencies) {
			log.verbose(`Skipping resolution of optional dependencies since none have been declared`);
			return;
		}
		log.verbose(`Resolving optional dependencies...`);

		// First collect all projects that are currently reachable from the root project (=all non-optional projects)
		const resolvedProjects = new Set();
		await this.traverseBreadthFirst(({project}) => {
			resolvedProjects.add(project.getName());
		});

		let unresolvedOptDeps = false;
		for (const [fromProjectName, optDependencies] of this._optAdjList) {
			for (const toProjectName of optDependencies) {
				if (resolvedProjects.has(toProjectName)) {
					// Target node is already reachable in the graph
					// => Resolve optional dependency
					log.verbose(`Resolving optional dependency from ${fromProjectName} to ${toProjectName}...`);

					if (this._adjList.get(toProjectName).has(fromProjectName)) {
						log.verbose(
							`  Cyclic optional dependency detected: ${toProjectName} already has a non-optional ` +
							`dependency to ${fromProjectName}`);
						log.verbose(
							`  Optional dependency from ${fromProjectName} to ${toProjectName} ` +
							`will not be declared as it would introduce a cycle`);
						unresolvedOptDeps = true;
					} else {
						this.declareDependency(fromProjectName, toProjectName);
						// This optional dependency has now been resolved
						// => Remove it from the list of optional dependencies
						optDependencies.delete(toProjectName);
					}
				} else {
					unresolvedOptDeps = true;
				}
			}
		}
		if (!unresolvedOptDeps) {
			this._hasUnresolvedOptionalDependencies = false;
		}
	}

	public async traverseBreadthFirst(startName?: string, callback?: TraversalCallback) {
		if (!callback) {
			// Default optional first parameter
			callback = startName as unknown as TraversalCallback;
			startName = this._rootProjectName;
		}

		if (!this.getProject(startName!)) {
			throw new Error(`Failed to start graph traversal: Could not find project ${startName} in project graph`);
		}

		const queue = [{
			projectNames: [startName] as string[],
			ancestors: [] as string[],
		}];

		const visited = Object.create(null) as VisitedNodes;

		while (queue.length) {
			const {projectNames, ancestors} = queue.shift()!; // Get and remove first entry from queue

			await Promise.all(projectNames.map(async (projectName) => {
				this._checkCycle(ancestors, projectName);

				if (visited[projectName]) {
					return visited[projectName];
				}

				return visited[projectName] = (async () => {
					const newAncestors = [...ancestors, projectName];
					const dependencies = this.getDependencies(projectName);

					queue.push({
						projectNames: dependencies,
						ancestors: newAncestors,
					});

					await callback({
						project: this.getProject(projectName),
						dependencies,
					});
				})();
			}));
		}
	}

	public async traverseDepthFirst(startName?: string, callback?: TraversalCallback) {
		if (!callback) {
			// Default optional first parameter
			callback = startName as unknown as TraversalCallback;
			startName = this._rootProjectName;
		}

		if (!this.getProject(startName!)) {
			throw new Error(`Failed to start graph traversal: Could not find project ${startName} in project graph`);
		}
		return this._traverseDepthFirst(startName!, Object.create(null) as VisitedNodes, [], callback);
	}

	async _traverseDepthFirst(
		projectName: string, visited: VisitedNodes, ancestors: string[], callback: TraversalCallback
	) {
		this._checkCycle(ancestors, projectName);

		if (visited[projectName]) {
			return visited[projectName];
		}
		return visited[projectName] = (async () => {
			const newAncestors = [...ancestors, projectName];
			const dependencies = this.getDependencies(projectName);
			await Promise.all(dependencies.map((depName) => {
				return this._traverseDepthFirst(depName, visited, newAncestors, callback);
			}));

			await callback({
				project: this.getProject(projectName),
				dependencies,
			});
		})();
	}

	/**
	 * Join another project graph into this one.
	 * Projects and extensions which already exist in this graph will cause an error to be thrown
	 *
	 * @param projectGraph Project Graph to merge into this one
	 */
	public join(projectGraph: ProjectGraph) {
		try {
			this._checkSealed();
			if (!projectGraph.isSealed()) {
				// Seal input graph to prevent further modification
				log.verbose(
					`Sealing project graph with root project ${projectGraph._rootProjectName} ` +
					`before joining it into project graph with root project ${this._rootProjectName}...`);
				projectGraph.seal();
			}
			mergeMap(this._projects, projectGraph._projects);
			mergeMap(this._extensions, projectGraph._extensions);
			mergeMap(this._adjList, projectGraph._adjList);
			mergeMap(this._optAdjList, projectGraph._optAdjList);

			this._hasUnresolvedOptionalDependencies =
				this._hasUnresolvedOptionalDependencies || projectGraph._hasUnresolvedOptionalDependencies;
		} catch (err) {
			throw new Error(
				`Failed to join project graph with root project ${projectGraph._rootProjectName} into ` +
				`project graph with root project ${this._rootProjectName}: ${err.message}`);
		}
	}

	// Only to be used by @ui5/builder tests to inject its version of the taskRepository
	setTaskRepository(taskRepository: typeof taskRepositoryModule) {
		this._taskRepository = taskRepository;
	}

	async _getTaskRepository() {
		if (!this._taskRepository) {
			try {
				this._taskRepository = await import("@ui5/builder/internal/taskRepository");
			} catch (err) {
				if (err instanceof Error) {
					throw new Error(
						`Failed to load task repository. Missing dependency to '@ui5/builder'? ` +
						`Error: ${err.message}`);
				}
				throw err;
			}
		}
		return this._taskRepository;
	}

	public async build({destPath, cleanDest = false, includedDependencies = [], excludedDependencies = [], dependencyIncludes, selfContained = false, cssVariables = false, jsdoc = false, createBuildManifest = false, includedTasks = [], excludedTasks = [], outputStyle = OutputStyleEnum.Default}: {
		destPath: string;
		cleanDest?: boolean;
		includedDependencies?: (string | RegExp)[];
		excludedDependencies?: (string | RegExp)[];
	}) {
		this.seal(); // Do not allow further changes to the graph
		if (this._built) {
			throw new Error(
				`Project graph with root node ${this._rootProjectName} has already been built. ` +
				`Each graph can only be built once`);
		}
		this._built = true;
		const {
			default: ProjectBuilder,
		} = await import("../build/ProjectBuilder.js");
		const builder = new ProjectBuilder({
			graph: this,
			taskRepository: await this._getTaskRepository(),
			buildConfig: {
				selfContained, cssVariables, jsdoc,
				createBuildManifest,
				includedTasks, excludedTasks, outputStyle,
			},
		});
		await builder.build({
			destPath, cleanDest,
			includedDependencies, excludedDependencies,
			dependencyIncludes,
		});
	}

	/**
	 * Seal the project graph so that no further changes can be made to it
	 *
	 */
	public seal() {
		this._sealed = true;
	}

	/**
	 * Check whether the project graph has been sealed.
	 * This means the graph is read-only. Neither projects, nor dependencies between projects
	 * can be added or removed.
	 *
	 * @returns True if the project graph has been sealed
	 */
	public isSealed() {
		return this._sealed;
	}

	/**
	 * Helper function to check and throw in case the project graph has been sealed.
	 * Intended for use in any function that attempts to make changes to the graph.
	 *
	 * @throws Throws in case the project graph has been sealed
	 */
	_checkSealed() {
		if (this._sealed) {
			throw new Error(`Project graph with root node ${this._rootProjectName} has been sealed and is read-only`);
		}
	}

	_checkCycle(ancestors: string[], projectName: string) {
		if (ancestors.includes(projectName)) {
			// "Back-edge" detected. Neither BFS nor DFS searches should continue
			// Mark first and last occurrence in chain with an asterisk and throw an error detailing the
			// problematic dependency chain
			ancestors[ancestors.indexOf(projectName)] = `*${projectName}*`;
			throw new Error(`Detected cyclic dependency chain: ${ancestors.join(" -> ")} -> *${projectName}*`);
		}
	}

	// TODO: introduce function to check for dangling nodes/consistency in general?
}

function mergeMap(target: Map<string, string | Set<string>>, source: Map<string, string | Set<string>>) {
	for (const [key, value] of source) {
		if (target.has(key)) {
			throw new Error(`Failed to merge map: Key '${key}' already present in target set`);
		}
		if (value instanceof Set) {
			// Shallow-clone any Sets
			target.set(key, new Set(value));
		} else {
			target.set(key, value);
		}
	}
}

export default ProjectGraph;
