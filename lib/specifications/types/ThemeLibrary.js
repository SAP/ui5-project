import Project from "../Project.js";
import fsPath from "node:path";
import * as resourceFactory from "@ui5/fs/resourceFactory";

/**
 * ThemeLibrary
 *
 * @public
 * @class
 * @alias @ui5/project/specifications/types/ThemeLibrary
 * @extends @ui5/project/specifications/Project
 * @hideconstructor
 */
class ThemeLibrary extends Project {
	constructor(parameters) {
		super(parameters);

		this._srcPath = "src";
		this._testPath = "test";
		this._testPathExists = false;
		this._writer = null;
	}

	/* === Attributes === */
	/**
	* @private
	*/
	getCopyright() {
		return this._config.metadata.copyright;
	}

	/**
	 * Get the path of the project's source directory
	 *
	 * @public
	 * @returns {string} Absolute path to the source directory of the project
	 */
	getSourcePath() {
		return fsPath.join(this.getRootPath(), this._srcPath);
	}

	getSourcePaths() {
		return [this.getSourcePath()];
	}

	getVirtualPath(sourceFilePath) {
		const sourcePath = this.getSourcePath();
		if (sourceFilePath.startsWith(sourcePath)) {
			const relSourceFilePath = fsPath.relative(sourcePath, sourceFilePath);
			let virBasePath = "/resources/";
			if (!this._isSourceNamespaced) {
				virBasePath += `${this._namespace}/`;
			}
			return `${virBasePath}${relSourceFilePath}`;
		}

		throw new Error(
			`Unable to convert source path ${sourceFilePath} to virtual path for project ${this.getName()}`);
	}

	/* === Resource Access === */

	_getStyledReader(style) {
		// Apply builder excludes to all styles but "runtime"
		const excludes = style === "runtime" ? [] : this.getBuilderResourcesExcludes();

		return this._getReader(excludes);
	}

	// /**
	// * Get a [DuplexCollection]{@link @ui5/fs/DuplexCollection} for accessing and modifying a
	// * project's resources.
	// *
	// * This is always of style <code>buildtime</code>, which for theme libraries is identical to style
	// * <code>runtime</code>.
	// *
	// * @public
	// * @returns {@ui5/fs/DuplexCollection} DuplexCollection
	// */
	// getWorkspace() {
	// 	const excludes = this.getBuilderResourcesExcludes();
	// 	const reader = this._getReader(excludes);

	// 	const writer = this._createWriter();
	// 	return resourceFactory.createWorkspace({
	// 		reader,
	// 		writer
	// 	});
	// }

	_getReader(excludes) {
		let reader = resourceFactory.createReader({
			fsBasePath: this.getSourcePath(),
			virBasePath: "/resources/",
			name: `Runtime resources reader for theme-library project ${this.getName()}`,
			project: this,
			excludes
		});
		if (this._testPathExists) {
			const testReader = resourceFactory.createReader({
				fsBasePath: fsPath.join(this.getRootPath(), this._testPath),
				virBasePath: "/test-resources/",
				name: `Runtime test-resources reader for theme-library project ${this.getName()}`,
				project: this,
				excludes
			});
			reader = resourceFactory.createReaderCollection({
				name: `Reader collection for theme-library project ${this.getName()}`,
				readers: [reader, testReader]
			});
		}
		return reader;
	}

	_createWriter() {
		if (!this._writer) {
			this._writer = resourceFactory.createAdapter({
				virBasePath: "/",
				project: this
			});
		}

		return this._writer;
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

		if (!(await this._dirExists("/" + this._srcPath))) {
			throw new Error(
				`Unable to find source directory '${this._srcPath}' in theme-library project ${this.getName()}`);
		}
		this._testPathExists = await this._dirExists("/" + this._testPath);

		this._log.verbose(`Path mapping for theme-library project ${this.getName()}:`);
		this._log.verbose(`  Physical root path: ${this.getRootPath()}`);
		this._log.verbose(`  Mapped to:`);
		this._log.verbose(`    /resources/ => ${this._srcPath}`);
		this._log.verbose(
			`    /test-resources/ => ${this._testPath}${this._testPathExists ? "" : " [does not exist]"}`);
	}
}

export default ThemeLibrary;
