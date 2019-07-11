const log = require("@ui5/logger").getLogger("normalizer:projectPreprocessor");
const fs = require("graceful-fs");
const path = require("path");
const {promisify} = require("util");
const readFile = promisify(fs.readFile);
const parseYaml = require("js-yaml").safeLoadAll;
const typeRepository = require("@ui5/builder").types.typeRepository;

class ProjectPreprocessor {
	constructor() {
		this.processedProjects = {};
		this.configShims = {};
		this.collections = {};
		this.appliedExtensions = {};
	}

	/*
		Adapt and enhance the project tree:
			- Replace duplicate projects further away from the root with those closer to the root
			- Add configuration to projects
	*/
	async processTree(tree) {
		const queue = [{
			projects: [tree],
			parent: null,
			level: 0
		}];
		const configPromises = [];
		let startTime;
		if (log.isLevelEnabled("verbose")) {
			startTime = process.hrtime();
		}

		// Breadth-first search to prefer projects closer to root
		while (queue.length) {
			const {projects, parent, level} = queue.shift(); // Get and remove first entry from queue

			// Before processing all projects on a level concurrently, we need to set all of them as being processed.
			// This prevents transitive dependencies pointing to the same projects from being processed first
			//	 by the dependency lookahead
			const projectsToProcess = projects.filter((project) => {
				if (!project.id) {
					const parentRefText = parent ? `(child of ${parent.id})` : `(root project)`;
					throw new Error(`Encountered project with missing id ${parentRefText}`);
				}
				if (this.isBeingProcessed(parent, project)) {
					return false;
				}
				// Flag this project as being processed
				this.processedProjects[project.id] = {
					project,
					// If a project is referenced multiple times in the dependency tree it is replaced
					//	with the instance that is closest to the root.
					// Here we track the parents referencing that project
					parents: [parent]
				};
				return true;
			});

			await Promise.all(projectsToProcess.map(async (project) => {
				project._level = level;
				log.verbose(`Processing project ${project.id} on level ${project._level}...`);

				if (project.dependencies && project.dependencies.length) {
					// Do a dependency lookahead to apply any extensions that might affect this project
					await this.dependencyLookahead(project, project.dependencies);
				}

				const {extensions} = await this.loadProjectConfiguration(project);
				if (extensions && extensions.length) {
					// Project contains additional extensions
					// => apply them
					// TODO: Check whether extensions get applied twice in case depLookahead already processed them
					await Promise.all(extensions.map((extProject) => {
						return this.applyExtension(extProject);
					}));
				}
				this.applyShims(project);
				if (this.isConfigValid(project)) {
					await this.applyType(project);
					queue.push({
						// copy array, so that the queue is stable while ignored project dependencies are removed
						projects: [...project.dependencies],
						parent: project,
						level: level + 1
					});
				} else {
					if (project === tree) {
						throw new Error(`Failed to configure root project "${project.id}". Please check verbose log for details.`);
					}
					// No config available
					// => reject this project by removing it from its parents list of dependencies
					log.verbose(`Ignoring project ${project.id} with missing configuration ` +
						"(might be a non-UI5 dependency)");

					const parents = this.processedProjects[project.id].parents;
					for (let i = parents.length - 1; i >= 0; i--) {
						parents[i].dependencies.splice(parents[i].dependencies.indexOf(project), 1);
					}
					this.processedProjects[project.id] = {ignored: true};
				}
			}));
		}
		return Promise.all(configPromises).then(() => {
			if (log.isLevelEnabled("verbose")) {
				const prettyHrtime = require("pretty-hrtime");
				const timeDiff = process.hrtime(startTime);
				log.verbose(`Processed ${Object.keys(this.processedProjects).length} projects in ${prettyHrtime(timeDiff)}`);
			}
			return tree;
		});
	}

	async dependencyLookahead(parent, dependencies) {
		return Promise.all(dependencies.map(async (project) => {
			if (this.isBeingProcessed(parent, project)) {
				return;
			}
			log.verbose(`Processing dependency lookahead for ${parent.id}: ${project.id}`);
			// Temporarily flag project as being processed
			this.processedProjects[project.id] = {
				project,
				parents: [parent]
			};
			const {extensions} = await this.loadProjectConfiguration(project);
			if (extensions && extensions.length) {
				// Project contains additional extensions
				// => apply them
				await Promise.all(extensions.map((extProject) => {
					return this.applyExtension(extProject);
				}));
			}

			if (project.kind === "extension") {
				// Not a project but an extension
				// => remove it as from any known projects that depend on it
				const parents = this.processedProjects[project.id].parents;
				for (let i = parents.length - 1; i >= 0; i--) {
					parents[i].dependencies.splice(parents[i].dependencies.indexOf(project), 1);
				}
				// Also ignore it from further processing by other projects depending on it
				this.processedProjects[project.id] = {ignored: true};

				if (this.isConfigValid(project)) {
					// Finally apply the extension
					await this.applyExtension(project);
				} else {
					log.verbose(`Ignoring extension ${project.id} with missing configuration`);
				}
			} else {
				// Project is not an extension: Reset processing status of lookahead to allow the real processing
				this.processedProjects[project.id] = null;
			}
		}));
	}

