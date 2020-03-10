const path = require("path");
const log = require("@ui5/logger").getLogger("ui5Framework:AbstractResolver");

/**
 * Abstract Resolver
 *
 * @public
 * @abstract
 * @memberof module:@ui5/project.ui5Framework
 */
class AbstractResolver {
	/**
	 * @param {*} options options
	 * @param {string} options.version version
	 * @param {string} [options.cwd=process.cwd()] cwd
	 * @param {string} [options.ui5HomeDir="~/.ui5"] UI5 home dir. Relative to `process.cwd()`
	 */
	constructor({cwd, version, ui5HomeDir}) {
		if (new.target === AbstractResolver) {
			throw new TypeError("Class 'AbstractResolver' is abstract");
		}

		if (!version) {
			throw new Error(`AbstractResolver: Missing parameter "version"`);
		}

		this._ui5HomeDir = ui5HomeDir || path.join(require("os").homedir(), ".ui5");

		this._cwd = cwd || process.cwd();
		this._version = version;
	}

	async _processLibrary(libraryName, libraryMetadata, errors) {
		// Check if library is already processed
		if (libraryMetadata[libraryName]) {
			return;
		}
		// Mark library as handled
		libraryMetadata[libraryName] = {};

		log.verbose("Processing " + libraryName);

		const promises = await this.handleLibrary(libraryName);

		const [metadata, {pkgPath}] = await Promise.all([
			promises.metadata.then((metadata) =>
				this._processDependencies(libraryName, metadata, libraryMetadata, errors)),
			promises.install
		]);

		// Add path to installed package to metadata
		metadata.path = pkgPath;

		// Add metadata entry
		libraryMetadata[libraryName] = metadata;
	}

	async _processDependencies(libraryName, metadata, libraryMetadata, errors) {
		if (metadata.dependencies.length > 0) {
			log.verbose("Processing dependencies of " + libraryName);
			await this._processLibraries(metadata.dependencies, libraryMetadata, errors);
			log.verbose("Done processing dependencies of " + libraryName);
		}
		return metadata;
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

	/**
	 * Library metadata entry
	 *
	 * @example
	 * {
	 *   "id": "@openui5/sap.ui.core",
	 *   "version": "1.75.0",
	 *   "path": "~/.ui5/framework/packages/@openui5/sap.ui.core/1.75.0",
	 *   "dependencies": [],
	 *   "optionalDependencies": []
	 * }
	 *
	 * @public
	 * @typedef {Object} LibraryMetadataEntry
	 * @property {string} id Identifier
	 * @property {string} version Version
	 * @property {string} path Path
	 * @property {string[]} dependencies List of dependency ids
	 * @property {string[]} optionalDependencies List of optional dependency ids
	 * @memberof module:@ui5/project.ui5Framework
	 */
	/**
	 * Install result
	 *
	 * @example
	 * {
	 *   "libraryMetadata": {
	 *     "sap.ui.core": {
	 *       // ...
	 *     },
	 *     "sap.m": {
	 *       // ...
	 *     }
	 *   }
	 * }
	 *
	 * @public
	 * @typedef {Object} ResolverInstallResult
	 * @property {Object.<string, module:@ui5/project.ui5Framework.LibraryMetadataEntry>} libraryMetadata
	 *   Object containing all installed libraries with library name as key
	 * @memberof module:@ui5/project.ui5Framework
	 */
	/**
	 * Installs the provided libraries and their dependencies
	 *
	 * @example
	 * resolver.install(["sap.ui.core", "sap.m"]).then(({libraryMetadata}) => {
	 *   // Installation done
	 * }).catch((err) => {
	 *   // Handle installation errors
	 * });
	 *
	 * @public
	 * @param {string[]} libraryNames List of library names to be installed
	 * @returns {module:@ui5/project.ui5Framework.ResolverInstallResult}
	 *   Resolves with an object containing the <code>libraryMetadata</code>
	 */
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
