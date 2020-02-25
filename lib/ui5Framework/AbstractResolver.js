const log = require("@ui5/logger").getLogger("normalizer:ui5Framework:Resolver");

class AbstractResolver {
	constructor({cwd, version}) {
		if (!cwd) {
			// TODO: default to process.cwd()?
			throw new Error(`Resolver: Missing parameter "cwd"`);
		}
		if (!version) {
			throw new Error(`Resolver: Missing parameter "version"`);
		}

		this._cwd = cwd;
		this._version = version;

		// Initialize libraries information
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
	async handleLibrary(libraryName) {
		throw new Error("Not implemented!");
	}
}

module.exports = AbstractResolver;