	isBeingProcessed(parent, project) { // Check whether a project is currently being or has already been processed
		const processedProject = this.processedProjects[project.id];
		if (project.deduped) {
			// Ignore deduped modules
			return true;
		}
		if (processedProject) {
			if (processedProject.ignored) {
				log.verbose(`Dependency of project ${parent.id}, "${project.id}" is flagged as ignored.`);
				if (parent.dependencies.includes(project)) {
					parent.dependencies.splice(parent.dependencies.indexOf(project), 1);
				}
				return true;
			}
			log.verbose(`Dependency of project ${parent.id}, "${project.id}": Distance to root of ${parent._level + 1}. Will be `+
				`replaced by project with same ID and distance to root of ${processedProject.project._level}.`);

			// Replace with the already processed project (closer to root -> preferred)
			parent.dependencies[parent.dependencies.indexOf(project)] = processedProject.project;
			processedProject.parents.push(parent);

			// No further processing needed
			return true;
		}
		return false;
	}

	async loadProjectConfiguration(project) {
		if (project.specVersion) { // Project might already be configured
			// Currently, specVersion is the indicator for configured projects
			this.normalizeConfig(project);
			return {};
		}

		let configs;

		// A projects configPath property takes precedence over the default "<projectPath>/ui5.yaml" path
		const configPath = project.configPath || path.join(project.path, "/ui5.yaml");
		try {
			configs = await this.readConfigFile(configPath);
		} catch (err) {
			const errorText = "Failed to read configuration for project " +
					`${project.id} at "${configPath}". Error: ${err.message}`;

			if (err.code !== "ENOENT") { // Something else than "File or directory does not exist"
				throw new Error(errorText);
			}
			log.verbose(errorText);
		}

		if (!configs || !configs.length) {
			return {};
		}

		for (let i = configs.length - 1; i >= 0; i--) {
			this.normalizeConfig(configs[i]);
		}

		const projectConfigs = configs.filter((config) => {
			return config.kind === "project";
		});

		const extensionConfigs = configs.filter((config) => {
			return config.kind === "extension";
		});

		const projectClone = JSON.parse(JSON.stringify(project));

		// While a project can contain multiple configurations,
		//	from a dependency tree perspective it is always a single project
		// This means it can represent one "project", plus multiple extensions or
		//	one extension, plus multiple extensions

		if (projectConfigs.length === 1) {
			// All well, this is the one. Merge config into project
			Object.assign(project, projectConfigs[0]);
		} else if (projectConfigs.length > 1) {
			throw new Error(`Found ${projectConfigs.length} configurations of kind 'project' for ` +
								`project ${project.id}. There is only one project per configuration allowed.`);
		} else if (projectConfigs.length === 0 && extensionConfigs.length) {
			// No project, but extensions
			// => choose one to represent the project -> the first one
			Object.assign(project, extensionConfigs.shift());
		} else {
			throw new Error(`Found ${configs.length} configurations for ` +
								`project ${project.id}. None are of valid kind.`);
		}

		const extensionProjects = extensionConfigs.map((config) => {
			// Clone original project
			const configuredProject = JSON.parse(JSON.stringify(projectClone));

			// Enhance project with its configuration
			Object.assign(configuredProject, config);
			return configuredProject;
		});

		return {extensions: extensionProjects};
	}

	normalizeConfig(config) {
		if (!config.kind) {
			config.kind = "project"; // default
		}
	}

