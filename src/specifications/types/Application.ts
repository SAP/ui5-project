import fsPath from "node:path";
import ComponentProject, {type Manifest} from "../ComponentProject.js";
import {createReader} from "@ui5/fs/resourceFactory";
import {type ProjectConfiguration} from "../Project.js";
import {type BuildManifest} from "../../build/helpers/createBuildManifest.js";

interface ManifestAppDescVariant {
	id?: string;
}

/**
 * Application
 *
 * @hideconstructor
 */
class Application extends ComponentProject {
	_pManifests = new Map<string, Promise<Manifest | ManifestAppDescVariant>>();
	_webappPath = "webapp";
	_isRuntimeNamespaced = false;

	/* === Attributes === */

	/**
	 * Get the cachebuster signature type configuration of the project
	 *
	 * @returns <code>time</code> or <code>hash</code>
	 */
	getCachebusterSignatureType() {
		return this._config.builder?.cachebuster?.signatureType ?? "time";
	}

	/**
	 * Get the path of the project's source directory. This might not be POSIX-style on some platforms.
	 *
	 * @returns Absolute path to the source directory of the project
	 */
	public getSourcePath() {
		return fsPath.join(this.getRootPath(), this._webappPath);
	}

	/* === Resource Access === */
	/**
	 * Get a resource reader for the sources of the project (excluding any test resources)
	 *
	 * @param excludes List of glob patterns to exclude
	 * @returns Reader collection
	 */
	_getSourceReader(excludes: string[]) {
		return createReader({
			fsBasePath: this.getSourcePath(),
			virBasePath: `/resources/${this._namespace}/`,
			name: `Source reader for application project ${this.getName()}`,
			project: this,
			excludes,
		});
	}

	_getTestReader() {
		return null; // Applications do not have a dedicated test directory
	}

	/**
	 * Get a resource reader for the sources of the project (excluding any test resources)
	 * without a virtual base path
	 *
	 * @returns Reader collection
	 */
	_getRawSourceReader() {
		return createReader({
			fsBasePath: this.getSourcePath(),
			virBasePath: "/",
			name: `Raw source reader for application project ${this.getName()}`,
			project: this,
		});
	}

	protected async _configureAndValidatePaths(config: ProjectConfiguration) {
		if (config.resources?.configuration?.paths?.webapp) {
			this._webappPath = config.resources.configuration.paths.webapp;
		}

		this._log.verbose(`Path mapping for application project ${this.getName()}:`);
		this._log.verbose(`  Physical root path: ${this.getRootPath()}`);
		this._log.verbose(`  Mapped to: ${this._webappPath}`);

		if (!(await this._dirExists("/" + this._webappPath))) {
			throw new Error(
				`Unable to find source directory '${this._webappPath}' in application project ${this.getName()}`);
		}
	}

	protected async _parseConfiguration(config: ProjectConfiguration, buildManifest?: BuildManifest) {
		if (buildManifest) {
			this._namespace = buildManifest.namespace;
			return;
		}
		this._namespace = await this._getNamespace();
	}

	/**
	 * Determine application namespace either based on a project`s
	 * manifest.json or manifest.appdescr_variant (fallback if present)
	 *
	 * @returns Namespace of the project
	 * @throws {Error} if namespace can not be determined
	 */
	async _getNamespace(): Promise<string> {
		try {
			return await this._getNamespaceFromManifestJson();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (manifestJsonError: any) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if (manifestJsonError.code !== "ENOENT") {
				throw manifestJsonError;
			}
			// No manifest.json present
			// => attempt fallback to manifest.appdescr_variant (typical for App Variants)
			try {
				return await this._getNamespaceFromManifestAppDescVariant();

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} catch (appDescVarError: any) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				if (appDescVarError.code === "ENOENT") {
					// Fallback not possible: No manifest.appdescr_variant present
					// => Throw error indicating missing manifest.json
					// 	(do not mention manifest.appdescr_variant since it is only
					// 	relevant for the rather "uncommon" App Variants)
					throw new Error(
						`Could not find required manifest.json for project ` +
						// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
						`${this.getName()}: ${manifestJsonError.message}\n\n` +
						`If you are about to start a new project, please refer to:\n` +
						`https://sap.github.io/ui5-tooling/v4/pages/GettingStarted/#starting-a-new-project`, {
							cause: manifestJsonError,
						});
				}
				throw appDescVarError;
			}
		}
	}

	/**
	 * Determine application namespace by checking manifest.json.
	 * Any maven placeholders are resolved from the projects pom.xml
	 *
	 * @returns Namespace of the project
	 * @throws {Error} if namespace can not be determined
	 */
	async _getNamespaceFromManifestJson() {
		const manifest = await this._getManifest("/manifest.json") as Manifest;
		let appId;
		// check for a proper sap.app/id in manifest.json to determine namespace
		if (manifest["sap.app"]?.id) {
			appId = manifest["sap.app"].id;
		} else {
			throw new Error(
				`No sap.app/id configuration found in manifest.json of project ${this.getName()}`);
		}

		if (this._hasMavenPlaceholder(appId)) {
			try {
				appId = await this._resolveMavenPlaceholder(appId);
			} catch (err) {
				if (err instanceof Error) {
					throw new Error(
						`Failed to resolve namespace of project ${this.getName()}: ${err.message}`);
				}
				throw err;
			}
		}
		const namespace = appId.replace(/\./g, "/");
		this._log.verbose(
			`Namespace of project ${this.getName()} is ${namespace} (from manifest.json)`);
		return namespace;
	}

	/**
	 * Determine application namespace by checking manifest.appdescr_variant.
	 *
	 * @returns Namespace of the project
	 * @throws {Error} if namespace can not be determined
	 */
	async _getNamespaceFromManifestAppDescVariant() {
		const manifest = await this._getManifest("/manifest.appdescr_variant") as ManifestAppDescVariant;
		let appId: string;
		// check for the id property in manifest.appdescr_variant to determine namespace
		if (manifest?.id) {
			appId = manifest.id;
		} else {
			throw new Error(
				`No "id" property found in manifest.appdescr_variant of project ${this.getName()}`);
		}

		const namespace = appId.replace(/\./g, "/");
		this._log.verbose(
			`Namespace of project ${this.getName()} is ${namespace} (from manifest.appdescr_variant)`);
		return namespace;
	}

	/**
	 * Reads and parses a JSON file with the provided name from the projects source directory
	 *
	 * @param filePath Name of the JSON file to read. Typically "manifest.json" or "manifest.appdescr_variant"
	 * @returns resolves with an object containing the content requested manifest file
	 */
	async _getManifest(filePath: string): Promise<Manifest | ManifestAppDescVariant> {
		let pManifest = this._pManifests.get(filePath);
		if (pManifest) {
			return pManifest;
		}
		pManifest = this._getRawSourceReader().byPath(filePath)
			.then(async (resource) => {
				if (!resource) {
					const error = new Error(
						`Could not find resource ${filePath} in project ${this.getName()}`);
					// @ts-expect-error TypeScript types for error are incomplete, sigh...
					error.code = "ENOENT"; // "File or directory does not exist"
					throw error;
				}
				return JSON.parse(await resource.getString()) as Manifest | ManifestAppDescVariant;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			}).catch((err: any) => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				if (err.code === "ENOENT") {
					throw err;
				}
				throw new Error(
					`Failed to read ${filePath} for project ` +
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					`${this.getName()}: ${err.message}`);
			});
		this._pManifests.set(filePath, pManifest);
		return pManifest;
	}
}

export default Application;
