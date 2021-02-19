const fsPath = require("path");
const resourceFactory = require("@ui5/fs").resourceFactory;
const Project = require("../Project");

class ThemeLibrary extends Project {
	constructor(parameters) {
		super(parameters);

		this._srcPath = "src";
		this._testPath = "test";
	}

	/* === Attributes === */
	/**
	* @public
	*/

	/* === Resource Access === */
	/**
	* @public
	*/
	getSourceReader() {
		return resourceFactory.createReader({
			fsBasePath: fsPath.join(this.getPath(), this._srcPath),
			virBasePath: "/resources/",
			name: `Source reader for theme-library project ${this.getName()}`
		});
	}

	/**
	* @public
	*/
	getRuntimeReader() {
		let reader = this.getSourceReader();
		if (this._testPathExists) {
			const testReader = resourceFactory.createReader({
				fsBasePath: fsPath.join(this.getPath(), this._testPath),
				virBasePath: "/test-resources/",
				name: `Test reader for theme-library project ${this.getName()}`
			});
			reader = resourceFactory.createReaderCollection({
				name: `Reader collection for theme-library project ${this.getName()}`,
				readers: [reader, testReader]
			});
		}
		return reader;
	}

	/**
	* @public
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

		if (config.resources && config.resources.configuration && config.resources.configuration.paths) {
			if (config.resources.configuration.paths.src) {
				this._srcPath = config.resources.configuration.paths.src;
			}
			if (config.resources.configuration.paths.test) {
				this._testPath = config.resources.configuration.paths.test;
			}
		}

		this._log.verbose(`Path mapping for theme-library project ${this.getName()}:`);
		this._log.verbose(`  Physical root path: ${this.getPath()}`);
		this._log.verbose(`  Mapped to:`);
		this._log.verbose(`    /resources/ => ${this._srcPath}`);
		this._log.verbose(`    /test-resources/ => ${this._testPath}`);

		if (!await this._dirExists("/" + this._srcPath)) {
			throw new Error(
				`Unable to find directory '${this._srcPath}' in theme-library project ${this.getName()}`);
		}
		if (!await this._dirExists("/" + this._testPath)) {
			this._log.verbose(`    (/test-resources/ target does not exist)`);
		} else {
			this._testPathExists = true;
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

module.exports = ThemeLibrary;