	isConfigValid(project) {
		if (!project.specVersion) {
			if (project._level === 0) {
				throw new Error(`No specification version defined for root project ${project.id}`);
			}
			log.verbose(`No specification version defined for project ${project.id}`);
			return false; // ignore this project
		}

		if (project.specVersion !== "0.1" && project.specVersion !== "1.0") {
			throw new Error(
				`Unsupported specification version ${project.specVersion} defined for project ` +
				`${project.id}. ` +
				`See https://github.com/SAP/ui5-project/blob/master/docs/Configuration.md#specification-versions`);
		}

		if (!project.type) {
			if (project._level === 0) {
				throw new Error(`No type configured for root project ${project.id}`);
			}
			log.verbose(`No type configured for project ${project.id}`);
			return false; // ignore this project
		}

		if (project.kind !== "project" && project._level === 0) {
			// This is arguable. It is not the concern of ui5-project to define the entry point of a project tree
			// On the other hand, there is no known use case for anything else right now and failing early here
			//	makes sense in that regard
			throw new Error(`Root project needs to be of kind "project". ${project.id} is of kind ${project.kind}`);
		}

		if (project.kind === "project" && project.type === "application") {
			// There must be exactly one application project per dependency tree
			// If multiple are found, all but the one closest to the root are rejected (ignored)
			// If there are two projects equally close to the root, an error is being thrown
			if (!this.qualifiedApplicationProject) {
				this.qualifiedApplicationProject = project;
			} else if (this.qualifiedApplicationProject._level === project._level) {
				throw new Error(`Found at least two projects ${this.qualifiedApplicationProject.id} and ` +
					`${project.id} of type application with the same distance to the root project. ` +
					"Only one project of type application can be used. Failed to decide which one to ignore.");
			} else {
				return false; // ignore this project
			}
		}

		return true;
	}

	async applyType(project) {
		let type;
		try {
			type = typeRepository.getType(project.type);
		} catch (err) {
			throw new Error(`Failed to retrieve type for project ${project.id}: ${err.message}`);
		}
		await type.format(project);
	}

	async applyExtension(extension) {
		if (!extension.metadata || !extension.metadata.name) {
			throw new Error(`metadata.name configuration is missing for extension ${extension.id}`);
		}
		log.verbose(`Applying extension ${extension.metadata.name}...`);

		if (!extension.specVersion) {
			throw new Error(`No specification version defined for extension ${extension.metadata.name}`);
		} else if (extension.specVersion !== "0.1" && extension.specVersion !== "1.0") {
			throw new Error(
				`Unsupported specification version ${extension.specVersion} defined for extension ` +
				`${extension.metadata.name}. ` +
				`See https://github.com/SAP/ui5-project/blob/master/docs/Configuration.md#specification-versions`);
		} else if (this.appliedExtensions[extension.metadata.name]) {
			log.verbose(`Extension with the name ${extension.metadata.name} has already been applied. ` +
				"This might have been done during dependency lookahead.");
			log.verbose(`Already applied extension ID: ${this.appliedExtensions[extension.metadata.name].id}. ` +
				`New extension ID: ${extension.id}`);
			return;
		}
		this.appliedExtensions[extension.metadata.name] = extension;

		switch (extension.type) {
		case "project-shim":
			this.handleShim(extension);
			break;
		case "task":
			this.handleTask(extension);
			break;
		case "server-middleware":
			this.handleServerMiddleware(extension);
			break;
		default:
			throw new Error(`Unknown extension type '${extension.type}' for ${extension.id}`);
		}
	}

	async readConfigFile(configPath) {
		const configFile = await readFile(configPath);
		return parseYaml(configFile, {
			filename: path
		});
	}

	handleShim(extension) {
		if (!extension.shims) {
			throw new Error(`Project shim extension ${extension.id} is missing 'shim' configuration`);
		}
		const {configurations, dependencies, collections} = extension.shims;

		if (configurations) {
			log.verbose(`Project shim ${extension.id} contains ` +
				`${Object.keys(configurations)} configuration(s)`);
			for (const projectId in configurations) {
				if (configurations.hasOwnProperty(projectId)) {
					this.normalizeConfig(configurations[projectId]); // TODO: Clone object beforehand?
					if (this.configShims[projectId]) {
						log.verbose(`Project shim ${extension.id}: A configuration shim for project ${projectId} `+
							"has already been applied. Skipping.");
					} else if (this.isConfigValid(configurations[projectId])) {
						log.verbose(`Project shim ${extension.id}: Adding project configuration for ${projectId}...`);
						this.configShims[projectId] = configurations[projectId];
					} else {
						log.verbose(`Project shim ${extension.id}: Ignoring invalid ` +
							`configuration shim for project ${projectId}`);
					}
				}
			}
		}

		if (dependencies) {
			// For the time being, shimmed dependencies only apply to shimmed project configurations
			for (const projectId in dependencies) {
				if (dependencies.hasOwnProperty(projectId)) {
					if (this.configShims[projectId]) {
						log.verbose(`Project shim ${extension.id}: Adding dependencies ` +
							`to project shim '${projectId}'...`);
						this.configShims[projectId].dependencies = dependencies[projectId];
					} else {
						log.verbose(`Project shim ${extension.id}: No configuration shim found for ` +
							`project ID '${projectId}'. Dependency shims currently only apply ` +
							"to projects with configuration shims.");
					}
				}
			}
		}

		if (collections) {
			log.verbose(`Project shim ${extension.id} contains ` +
				`${Object.keys(collections).length} collection(s)`);
			for (const projectId in collections) {
				if (collections.hasOwnProperty(projectId)) {
					if (this.collections[projectId]) {
						log.verbose(`Project shim ${extension.id}: A collection with id '${projectId}' `+
							"is already known. Skipping.");
					} else {
						log.verbose(`Project shim ${extension.id}: Adding collection with id '${projectId}'...`);
						this.collections[projectId] = collections[projectId];
					}
				}
			}
		}
	}

