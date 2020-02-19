const pacote = require("pacote");
const fs = require("graceful-fs");
const {promisify} = require("util");
const stat = promisify(fs.stat);
const path = require("path");
const log = require("@ui5/logger").getLogger("normalizer:translators:ui5Framework");

const DIST_PKG_NAME = "@sapui5/distribution-metadata";

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
		this._cwd = dirPath;

		const homedir = require("os").homedir();
		this._baseDir = path.join(homedir, ".ui5", "framework", "packages");
		this._cacheDir = path.join(homedir, ".ui5", "framework", "cacache");
		log.verbose(`Installing to: ${this._baseDir}`);

		this._name = name;

		this._distMetadataCache = null;
		this._projectCache = {};

		this._installedCounter = 0;
		this._cachedCounter = 0;

		this._distVersion = version;

		// Trigger dist metadata retrieval as early as possible
		// (this is optional and performance impact has not been evaluated yet)
		// this._getDistMetadata();
	}

	_requestPackageManifest(pkgName, version) {
		return pacote.manifest(`${pkgName}@${version}`, this._getPacoteOptions());
	}

	async _installAllOpenUI5Dependencies(libraryNames) {
		const processLibrary = async (pkgName) => {
			// Check if library is already handled
			if (libraries[pkgName]) {
				return;
			}

			const libName = pkgName.substr("@openui5/".length); // TODO: find better way from pkgName => libName?

			// TODO: only use metadata map to mark lib as handled?
			libraries[pkgName] = {
				libraryName: libName,
				version: this._distVersion
			};

			// Trigger manifest request to gather transitive dependencies
			const pManifest = this._requestPackageManifest(pkgName, this._distVersion);

			// Also trigger installation of package
			const pInstall = this._installPackage({
				pkgName,
				version: this._distVersion
			});

			const manifest = await pManifest;
			let dependencyNames = [];
			let pDependencies;
			if (manifest.dependencies) {
				dependencyNames = Object.keys(manifest.dependencies);
				// Trigger handling of dependencies
				pDependencies = Promise.all(dependencyNames.map(processLibrary));
			}
			let optionalDependencies = [];
			// npm devDependencies are handled as "optionalDependencies" in terms of the UI5 framework metadata structure
			if (manifest.devDependencies) {
				optionalDependencies = Object.keys(manifest.devDependencies).map((pkgName) => pkgName.substr("@openui5/".length));
			}

			// Add metadata entry
			metadata.libraries[libName] = {
				npmPackageName: pkgName,
				version: this._distVersion,
				dependencies: dependencyNames.map((pkgName) => pkgName.substr("@openui5/".length)),
				optionalDependencies
			};

			// Wait for dependencies to be installed
			if (pDependencies) {
				await pDependencies;
			}

			// Wait until library is installed before resolving
			await pInstall;
		};
		const metadata = {libraries: {}};
		const libraries = {};

		// try {
			await Promise.all(libraryNames.map((libName) => "@openui5/" + libName).map(processLibrary));
		// } catch (err) {
			// throw new Error("Error while installing libraries", err);
		// }

		const requestedLibraries = [];
		for (const pkgName in libraries) {
			if (libraries.hasOwnProperty(pkgName)) {
				requestedLibraries.push(libraries[pkgName].libraryName);
			}
		}

		const tree = libraryNames.map((libName) => {
			return this._getProject({
				libName,
				metadata,
				requestedLibraries
			});
		});
		this.___test_tree = tree;
		return tree;
	}

	async install({libraryNames}) {
		let startTime;
		if (log.isLevelEnabled("verbose")) {
			startTime = process.hrtime();
		}

		if (this._name === "OpenUI5") {
			await this._installAllOpenUI5Dependencies(libraryNames);
		} else if (this._name === "SAPUI5") {
			const pDistMetadata = this._getDistMetadata();

			const metadata = await pDistMetadata;
			const packagesToInstall = this._collectTransitiveDependencies({
				libraryNames,
				metadata
			});

			await this._installPackages({
				packages: packagesToInstall
			});
		}

		if (log.isLevelEnabled("verbose")) {
			const prettyHrtime = require("pretty-hrtime");
			const timeDiff = process.hrtime(startTime);
			log.verbose(`Installed ${this._installedCounter} packages and used ${this._cachedCounter} ` +
				`packages from cache in ${prettyHrtime(timeDiff)}`);
		}
	}

	async generateDependencyTree({libraryNames}) {
		if (this._name === "OpenUI5") {
			return this.___test_tree;
			// TODO: should not install but just resolve tree => create 2 separate functions
			// return this._installAllOpenUI5Dependencies(libraryNames);
		} else if (this._name === "SAPUI5") {
			const metadata = await this._getDistMetadata();

			const transitiveDependencies = this._collectTransitiveDependencies({
				libraryNames,
				metadata
			});

			const requestedLibraries = [];
			for (const pkgName in transitiveDependencies) {
				if (transitiveDependencies.hasOwnProperty(pkgName)) {
					requestedLibraries.push(transitiveDependencies[pkgName].libraryName);
				}
			}

			const tree = libraryNames.map((libName) => {
				return this._getProject({
					libName,
					metadata,
					requestedLibraries
				});
			});
			return tree;
		}
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

	_collectTransitiveDependencies({libraryNames, metadata}) {
		const depsToProcess = [...libraryNames];

		const transitiveDependencies = {};
		while (depsToProcess.length) {
			// TODO: Look into array length for potential optimization
			const libName = depsToProcess.shift();
			if (!metadata.libraries[libName]) {
				throw new Error(`Failed to find library ${libName} in dist packages metadata.json`);
			}
			const depMetadata = metadata.libraries[libName];
			if (!transitiveDependencies[depMetadata.npmPackageName]) {
				transitiveDependencies[depMetadata.npmPackageName] = {
					libraryName: libName,
					version: depMetadata.version
				};
				depsToProcess.push(...depMetadata.dependencies);
			}
		}
		return transitiveDependencies;
	}

	async _getDistMetadata() {
		if (this._distMetadataCache) {
			return this._distMetadataCache;
		}
		this._distMetadataCache = Promise.resolve().then(async () => {
			const version = this._distVersion;
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
		return this._distMetadataCache;
	}

	async _installPackages({packages}) {
		await Promise.all(Object.keys(packages).map(async (pkgName) => {
			const version = packages[pkgName].version;
			const targetDir = this._getTargetDirForPackage({pkgName, version});

			await this._installPackage({
				pkgName: pkgName,
				version,
				targetDir
			});
		}));

		/* // Alternative, only storing tar files:
		await Promise.all(packages.map((pkgName) => {
			log.info(`Installing ${pkgName} version ${distVersion}...`);
			const fileName = pkgName + ".tgz";
			return pacote.tarball.toFile(`${pkgName}@${distVersion}`,
				path.join(targetDir, ...fileName.split("/")));
		}));
		*/
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
