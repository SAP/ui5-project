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

	async _processLibrary(libraryName, metadata) {
		// Check if library is already processed
		if (metadata[libraryName]) {
			return;
		}
		// Mark library as handled
		metadata[libraryName] = {};

		const {libraryMetadata, install} = await this.handleLibrary(libraryName);

		// Handle dependencies
		if (libraryMetadata.dependencies.length > 0) {
			await Promise.all(libraryMetadata.dependencies.map((libraryName) => {
				return this._processLibrary(libraryName, metadata);
			}));
		}

		// Wait until library is installed
		const {pkgPath} = await install;
		libraryMetadata.path = pkgPath;

		// Add metadata entry
		metadata[libraryName] = libraryMetadata;
	}

	async install(libraryNames) {
		const metadata = {};

		await Promise.all(libraryNames.map((libraryName) => {
			return this._processLibrary(libraryName, metadata);
		}));

		return {
			libraryMetadata: metadata,
			installedCounter: this._installedCounter,
			cachedCounter: this._cachedCounter
		};
	}

	// To be implemented by resolver
	async handleLibrary(libraryName) {
		throw new Error("AbstractResolver: handleLibrary must be implemented!");
	}
}

module.exports = AbstractResolver;
