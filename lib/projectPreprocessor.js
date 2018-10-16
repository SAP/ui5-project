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
					throw new Error("Encountered project with missing id");
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
				log.verbose(`Processing project ${project.id} on level ${project._level}...`);

				project._level = level;

				if (project.dependencies && project.dependencies.length) {
					// Do a dependency lookahead to apply any extensions that might affect this project
					await this.dependencyLookahead(project, project.dependencies);
				}

				await this.loadProjectConfiguration(project);
				// this.applyShims(project); // shims not yet implemented
				if (this.isConfigValid(project)) {
					await this.applyType(project);
					queue.push({
						projects: project.dependencies,
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
		if (processedProject) {
			if (processedProject.ignored) {
				log.verbose(`Dependency of project ${parent.id}, "${project.id}" is flagged as ignored.`);
				parent.dependencies.splice(parent.dependencies.indexOf(project), 1);
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

		if (project.specVersion !== "0.1") {
			throw new Error(
				`Invalid specification version defined for project ${project.id}: ${project.specVersion}. ` +
				"The currently only allowed version is \"0.1\"");
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

		if (project.kind === "project" && project.type === "application" && project._level !== 0) {
			// There is only one project project of type application allowed
			// That project needs to be the root project
			log.verbose(`[Warn] Ignoring project ${project.id} with type application`+
					` (distance to root: ${project._level}). Type application is only allowed for the root project`);
			return false; // ignore this project
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

	async applyExtension(project) {
		// TOOD
	}

	async readConfigFile(configPath) {
		const configFile = await readFile(configPath);
		return parseYaml(configFile, {
			filename: path
		});
	}
}

/**
 * The Project Preprocessor enriches the dependency information with project configuration
 *
 * @module normalizer/translators/static
 */
module.exports = {
	/**
	 * Collects project information and its dependencies to enrich it with project configuration
	 *
	 * @param {Object} tree Dependency tree of the project
	 * @returns {Promise} Promise resolving with the dependency tree and enriched project configuration
	 */
	processTree: function(tree) {
		return new ProjectPreprocessor().processTree(tree);
	}
};
