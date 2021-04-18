const fsPath = require("path");
const resourceFactory = require("@ui5/fs").resourceFactory;
const Project = require("../Project");

class Module extends Project {
	constructor(parameters) {
		super(parameters);

		this._paths = null;
	}

	/* === Attributes === */
	/**
	* @public
	*/

	/* === Resource Access === */
	/**
	* Get a resource reader for the sources of the project (excluding any test resources)
	*
	* @public
	* @returns {module:@ui5/fs.ReaderCollection} Reader collection
	*/
	getSourceReader() {
		// TODO
		throw new Error("Not sure what is expected here");
	}

	/**
	* Get a resource reader for accessing the project resources the same way the UI5 runtime would do
	*
	* @public
	* @returns {module:@ui5/fs.ReaderCollection} Reader collection
	*/
	getRuntimeReader() {
		const readers = this._paths.map((readerArgs) => resourceFactory.createReader(readerArgs));
		if (readers.length === 1) {
			return readers[0];
		}
		return resourceFactory.createReaderCollection({
			name: `Reader collection for module project ${this.getName()}`,
			readers
		});
	}

	/**
	* Get a resource reader for accessing the project resources during the build process
	*
	* @public
	* @returns {module:@ui5/fs.ReaderCollection} Reader collection
	*/
	getBuildtimeReader() {
		// Same as runtime
		return this.getRuntimeReader();
	}

	/* === Internals === */
	/**
	 * @private
	 * @param {object} config Configuration object
	*/
	async _configureAndValidatePaths(config) {
		await super._configureAndValidatePaths(config);


		this._log.verbose(`Path mapping for library project ${this.getName()}:`);
		this._log.verbose(`  Physical root path: ${this.getPath()}`);
		this._log.verbose(`  Mapped to:`);
		this._log.verbose(`    /resources/ => ${this._srcPath}`);

		if (config.resources && config.resources.configuration && config.resources.configuration.paths) {
			this._paths = await Promise.all(Object.entries(config.resources.configuration.paths)
				.map(async ([virBasePath, relFsPath]) => {
					this._log.verbose(`    ${virBasePath} => ${relFsPath}`);
					if (!await this._dirExists("/" + relFsPath)) {
						throw new Error(
							`Unable to find directory '${relFsPath}' in module project ${this.getName()}`);
					}
					return {
						name: `'${relFsPath}'' reader for moduleproject  ${this.getName()}`,
						virBasePath,
						fsBasePath: fsPath.join(this.getPath(), relFsPath)
					};
				}));
		} else {
			if (!await this._dirExists("/")) {
				throw new Error(
					`Unable to find root directory of module project ${this.getName()}`);
			}
			this._log.verbose(`    / => <project root>`);
			this._paths = [{
				name: `Root reader for module project ${this.getName()}`,
				virBasePath: "/",
				fsBasePath: this.getPath()
			}];
		}
	}

	/**
	 * @private
	 * @param {object} config Configuration object
	*/
	async _parseConfiguration(config) {
		await super._parseConfiguration(config);
	}
}

module.exports = Module;
