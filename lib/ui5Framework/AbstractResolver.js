const path = require("path");
const log = require("@ui5/logger").getLogger("ui5Framework:AbstractResolver");

class AbstractResolver {
	constructor({cwd, version, ui5HomeDir}) {
		if (!version) {
			throw new Error(`AbstractResolver: Missing parameter "version"`);
		}

		this._ui5HomeDir = ui5HomeDir || path.join(require("os").homedir(), ".ui5");

		this._cwd = cwd || process.cwd();
		this._version = version;

		// Initialize libraries information
		this.libraries = {};

		this._installedCounter = 0;
		this._cachedCounter = 0;
	}

	async _processLibrary(libraryName, libraryMetadata, errors) {
		// Check if library is already processed
		if (libraryMetadata[libraryName]) {
			return;
		}
		// Mark library as handled
		libraryMetadata[libraryName] = {};

		log.verbose("Processing " + libraryName);

		let {metadata, install} = await this.handleLibrary(libraryName);

		// Ensure proper error handling
		install = install.catch((error) => {
			log.error("Failed to install " + libraryName);
			return {error};
		});

		// Handle dependencies
		if (metadata.dependencies.length > 0) {
			log.verbose("Processing dependencies of " + libraryName);
			await this._processLibraries(metadata.dependencies, libraryMetadata, errors);
			log.verbose("Done processing dependencies of " + libraryName);
		}

		// Wait until library is installed
		log.verbose("Waiting for installation of " + libraryName);
		const {pkgPath, error} = await install;
		log.verbose("Done waiting for installation of " + libraryName);
		if (error) {
			throw error;
		} else {
			metadata.path = pkgPath;

			// Add metadata entry
			libraryMetadata[libraryName] = metadata;
		}
	}

	async _processLibraries(libraryNames, libraryMetadata, errors) {
		const results = await Promise.all(libraryNames.map(async (libraryName) => {
			try {
				await this._processLibrary(libraryName, libraryMetadata, errors);
			} catch (err) {
				return `Failed to resolve library ${libraryName}: ${err.message}`;
			}
		}));
		// Don't add empty results (success)
		errors.push(...results.filter(($) => $));
	}

	async install(libraryNames) {
		const libraryMetadata = {};
		const errors = [];

		await this._processLibraries(libraryNames, libraryMetadata, errors);

		if (errors.length > 0) {
			throw new Error("Resolution of framework libraries failed with errors:\n" + errors.join("\n"));
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
