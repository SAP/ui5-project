const log = require("@ui5/logger").getLogger("normalizer:ui5Framework:AbstractResolver");

class AbstractResolver {
	constructor({cwd, version}) {
		if (!cwd) {
			// TODO: default to process.cwd()?
			throw new Error(`AbstractResolver: Missing parameter "cwd"`);
		}
		if (!version) {
			throw new Error(`AbstractResolver: Missing parameter "version"`);
		}

		this._cwd = cwd;
		this._version = version;

		// Initialize libraries information
		this.libraries = {};

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
		const {pkgPath} = await install;
		this.metadata.libraries[libraryName].path = pkgPath;
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

		const libraryMetadata = {};
		Object.keys(this.metadata.libraries)
			.filter((libraryName) => {
				return this.libraries[libraryName];
			}).forEach((libraryName) => {
				const library = this.metadata.libraries[libraryName];
				libraryMetadata[libraryName] = { // TODO: Move mapping to child classes to remove this.metadata attribute
					id: library.npmPackageName,
					version: library.version,
					path: library.path,
					dependencies: library.dependencies,
					optionalDependencies: library.optionalDependencies
				};
			});

		return {
			libraryMetadata
		};
	}

	// To be implemented by resolver
	async handleLibrary(libraryName) {
		throw new Error("Not implemented!");
	}
}

module.exports = AbstractResolver;
