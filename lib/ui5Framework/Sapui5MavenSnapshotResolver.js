import path from "node:path";
import os from "node:os";
import AbstractResolver from "./AbstractResolver.js";
import Installer from "./maven/Installer.js";
import {getLogger} from "@ui5/logger";
const log = getLogger("ui5Framework:Sapui5MavenSnapshotResolver");

const DIST_PKG_NAME = "@sapui5/distribution-metadata";
const DIST_GROUP_ID = "com.sap.ui5.dist";
const DIST_ARTIFACT_ID = "sapui5-sdk-dist";

/**
 * Resolver for the SAPUI5 framework
 *
 * @public
 * @class
 * @alias @ui5/project/ui5Framework/Sapui5MavenSnapshotResolver
 * @extends @ui5/project/ui5Framework/AbstractResolver
 */
class Sapui5MavenSnapshotResolver extends AbstractResolver {
	/**
	 * @param {*} options options
	 * @param {string} options.version SAPUI5 version to use
	 * @param {string} [options.cwd=process.cwd()] Working directory to resolve configurations like .npmrc
	 * @param {string} [options.ui5HomeDir="~/.ui5"] UI5 home directory location. This will be used to store packages,
	 * metadata and configuration used by the resolvers. Relative to `process.cwd()`
	 */
	constructor(options) {
		super(options);

		const {config} = options;
		let snapshotEndpointUrl;
		let cacheMode;
		let artifactsDir;
		let packagesDir;
		let metadataDir;
		let stagingDir;

		if (options.config) {
			snapshotEndpointUrl = config.getSnapshotEndpointUrl();
			cacheMode = config.getCacheMode();
			artifactsDir = config.getArtifactsDir();
			packagesDir = config.getPackagesDir();
			metadataDir = config.getMetadataDir();
			stagingDir	 = config.getStagingDir();
		}

		this._installer = new Installer({
			cwd: this._cwd,
			ui5HomeDir: this._ui5HomeDir,
			snapshotEndpointUrl, cacheMode, artifactsDir,
			packagesDir, metadataDir, stagingDir
		});
		this._loadDistMetadata = null;
	}
	loadDistMetadata() {
		if (!this._loadDistMetadata) {
			this._loadDistMetadata = Promise.resolve().then(async () => {
				const version = this._version;
				log.verbose(`Installing ${DIST_ARTIFACT_ID} in version ${version}...`);
				const {pkgPath: distPkgPath} = await this._installer.installPackage({
					pkgName: DIST_PKG_NAME,
					groupId: DIST_GROUP_ID,
					artifactId: DIST_ARTIFACT_ID,
					version,
					classifier: "npm-sources",
					extension: "zip"
				});

				return await this._installer.readJson(path.join(distPkgPath, "metadata.json"));
			});
		}
		return this._loadDistMetadata;
	}
	async getLibraryMetadata(libraryName) {
		const distMetadata = await this.loadDistMetadata();
		const metadata = distMetadata.libraries[libraryName];

		if (!metadata) {
			throw new Error(`Could not find library "${libraryName}"`);
		}

		return metadata;
	}
	async handleLibrary(libraryName) {
		const metadata = await this.getLibraryMetadata(libraryName);
		if (!metadata.gav) {
			throw new Error(
				`Metadata is missing GAV information. This might indicate an unsupported SNAPSHOT version.`);
		}
		const gav = metadata.gav.split(":");
		let pkgName = metadata.npmPackageName;
		if (!this._sources) {
			pkgName += "-prebuilt";
		}
		return {
			metadata: Promise.resolve({
				id: pkgName,
				version: metadata.version,
				dependencies: metadata.dependencies,
				optionalDependencies: metadata.optionalDependencies
			}),
			// Trigger installation of package
			install: this._installer.installPackage({
				pkgName,
				groupId: gav[0],
				artifactId: gav[1],
				version: metadata.version,
				classifier: this._sources ? "npm-sources" : null,
				extension: this._sources ? "zip" : "jar"
			})
		};
	}
	static async fetchAllVersions({ui5HomeDir, cwd} = {}) {
		const installer = new Installer({
			cwd: cwd ? path.resolve(cwd) : process.cwd(),
			ui5HomeDir:
				ui5HomeDir ? path.resolve(ui5HomeDir) :
					path.join(os.homedir(), ".ui5")
		});
		return await installer.fetchPackageVersions({
			groupId: DIST_GROUP_ID,
			artifactId: DIST_ARTIFACT_ID,
		});
	}
}

export default Sapui5MavenSnapshotResolver;
