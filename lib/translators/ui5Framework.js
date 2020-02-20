const pacote = require("pacote");
const fs = require("graceful-fs");
const {promisify} = require("util");
const stat = promisify(fs.stat);
const path = require("path");
const log = require("@ui5/logger").getLogger("normalizer:translators:ui5Framework");

const DIST_PKG_NAME = "@sapui5/distribution-metadata";


class FrameworkResolver {
	constructor({installer}) {
		this.installer = installer;
		this.metadata = null;
		this.libraries = {}; // { libraryName, version }
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
		await this.prepare();

		await Promise.all(libraryNames.map((libraryName) => {
			return this._processLibrary(libraryName);
		}));
	}

	generateDependencyTree(libraryNames) {
		const requestedLibraries = Object.keys(this.libraries);
		const tree = libraryNames.map((libName) => {
			return this.installer._getProject({
				libName,
				metadata: this.metadata,
				requestedLibraries
			});
		});
		return tree;
	}

	// To be implemented by resolver
	async prepare() {}
	getNpmPackageName(libraryName) {
		throw new Error("Not implemented!");
	}
	async getLibraryMetadata(libraryName) {
		throw new Error("Not implemented!");
	}
	async handleLibrary(libraryName) {
		throw new Error("Not implemented!");
	}
}

class FrameworkResolverOpenUI5 extends FrameworkResolver {
	constructor({installer}) {
		super({installer});
		this._metadataCache = {};
		this.metadata = {libraries: {}};
	}
	getNpmPackageName(libraryName) {
		return "@openui5/" + libraryName;
	}
	async getLibraryMetadata(libraryName) {
		if (!this._metadataCache[libraryName]) {
			this._metadataCache[libraryName] = Promise.resolve().then(async () => {
				// Trigger manifest request to gather transitive dependencies
				const libraryMetadata = await this.installer._requestPackageManifest(this.getNpmPackageName(libraryName), this.installer._version);
				let dependencies = [];
				if (libraryMetadata.dependencies) {
					dependencies = Object.keys(libraryMetadata.dependencies).map((pkgName) => pkgName.substr("@openui5/".length));
				}
				let optionalDependencies = [];
				// npm devDependencies are handled as "optionalDependencies" in terms of the UI5 framework metadata structure
				if (libraryMetadata.devDependencies) {
					optionalDependencies = Object.keys(libraryMetadata.devDependencies).map((pkgName) => pkgName.substr("@openui5/".length));
				}

				// Add metadata entry
				this.metadata.libraries[libraryName] = {
					npmPackageName: this.getNpmPackageName(libraryName),
					version: this.installer._version,
					dependencies,
					optionalDependencies
				};
				return this.metadata.libraries[libraryName];
			});
		}
		return this._metadataCache[libraryName];
	}
	async handleLibrary(libraryName) {
		const pkgName = this.getNpmPackageName(libraryName);

		// Trigger metadata request
		const pMetadata = this.getLibraryMetadata(libraryName);

		// Also trigger installation of package
		const install = this.installer._installPackage({
			pkgName,
			version: this.installer._version
		});

		const libraryMetadata = await pMetadata;

		return {libraryMetadata, install};
	}
}

class FrameworkResolverSAPUI5 extends FrameworkResolver {
	async prepare() {
		this.metadata = await this.installer._getDistMetadata();
	}
	getNpmPackageName(libraryName) {
		return this.metadata.libraries[libraryName].npmPackageName;
	}
	async getLibraryMetadata(libraryName) {
		return this.metadata.libraries[libraryName];
	}
	async handleLibrary(libraryName) {
		const libraryMetadata = await this.getLibraryMetadata(libraryName);

		// Trigger installation of package
		const install = this.installer._installPackage({
			pkgName: libraryMetadata.npmPackageName,
			version: libraryMetadata.version
		});

		return {libraryMetadata, install};
	}
}


class FrameworkInstaller {
	constructor({dirPath, name, version}) {
		if (!dirPath) {
			throw new Error(`FrameworkInstaller: Missing parameter "dirPath"`);
		}
		if (!name) {
			throw new Error(`FrameworkInstaller: Missing parameter "name"`);
		}
		if (name !== "SAPUI5" && name !== "OpenUI5") {
			throw new Error(
				`FrameworkInstaller: Invalid value "${name}" for parameter "name". Must be "OpenUI5" or "SAPUI5"`
			);
		}
		if (!version) {
			throw new Error(`FrameworkInstaller: Missing parameter "version"`);
		}

		if (name === "OpenUI5") {
			this._resolver = new FrameworkResolverOpenUI5({installer: this});
		} else if (name === "SAPUI5") {
			this._resolver = new FrameworkResolverSAPUI5({installer: this});
		}

		this._cwd = dirPath;

		const homedir = require("os").homedir();
		this._baseDir = path.join(homedir, ".ui5", "framework", "packages");
		this._cacheDir = path.join(homedir, ".ui5", "framework", "cacache");
		log.verbose(`Installing to: ${this._baseDir}`);

		this._name = name;

		this._metadataCache = null;
		this._projectCache = {};

		this._installedCounter = 0;
		this._cachedCounter = 0;

		this._version = version;
	}

	_requestPackageManifest(pkgName, version) {
		return pacote.manifest(`${pkgName}@${version}`, this._getPacoteOptions());
	}

	async installViaResolver(libraryNames) {
		await this._resolver.install(libraryNames);
	}

	generateDependencyTreeViaResolver(libraryNames) {
		return this._resolver.generateDependencyTree(libraryNames);
	}

