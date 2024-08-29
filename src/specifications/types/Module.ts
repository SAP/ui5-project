import fsPath from "node:path";
import Project, {type ProjectConfiguration, type ProjectReaderOptions} from "../Project.js";
import * as resourceFactory from "@ui5/fs/resourceFactory";
import type AbstractReaderWriter from "@ui5/fs/AbstractReaderWriter";
import {type BuildManifest} from "../../build/helpers/createBuildManifest.js";

/**
 * Module
 *
 * @hideconstructor
 */
class Module extends Project {
	_paths!: {
		name: string;
		virBasePath: string;
		fsBasePath: string;
	}[];

	_writer: AbstractReaderWriter | null = null;

	/* === Attributes === */

	/**
	 * Since Modules have multiple source paths, this function always throws with an exception
	 *
	 * @throws {Error} Projects of type module have more than one source path
	 */
	public getSourcePath() {
		throw new Error(`Projects of type module have more than one source path`);
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

		const readers = this._paths.map(({name, virBasePath, fsBasePath}) => {
			return resourceFactory.createReader({
				name,
				virBasePath,
				fsBasePath,
				project: this,
				excludes,
			});
		});
		if (readers.length === 1) {
			return readers[0];
		}
		const readerCollection = resourceFactory.createReaderCollection({
			name: `Reader collection for module project ${this.getName()}`,
			readers,
		});
		return resourceFactory.createReaderCollectionPrioritized({
			name: `Reader/Writer collection for project ${this.getName()}`,
			readers: [this._getWriter(), readerCollection],
		});
	}

	/**
	 * Get a resource reader/writer for accessing and modifying a project's resources
	 *
	 * @returns A reader collection instance
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
			});
		}

		return this._writer;
	}

	protected async _configureAndValidatePaths(config: ProjectConfiguration) {
		this._log.verbose(`Path mapping for module project ${this.getName()}:`);
		this._log.verbose(`  Physical root path: ${this.getRootPath()}`);
		this._log.verbose(`  Mapped to:`);

		if (config.resources?.configuration?.paths) {
			const pathMappings = Object.entries(config.resources.configuration.paths);
			if (this._log.isLevelEnabled("verbose")) {
				// Log synchronously before async dir-exists checks
				pathMappings.forEach(([virBasePath, relFsPath]) => {
					this._log.verbose(`    ${virBasePath} => ${relFsPath}`);
				});
			}
			this._paths = await Promise.all(pathMappings.map(async ([virBasePath, relFsPath]) => {
				if (!(await this._dirExists("/" + relFsPath))) {
					throw new Error(
						`Unable to find source directory '${relFsPath}' in module project ${this.getName()}`);
				}
				return {
					name: `'${relFsPath}'' reader for module project ${this.getName()}`,
					virBasePath,
					fsBasePath: fsPath.join(this.getRootPath(), relFsPath),
				};
			}));
		} else {
			this._log.verbose(`    / => <project root>`);
			if (!(await this._dirExists("/"))) {
				throw new Error(
					`Unable to find root directory of module project ${this.getName()}`);
			}
			this._paths = [{
				name: `Root reader for module project ${this.getName()}`,
				virBasePath: "/",
				fsBasePath: this.getRootPath(),
			}];
		}
	}

	protected async _parseConfiguration(_config: ProjectConfiguration, _buildManifest?: BuildManifest) {
		// Nothing to do
	}
}

export default Module;
