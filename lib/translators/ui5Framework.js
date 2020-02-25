const log = require("@ui5/logger").getLogger("normalizer:translators:ui5Framework");

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
	}
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

		const frameworkName = tree.framework.name;
		if (frameworkName !== "SAPUI5" && frameworkName !== "OpenUI5") {
			throw new Error(`Unknown framework.name "${frameworkName}". Must be "OpenUI5" or "SAPUI5"`);
		}

		const version = tree.framework.version;
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

		await resolver.install(referencedLibraries);

		const libraries = await resolver.generateDependencyTree(referencedLibraries);

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

	// Export for testing only?
	utils
};
