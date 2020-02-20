const fs = require("graceful-fs");
const {promisify} = require("util");
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const path = require("path");
const log = require("@ui5/logger").getLogger("normalizer:translators:ui5Framework");

const DIST_PKG_NAME = "@sapui5/distribution-metadata";

class Registry {
	constructor({cacheDir}) {
		this._pacote = require("pacote");
		this._cacheDir = cacheDir;
	}
	requestPackageManifest(pkgName, version) {
		return this._pacote.manifest(`${pkgName}@${version}`, this._getPacoteOptions());
	}
	extractPackage(pkgName, version, targetDir) {
		return this._pacote.extract(`${pkgName}@${version}`, targetDir, this._getPacoteOptions());
	}
	_getPacoteOptions() {
		if (!this._npmConfig) {
			const libnpmconfig = require("libnpmconfig");
			const config = libnpmconfig.read({
				log: log.isLevelEnabled("verbose") ? log._getLogger() : undefined,
				cache: this._cacheDir
			}, {
				cwd: this._cwd
			});

			log.verbose(`Using npm configuration (extract):`);
			// Do not log full configuration as it may contain authentication tokens
			log.verbose(`	registry: ${config["registry"]}`);
			log.verbose(`	cache: ${config["cache"]}`);
			log.verbose(`	proxy: ${config["proxy"]}`);

			this._npmConfig = config;
		}

		// Use cached config
		return this._npmConfig;
	}
}

class FrameworkResolver {
	constructor({cwd, version}) {
		if (!cwd) {
			// TODO: default to process.cwd()?
			throw new Error(`FrameworkResolver: Missing parameter "cwd"`);
		}
		if (!version) {
			throw new Error(`FrameworkResolver: Missing parameter "version"`);
		}

		this._cwd = cwd;
		this._version = version;

		const homedir = require("os").homedir();
		this._baseDir = path.join(homedir, ".ui5", "framework", "packages");
		this._cacheDir = path.join(homedir, ".ui5", "framework", "cacache");
		log.verbose(`Installing to: ${this._baseDir}`);
		this._registry = new Registry({cacheDir: this._cacheDir});

		// Initialize metadata and libraries information
		this.metadata = {libraries: {}};
		this.libraries = {};

		this._projectCache = {};

		this._installedCounter = 0;
		this._cachedCounter = 0;
	}

	async _processLibrary(libraryName) {
		// Check if library is already processed
		if (this.libraries[libraryName]) {
			return;
		}
		// Mark library as handled
		this.libraries[libraryName] = true;

		const {libraryMetadata, install} = await this.handleLibrary(libraryName);

		// Handle dependencies
		if (libraryMetadata.dependencies.length > 0) {
			await Promise.all(libraryMetadata.dependencies.map((libraryName) => {
				return this._processLibrary(libraryName);
			}));
		}

		// Wait until library is installed before resolving
		await install;
	}

	async install(libraryNames) {
		let startTime;
		if (log.isLevelEnabled("verbose")) {
			startTime = process.hrtime();
		}

		await this.prepare();

		await Promise.all(libraryNames.map((libraryName) => {
			return this._processLibrary(libraryName);
		}));

		if (log.isLevelEnabled("verbose")) {
			const timeDiff = process.hrtime(startTime);
			const prettyHrtime = require("pretty-hrtime");
			log.verbose(`Installed ${this._installedCounter} packages and used ${this._cachedCounter} ` +
				`packages from cache in ${prettyHrtime(timeDiff)}`);
		}
	}

	async _fetchPackageManifest({pkgName, version = this._version, targetDir = this._getTargetDirForPackage({pkgName, version})}) {
		try {
			const pkg = JSON.parse(await readFile(path.join(targetDir, "package.json"), {encoding: "utf8"}));
			return {
				name: pkg.name,
				dependencies: pkg.dependencies,
				devDependencies: pkg.devDependencies
			};
		} catch (err) {
			if (err.code === "ENOENT") { // "File or directory does not exist"
				const manifest = await this._registry.requestPackageManifest(pkgName, version);
				return {
					name: manifest.name,
					dependencies: manifest.dependencies,
					devDependencies: manifest.devDependencies
				};
			} else {
				throw err;
			}
		}
	}

	async _installPackage({pkgName, version, targetDir = this._getTargetDirForPackage({pkgName, version})}) {
		try {
			await stat(path.join(targetDir, "package.json"));
			log.verbose(`Alrady installed: ${pkgName} in version ${version}`);
			this._cachedCounter++;
		} catch (err) {
			if (err.code === "ENOENT") { // "File or directory does not exist"
				log.info(`Installing ${pkgName}...`);
				log.verbose(`Installing ${pkgName} in version ${version}...`);
				await this._registry.extractPackage(pkgName, version, targetDir);
				this._installedCounter++;
			} else {
				throw err;
			}
		}
	}

