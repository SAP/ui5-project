import Project, {type ProjectConfiguration, type ProjectReaderOptions} from "../Project.js";
import fsPath from "node:path";
import * as resourceFactory from "@ui5/fs/resourceFactory";
import type AbstractReaderWriter from "@ui5/fs/AbstractReaderWriter";
import {type BuildManifest} from "../../build/helpers/createBuildManifest.js";

/**
 * ThemeLibrary
 *
 * @hideconstructor
 */
class ThemeLibrary extends Project {
	_srcPath = "src";
	_testPath = "test";
	_testPathExists = false;
	_writer: AbstractReaderWriter | null = null;

	/* === Attributes === */
	/**
	 */
	public getCopyright() {
		return this._config.metadata.copyright;
	}

	/**
	 * Get the path of the project's source directory
	 *
	 * @returns Absolute path to the source directory of the project
	 */
	public getSourcePath() {
		return fsPath.join(this.getRootPath(), this._srcPath);
	}

	/* === Resource Access === */
	/**
	 * Get a [ReaderCollection]{@link @ui5/fs/ReaderCollection} for accessing all resources of the
	 * project in the specified "style":
	 *
	 * <ul>
	 * <li><b>buildtime:</b> Resource paths are always prefixed with <code>/resources/</code>
	 *  or <code>/test-resources/</code> followed by the project's namespace.
	 *  Any configured build-excludes are applied</li>
	 * <li><b>dist:</b> Resource paths always match with what the UI5 runtime expects.
	 *  This means that paths generally depend on the project type. Applications for example use a "flat"-like
	 *  structure, while libraries use a "buildtime"-like structure.
	 *  Any configured build-excludes are applied</li>
	 * <li><b>runtime:</b> Resource paths always match with what the UI5 runtime expects.
	 *  This means that paths generally depend on the project type. Applications for example use a "flat"-like
	 *  structure, while libraries use a "buildtime"-like structure.
	 *  This style is typically used for serving resources directly. Therefore, build-excludes are not applied
	 * <li><b>flat:</b> Resource paths are never prefixed and namespaces are omitted if possible. Note that
	 *  project types like "theme-library", which can have multiple namespaces, can't omit them.
	 *  Any configured build-excludes are applied</li>
	 * </ul>
	 *
	 * If project resources have been changed through the means of a workspace, those changes
	 * are reflected in the provided reader too.
	 *
	 * Resource readers always use POSIX-style paths.
	 *
	 * @param [options] Reader options
	 * @param [options.style] Path style to access resources.
	 *   Can be "buildtime", "dist", "runtime" or "flat"
	 * @returns A reader collection instance
	 */
	public getReader({style = "buildtime"}: ProjectReaderOptions = {}) {
		// Apply builder excludes to all styles but "runtime"
		const excludes = style === "runtime" ? [] : this.getBuilderResourcesExcludes();

		let reader = resourceFactory.createReader({
			fsBasePath: this.getSourcePath(),
			virBasePath: "/resources/",
			name: `Runtime resources reader for theme-library project ${this.getName()}`,
			project: this,
			excludes,
		});
		if (this._testPathExists) {
			const testReader = resourceFactory.createReader({
				fsBasePath: fsPath.join(this.getRootPath(), this._testPath),
				virBasePath: "/test-resources/",
				name: `Runtime test-resources reader for theme-library project ${this.getName()}`,
				project: this,
				excludes,
			});
			reader = resourceFactory.createReaderCollection({
				name: `Reader collection for theme-library project ${this.getName()}`,
				readers: [reader, testReader],
			});
		}
		const writer = this._getWriter();

		return resourceFactory.createReaderCollectionPrioritized({
			name: `Reader/Writer collection for project ${this.getName()}`,
			readers: [writer, reader],
		});
	}

	/**
	 * Get a [DuplexCollection]{@link @ui5/fs/DuplexCollection} for accessing and modifying a
	 * project's resources.
	 *
	 * This is always of style <code>buildtime</code>, wich for theme libraries is identical to style
	 * <code>runtime</code>.
	 *
	 * @returns DuplexCollection
	 */
	public getWorkspace() {
		const reader = this.getReader();

		const writer = this._getWriter();
		return resourceFactory.createWorkspace({
			reader,
			writer,
		});
	}

	_getWriter() {
		if (!this._writer) {
			this._writer = resourceFactory.createAdapter({
				virBasePath: "/",
				project: this,
			});
		}

		return this._writer;
	}

	protected async _configureAndValidatePaths(config: ProjectConfiguration) {
		if (config.resources?.configuration?.paths) {
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

	protected async _parseConfiguration(_config: ProjectConfiguration, _buildManifest?: BuildManifest) {
		// Nothing to do
	}
}

export default ThemeLibrary;
