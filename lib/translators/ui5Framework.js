const log = require("@ui5/logger").getLogger("normalizer:translators:ui5Framework");

class ProjectProcessor {
	constructor({libraryMetadata}) {
		this._libraryMetadata = libraryMetadata;
		this._projectCache = {};
	}
	getProject(libName) {
		log.verbose(`Creating project for library ${libName}...`);

		if (this._projectCache[libName]) {
			log.verbose(`Returning cached project for library ${libName}`);
			return this._projectCache[libName];
		}

		if (!this._libraryMetadata[libName]) {
			throw new Error(`Failed to find library ${libName} in dist packages metadata.json`);
		}

		const depMetadata = this._libraryMetadata[libName];

		const dependencies = [];
		dependencies.push(...depMetadata.dependencies.map((depName) => {
			return this.getProject(depName);
		}));

		if (depMetadata.optionalDependencies) {
			const resolvedOptionals = depMetadata.optionalDependencies.map((depName) => {
				if (this._libraryMetadata[depName]) {
					log.verbose(`Resolving optional dependency ${depName} for project ${libName}...`);
					return this.getProject(depName);
				}
			}).filter(($)=>$);

			dependencies.push(...resolvedOptionals);
		}

		this._projectCache[libName] = {
			id: depMetadata.id,
			version: depMetadata.version,
			path: depMetadata.path,
			dependencies
		};
		return this._projectCache[libName];
	}
}

const utils = {
	getAllNodesOfTree(tree) {
		const nodes = {};
		const queue = [...tree];
		while (queue.length) {
			const project = queue.shift();
			if (!nodes[project.metadata.name]) {
				nodes[project.metadata.name] = project;
				queue.push(...project.dependencies);
			}
		}
		return nodes;
	},
	isFrameworkProject(project) {
		return project.id.startsWith("@openui5/") || project.id.startsWith("@sapui5/");
	},
	getFrameworkLibrariesFromTree(project, ui5Dependencies = [], root = true) {
		if (utils.isFrameworkProject(project)) {
			// Ignoring UI5 Framework libraries in dependencies
			return ui5Dependencies;
		}
		if (project.framework && project.framework.libraries) {
			project.framework.libraries.forEach((dependency) => {
				if (!ui5Dependencies.includes(dependency.name) && (root || !dependency.optional)) {
					ui5Dependencies.push(dependency.name);
				}
			});
		} else {
			log.verbose(`Project ${project.metadata.name} defines no framework.libraries configuration`);
			// TODO fallback
		}
		project.dependencies.map((depProject) => {
			utils.getFrameworkLibrariesFromTree(depProject, ui5Dependencies, false);
		});
		return ui5Dependencies;
	},
	ProjectProcessor
};

/**
 *
 *
 * @public
 * @namespace
 * @alias module:@ui5/project.framework.installer
 */
module.exports = {
	/**
	 *
	 *
	 * @public
	 * @param {Object} tree
	 * @param {Object} options
	 * @returns {Promise<Object|null>} Promise
	 */
	generateDependencyTree: async function(tree, options = {}) {
		// Don't create a tree when root project doesn't have a framework configuration
		if (!tree.framework) {
			return null;
		}

		const projectName = (tree.metadata && tree.metadata.name) || tree.id;

		const frameworkName = tree.framework.name;
		if (frameworkName !== "SAPUI5" && frameworkName !== "OpenUI5") {
			throw new Error(
				`${projectName} (${tree.version}): Unknown framework.name "${frameworkName}". Must be "OpenUI5" or "SAPUI5"`
			);
		}

		const version = tree.framework.version;
		if (!version) {
			throw new Error(
				`${projectName} (${tree.version}): framework.version is not defined`
			);
		}
		log.info(`Using ${frameworkName} version: ${version}`);

		const referencedLibraries = utils.getFrameworkLibrariesFromTree(tree);

		let resolver;
		if (frameworkName === "OpenUI5") {
			const Openui5Resolver = require("../ui5Framework/Openui5Resolver");
			resolver = new Openui5Resolver({cwd: tree.path, version});
		} else if (frameworkName === "SAPUI5") {
			const Sapui5Resolver = require("../ui5Framework/Sapui5Resolver");
			resolver = new Sapui5Resolver({cwd: tree.path, version});
		}

		let startTime;
		if (log.isLevelEnabled("verbose")) {
			startTime = process.hrtime();
		}

		const {libraryMetadata} = await resolver.install(referencedLibraries);

		if (log.isLevelEnabled("verbose")) {
			const timeDiff = process.hrtime(startTime);
			const prettyHrtime = require("pretty-hrtime");
			log.verbose(`${frameworkName} dependencies ${referencedLibraries.join(", ")} resolved in ${prettyHrtime(timeDiff)}`);
		}

		const projectProcessor = new utils.ProjectProcessor({
			libraryMetadata
		});

		const libraries = referencedLibraries.map((libName) => {
			return projectProcessor.getProject(libName);
		});

		// Use root project (=requesting project) as root of framework tree
		const frameworkTree = {
			id: tree.id,
			version: tree.version,
			path: tree.path,
			dependencies: libraries
		};
		return frameworkTree;
	},

	mergeTrees: function(projectTree, frameworkTree) {
		const frameworkLibs = utils.getAllNodesOfTree(frameworkTree.dependencies);

		log.verbose(`Merging framework tree into project tree "${projectTree.metadata.name}"`);

		const queue = [projectTree];
		while (queue.length) {
			const project = queue.shift();

			project.dependencies = project.dependencies.filter((depProject) => {
				if (utils.isFrameworkProject(depProject)) {
					log.verbose(
						`A translator has already added the UI5 framework library ${depProject.metadata.name} ` +
						`(id: ${depProject.id}) to the dependencies of project ${project.metadata.name}. ` +
						`This dependency will be ignored.`);
					log.info(`If project ${project.metadata.name} contains a package.json in which it defines a ` +
						`dependency to the UI5 framework library ${depProject.id}, this dependency should be removed.`);
					return false;
				}
				return true;
			});
			queue.push(...project.dependencies);

			if (project.framework && project.framework.libraries) {
				const frameworkDeps = project.framework.libraries.map((dependency) => {
					if (!frameworkLibs[dependency.name]) {
						throw new Error(`Missing framework library ${dependency.name} ` +
							`required by project ${project.metadata.name}`);
					}
					return frameworkLibs[dependency.name];
				});
				project.dependencies.push(...frameworkDeps);
			}
		}
		return projectTree;
	},

	// Export for testing only
	_utils: utils
};
