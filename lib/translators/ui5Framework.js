const pacote = require("pacote");
const fs = require("graceful-fs");
const {promisify} = require("util");
const stat = promisify(fs.stat);
const path = require("path");
const log = require("@ui5/logger").getLogger("normalizer:translators:ui5Framework");

const DIST_PKG_NAME = "@sap/ui5";

class FrameworkInstaller {
	constructor({registry, dirPath}) {
		if (!dirPath) {
			throw new Error(`installer: missing parameter "dirPath"`);
		}
		this._baseDir = path.join(dirPath, "ui5_dependencies");
		log.verbose(`Installing to: ${this._baseDir}`);

		this._pacoteOptions = {
			registry: registry || "http://localhost:4873",
			cache: path.join(require("os").homedir(), ".ui5", "resources", "ui5_dependencies_cache")
		};

		this._distMetadataCache = {};
		this._projectCache = {};

		this._installedCounter = 0;
		this._cachedCounter = 0;
	}

	async generateDependencyTree({libraryNames, distVersion}) {
		const metadata = await this._getDistMetadata({
			baseDir: this._baseDir,
			version: distVersion
		});

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
			id: depMetadata.packageName,
			version: depMetadata.version,
			path: this._getTargetDirForPackage({
				pkgName: depMetadata.packageName,
				version: depMetadata.version
			}),
			dependencies
		};
		return this._projectCache[libName];
	}

	async install({libraryNames, distVersion}) {
		let startTime;
		if (log.isLevelEnabled("verbose")) {
			startTime = process.hrtime();
		}

		const pDistMetadata = this._getDistMetadata({version: distVersion});

		const metadata = await pDistMetadata;
		const packagesToInstall = this._collectTransitiveDependencies({
			libraryNames,
			metadata
		});

		await this._installPackages({
			packages: packagesToInstall
		});

		if (log.isLevelEnabled("verbose")) {
			const prettyHrtime = require("pretty-hrtime");
			const timeDiff = process.hrtime(startTime);
			log.verbose(`Installed ${this._installedCounter} packages and used ${this._cachedCounter} ` +
				`packages from cache in ${prettyHrtime(timeDiff)}`);
		}
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
			if (!transitiveDependencies[depMetadata.packageName]) {
				transitiveDependencies[depMetadata.packageName] = {
					libraryName: libName,
					version: depMetadata.version
				};
				depsToProcess.push(...depMetadata.dependencies);
			}
		}
		return transitiveDependencies;
	}

	async _getDistMetadata({version}) {
		if (this._distMetadataCache[version]) {
			return this._distMetadataCache[version];
		}
		this._distMetadataCache[version] = Promise.resolve().then(async () => {
			log.info(`Requesting dist package in version ${version}...`);
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
		return this._distMetadataCache[version];
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
	async _installPackage({pkgName, version, targetDir}) {
		try {
			await stat(targetDir);
			log.info(`Alrady installed: ${pkgName} in version ${version}`);
			this._cachedCounter++;
		} catch (err) {
			if (err.code === "ENOENT") { // "File or directory does not exist"
				log.info(`Installing ${pkgName} in version ${version}...`);
				await pacote.extract(`${pkgName}@${version}`, targetDir, this._pacoteOptions);
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

			if (project.resources && project.resources.framework && project.resources.framework.libraries) {
				const frameworkDeps = project.resources.framework.libraries.map((dependency) => {
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
		if (project.id.startsWith("@openui5/") || project.id.startsWith("@sap/ui5-")) {
			return true;
		}
		return false;
	}


	static collectReferencedUi5Libraries(project, ui5Dependencies = []) {
		if (FrameworkInstaller._isUi5FrameworkProject(project)) {
			// Ignoring UI5 Framework libraries in dependencies
			return ui5Dependencies;
		}
		if (project.resources && project.resources.framework && project.resources.framework.libraries) {
			project.resources.framework.libraries.forEach((dependency) => {
				if (!ui5Dependencies.includes(dependency.name) && !dependency.optional) {
					ui5Dependencies.push(dependency.name);
				}
			});
		} else {
			log.verbose(`Project ${project.metadata.name} defines no resoures.framework.libraries configuration`);
			// TODO fallback
		}
		project.dependencies.map((depProject) => {
			FrameworkInstaller.collectReferencedUi5Libraries(depProject, ui5Dependencies);
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
	 * @returns {Promise<Object>} Promise
	 */
	generateDependencyTree: async function(tree, {registry, distVersionOverride}) {
		let distVersion;
		if (distVersionOverride) {
			distVersion = distVersionOverride;
			log.info(
				`Overriding configured SAPUI5 version ${tree.resources.framework.version} with ${distVersionOverride}`);
		} else {
			distVersion = tree.resources.framework.version;
		}
		log.info(`Using SAPUI5 version: ${distVersion}`);

		const referencedLibraries = FrameworkInstaller.collectReferencedUi5Libraries(tree);

		const installer = new FrameworkInstaller({
			registry,
			dirPath: tree.path
		});

		const pInstall = installer.install({
			libraryNames: referencedLibraries,
			distVersion
		});

		const pDependencyTree = installer.generateDependencyTree({
			libraryNames: referencedLibraries,
			distVersion
		});

		const [libraries] = await Promise.all([pDependencyTree, pInstall]);

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

