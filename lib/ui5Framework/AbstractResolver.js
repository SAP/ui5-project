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

	async _processLibrary(libraryName, libraryMetadata) {
		// Check if library is already processed
		if (libraryMetadata[libraryName]) {
			return;
		}
		// Mark library as handled
		libraryMetadata[libraryName] = {};

		const {metadata, install} = await this.handleLibrary(libraryName);

		// Handle dependencies
		if (metadata.dependencies.length > 0) {
			await Promise.all(metadata.dependencies.map(async (libraryName) => {
				await this._processLibrary(libraryName, libraryMetadata);
			}));
		}

		// Wait until library is installed
		const {pkgPath} = await install;
		metadata.path = pkgPath;

		// Add metadata entry
		libraryMetadata[libraryName] = metadata;
	}

	async install(libraryNames) {
		const libraryMetadata = {};

		const errors = (await Promise.all(libraryNames.map(async (libraryName) => {
			try {
				await this._processLibrary(libraryName, libraryMetadata);
			} catch (err) {
				return err;
			}
		}))).filter((e) => e);

		if (errors.length > 0) {
			throw new Error("Failed to install libraries:\n" + errors.join("\n"));
		}

		return {
			libraryMetadata
		};
	}

	// To be implemented by resolver
	async handleLibrary(libraryName) {
		throw new Error("AbstractResolver: handleLibrary must be implemented!");
	}
}

module.exports = AbstractResolver;