	async install({libraryNames}) {
		let startTime;
		if (log.isLevelEnabled("verbose")) {
			startTime = process.hrtime();
		}

		await this._resolver.install(libraryNames);

		if (log.isLevelEnabled("verbose")) {
			const prettyHrtime = require("pretty-hrtime");
			const timeDiff = process.hrtime(startTime);
			log.verbose(`Installed ${this._installedCounter} packages and used ${this._cachedCounter} ` +
				`packages from cache in ${prettyHrtime(timeDiff)}`);
		}
	}

	// TODO: no async needed
	generateDependencyTree({libraryNames}) {
		return this._resolver.generateDependencyTree(libraryNames);
	}

	_getPacoteOptions() {
		if (this._npmConfig) {
			// Use cached config
			return this._npmConfig;
		}

		const libnpmconfig = require("libnpmconfig");
		const config = libnpmconfig.read({
			log: log.isLevelEnabled("verbose") ? log._getLogger() : undefined,
			cache: this._cacheDir
		}, {
			cwd: this._cwd
		}).toJSON(); // un-pudding

		log.verbose(`Using npm configuration (extract):`);
		// Do not log full configuration as it may contain authentication tokens
		log.verbose(`	registry: ${config["registry"]}`);
		log.verbose(`	cache: ${config["cache"]}`);
		log.verbose(`	proxy: ${config["proxy"]}`);

		return this._npmConfig = config;
	}

	_getProject({requestedLibraries, libName, metadata}) {
		log.verbose(`Creating project for library ${libName}...`);

		if (this._projectCache[libName]) {
			log.verbose(`Returning cached project for library ${libName}`);
			return this._projectCache[libName];
		}

		if (!metadata.libraries[libName]) {
			throw new Error(`Failed to find library ${libName} in dist packages metadata.json`);
		}

		const depMetadata = metadata.libraries[libName];

		const dependencies = [];
		dependencies.push(...depMetadata.dependencies.map((depName) => {
			return this._getProject({
				libName: depName,
				metadata,
				requestedLibraries
			});
		}));

		if (depMetadata.optionalDependencies) {
			const resolvedOptionals = depMetadata.optionalDependencies.map((depName) => {
				if (requestedLibraries.includes(depName)) {
					log.verbose(`Resolving optional dependency ${depName} for project ${libName}...`);
					return this._getProject({
						libName: depName,
						metadata,
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

	async _getDistMetadata() {
		if (this._metadataCache) {
			return this._metadataCache;
		}
		this._metadataCache = Promise.resolve().then(async () => {
			const version = this._version;
			log.verbose(`Using dist package in version ${version}...`);
			const pkgName = DIST_PKG_NAME;
			const targetDir = this._getTargetDirForPackage({pkgName, version});
			await this._installPackage({
				pkgName,
				version,
				targetDir
			});

			const metadata = require(path.join(targetDir, "metadata.json"));
			return metadata;
		});
		return this._metadataCache;
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
				await pacote.extract(`${pkgName}@${version}`, targetDir, this._getPacoteOptions());
				this._installedCounter++;
			} else {
				throw err;
			}
		}
	}

	_getTargetDirForPackage({pkgName, version}) {
		return path.join(this._baseDir, ...pkgName.split("/"), version);
	}


	/* Static methods */

	static mergeTrees(projectTree, frameworkTree) {
		const frameworkLibs = FrameworkInstaller._getAllNodesOfTree(frameworkTree.dependencies);

		log.verbose(`Merging framework tree into project tree "${projectTree.metadata.name}"`);

		const queue = [projectTree];
		while (queue.length) {
			const project = queue.shift();

			project.dependencies = project.dependencies.filter((depProject) => {
				if (FrameworkInstaller._isUi5FrameworkProject(depProject)) {
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
	}

	static _getAllNodesOfTree(tree) {
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
	}

	static _isUi5FrameworkProject(project) {
		if (project.id.startsWith("@openui5/") || project.id.startsWith("@sapui5/")) {
			return true;
		}
		return false;
	}


	static _collectReferencedUi5Libraries(project, ui5Dependencies = [], root = false) {
		if (FrameworkInstaller._isUi5FrameworkProject(project)) {
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
			FrameworkInstaller._collectReferencedUi5Libraries(depProject, ui5Dependencies);
		});
		return ui5Dependencies;
	}
}

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
	generateDependencyTree: async function(tree, {distVersionOverride} = {}) {
		// Don't create a tree when root project doesn't have a framework configuration
		if (!tree.framework) {
			return null;
		}

		const frameworkName = tree.framework.name;
		if (frameworkName !== "SAPUI5" && frameworkName !== "OpenUI5") {
			throw new Error(`Unknown framework.name "${frameworkName}". Must be "OpenUI5" or "SAPUI5"`);
		}

		let version;
		if (distVersionOverride) {
			version = distVersionOverride;
			log.info(
				`Overriding configured ${frameworkName} version ${tree.framework.version} with ${version}`);
		} else {
			version = tree.framework.version;
		}
		log.info(`Using ${frameworkName} version: ${version}`);

		const referencedLibraries = FrameworkInstaller._collectReferencedUi5Libraries(tree, [], true);

		const installer = new FrameworkInstaller({
			dirPath: tree.path,
			name: frameworkName,
			version
		});

		await installer.install({
			libraryNames: referencedLibraries
		});

		const libraries = await installer.generateDependencyTree({
			libraryNames: referencedLibraries
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
	FrameworkInstaller
};