	_getTargetDirForPackage({pkgName, version}) {
		return path.join(this._baseDir, ...pkgName.split("/"), version);
	}

	generateDependencyTree(libraryNames) {
		const requestedLibraries = Object.keys(this.libraries);
		const tree = libraryNames.map((libName) => {
			return this._getProject({
				libName,
				requestedLibraries
			});
		});
		return tree;
	}

	_getProject({requestedLibraries, libName}) {
		log.verbose(`Creating project for library ${libName}...`);

		if (this._projectCache[libName]) {
			log.verbose(`Returning cached project for library ${libName}`);
			return this._projectCache[libName];
		}

		if (!this.metadata.libraries[libName]) {
			throw new Error(`Failed to find library ${libName} in dist packages metadata.json`);
		}

		const depMetadata = this.metadata.libraries[libName];

		const dependencies = [];
		dependencies.push(...depMetadata.dependencies.map((depName) => {
			return this._getProject({
				libName: depName,
				requestedLibraries
			});
		}));

		if (depMetadata.optionalDependencies) {
			const resolvedOptionals = depMetadata.optionalDependencies.map((depName) => {
				if (requestedLibraries.includes(depName)) {
					log.verbose(`Resolving optional dependency ${depName} for project ${libName}...`);
					return this._getProject({
						libName: depName,
						requestedLibraries
					});
				}
			}).filter(($)=>$);

			dependencies.push(...resolvedOptionals);
		}

		this._projectCache[libName] = {
			id: depMetadata.npmPackageName,
			version: depMetadata.version,
			path: this._getTargetDirForPackage({
				pkgName: depMetadata.npmPackageName,
				version: depMetadata.version
			}),
			dependencies
		};
		return this._projectCache[libName];
	}

	// To be implemented by resolver
	async prepare() {}
	async handleLibrary(libraryName) {
		throw new Error("Not implemented!");
	}
}

class FrameworkResolverOpenUI5 extends FrameworkResolver {
	_getNpmPackageName(libraryName) {
		return "@openui5/" + libraryName;
	}
	_getLibaryName(pkgName) {
		return pkgName.replace(/^@openui5\//, "");
	}
	async _getLibraryMetadata(libraryName) {
		if (!this.metadata[libraryName]) {
			// Trigger manifest request to gather transitive dependencies
			const pkgName = this._getNpmPackageName(libraryName);
			const libraryManifest = await this._fetchPackageManifest({pkgName});
			let dependencies = [];
			if (libraryManifest.dependencies) {
				dependencies = Object.keys(libraryManifest.dependencies).map(this._getLibaryName);
			}

			// npm devDependencies are handled as "optionalDependencies"
			// in terms of the UI5 framework metadata structure
			let optionalDependencies = [];
			if (libraryManifest.devDependencies) {
				optionalDependencies = Object.keys(libraryManifest.devDependencies).map(this._getLibaryName);
			}

			// Add metadata entry
			this.metadata.libraries[libraryName] = {
				npmPackageName: pkgName,
				version: this._version,
				dependencies,
				optionalDependencies
			};
		}
		return this.metadata.libraries[libraryName];
	}
	async handleLibrary(libraryName) {
		const pkgName = this._getNpmPackageName(libraryName);

		// Trigger metadata request
		const pMetadata = this._getLibraryMetadata(libraryName);

		// Also trigger installation of package
		const install = this._installPackage({
			pkgName,
			version: this._version
		});

		const libraryMetadata = await pMetadata;

		return {libraryMetadata, install};
	}
}

class FrameworkResolverSAPUI5 extends FrameworkResolver {
	async prepare() {
		if (!this._loadDistMetadata) {
			this._loadDistMetadata = Promise.resolve().then(async () => {
				const version = this._version;
				log.verbose(`Using dist package in version ${version}...`);
				const pkgName = DIST_PKG_NAME;
				const targetDir = this._getTargetDirForPackage({pkgName, version});
				await this._installPackage({
					pkgName,
					version,
					targetDir
				});

				this.metadata = require(path.join(targetDir, "metadata.json"));
			});
		}
		await this._loadDistMetadata;
	}
	async handleLibrary(libraryName) {
		const libraryMetadata = this.metadata.libraries[libraryName];

		// Trigger installation of package
		const install = this._installPackage({
			pkgName: libraryMetadata.npmPackageName,
			version: libraryMetadata.version
		});

		return {libraryMetadata, install};
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
			resolver = new FrameworkResolverOpenUI5({cwd: tree.path, version});
		} else if (frameworkName === "SAPUI5") {
			resolver = new FrameworkResolverSAPUI5({cwd: tree.path, version});
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

	FrameworkResolver,
	FrameworkResolverOpenUI5,
	FrameworkResolverSAPUI5,
	Registry,

	// Export for testing only?
	utils
};