	applyShims(project) {
		const configShim = this.configShims[project.id];
		// Apply configuration shims
		if (configShim) {
			log.verbose(`Applying configuration shim for project ${project.id}...`);

			if (configShim.dependencies && configShim.dependencies.length) {
				if (!configShim.shimDependenciesResolved) {
					configShim.dependencies = configShim.dependencies.map((depId) => {
						const depProject = this.processedProjects[depId].project;
						if (!depProject) {
							throw new Error(
								`Failed to resolve shimmed dependency '${depId}' for project ${project.id}. ` +
								`Is a dependency with ID '${depId}' part of the dependency tree?`);
						}
						return depProject;
					});
					configShim.shimDependenciesResolved = true;
				}
				configShim.dependencies.forEach((depProject) => {
					const parents = this.processedProjects[depProject.id].parents;
					if (parents.indexOf(project) === -1) {
						parents.push(project);
					} else {
						log.verbose(`Project ${project.id} is already parent of shimmed dependency ${depProject.id}`);
					}
				});
			}

			Object.assign(project, configShim);
			delete project.shimDependenciesResolved; // Remove shim processing metadata from project
		}

		// Apply collections
		for (let i = project.dependencies.length - 1; i >= 0; i--) {
			const depId = project.dependencies[i].id;
			if (this.collections[depId]) {
				log.verbose(`Project ${project.id} depends on collection ${depId}. Resolving...`);
				// This project depends on a collection
				// => replace collection dependency with first collection project.
				const collectionDep = project.dependencies[i];
				const collectionModules = this.collections[depId].modules;
				const projects = [];
				for (const projectId in collectionModules) {
					if (collectionModules.hasOwnProperty(projectId)) {
						// Clone and modify collection "project"
						const project = JSON.parse(JSON.stringify(collectionDep));
						project.id = projectId;
						project.path = path.join(project.path, collectionModules[projectId]);
						projects.push(project);
					}
				}

				// Use first collection project to replace the collection dependency
				project.dependencies[i] = projects.shift();
				// Add any additional collection projects to end of dependency array (already processed)
				project.dependencies.push(...projects);
			}
		}
	}

	handleTask(extension) {
		if (!extension.metadata && !extension.metadata.name) {
			throw new Error(`Task extension ${extension.id} is missing 'metadata.name' configuration`);
		}
		if (!extension.task) {
			throw new Error(`Task extension ${extension.id} is missing 'task' configuration`);
		}
		const taskRepository = require("@ui5/builder").tasks.taskRepository;

		const taskPath = path.join(extension.path, extension.task.path);
		const task = require(taskPath); // throws if not found

		taskRepository.addTask(extension.metadata.name, task);
	}

	handleServerMiddleware(extension) {
		if (!extension.metadata && !extension.metadata.name) {
			throw new Error(`Middleware extension ${extension.id} is missing 'metadata.name' configuration`);
		}
		if (!extension.middleware) {
			throw new Error(`Middleware extension ${extension.id} is missing 'middleware' configuration`);
		}
		const {middlewareRepository} = require("@ui5/server");

		const middlewarePath = path.join(extension.path, extension.middleware.path);
		middlewareRepository.addMiddleware(extension.metadata.name, middlewarePath);
	}
}

/**
 * The Project Preprocessor enriches the dependency information with project configuration
 *
 * @public
 * @namespace
 * @alias module:@ui5/project.projectPreprocessor
 */
module.exports = {
	/**
	 * Collects project information and its dependencies to enrich it with project configuration
	 *
	 * @public
	 * @param {Object} tree Dependency tree of the project
	 * @returns {Promise<Object>} Promise resolving with the dependency tree and enriched project configuration
	 */
	processTree: function(tree) {
		return new ProjectPreprocessor().processTree(tree);
	},
	ProjectPreprocessor
};
