import path from "node:path";
import fs from "graceful-fs";
import _StreamZip from "node-stream-zip";
const StreamZip = _StreamZip.async;
import {promisify} from "node:util";
import _rimraf from "rimraf";
const rimraf = promisify(_rimraf);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const rename = promisify(fs.rename);
const mkdir = promisify(fs.mkdir);
const rm = promisify(fs.rm);
import logger from "@ui5/logger";
const log = logger.getLogger("ui5Framework:maven:Installer");
import Repository from "./Repository.js";
import AbstractInstaller from "../AbstractInstaller.js";

const mvnTimestampRegex = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/;

const STANDARD_CACHE_TIME = 32400000; // 9 hours
const RELAXED_CACHE_TIME = 14400000; // 4 hours
const RELAXED_MAX_CACHE_TIME = 518400000; // 6 days

class Installer extends AbstractInstaller {
	/**
	 * @param {object} parameters Parameters
	 * @param {string} parameters.cwd
	 * @param {string} parameters.endpointUrl
	 *   Maven repository URL to use for fetching artifacts and metadata.
	 * 	 Example: <code>https://repository.corp/vendor/build-snapshots/</code>
	 * @param {string} [parameters.ui5HomeDir="~/.ui5"]
	 *   UI5 home directory location. This will be used for caching purposes
	 *   and to store packages and metadata used by the framework resolvers.
	 *   Relative paths will be resolved based on <code>process.cwd()</code>
	 * @param {string} [parameters.cacheMode="eager"]
	 *   Can be <code>eager</code> (cache everything, invalidate after 9 hours),
	 * 	 <code>off</code> (do not cache, request everything),
	 *   <code>force</code> (use cache only, never contact the Maven repository),
	 *   <code>relaxed</code> (attempt refresh every 4 hours, but fallback to cache if endpoint can't be reached -
	 *   invalidate cache after 6 days)
	 */
	constructor({cwd, ui5HomeDir, endpointUrl, cacheMode = "eager"}) {
		super(ui5HomeDir);
		if (!cwd) {
			throw new Error(`Installer: Missing parameter "cwd"`);
		}
		this._artifactsDir = path.join(ui5HomeDir, "framework", "artifacts");
		this._packagesDir = path.join(ui5HomeDir, "framework", "packages");
		this._metadataDir = path.join(ui5HomeDir, "framework", "metadata");
		this._stagingDir = path.join(ui5HomeDir, "framework", "staging");

		this._cwd = cwd;
		this._cacheMode = cacheMode;
		this._endpointUrl = endpointUrl || process.env.UI5_MAVEN_SNAPSHOT_ENDPOINT;

		if (!this._endpointUrl) {
			throw new Error(`Installer: Missing Repository Endpoint URL`);
		}

		log.verbose(`Installing Maven artifacts to: ${this._artifactsDir}`);
		log.verbose(`Installing Packages to: ${this._packagesDir}`);
		log.verbose(`Caching mode: ${this._cacheMode}`);
	}

	getRepository() {
		if (this._cachedRepository) {
			return this._cachedRepository;
		}
		return this._cachedRepository = new Repository({
			cwd: this._cwd,
			endpointUrl: this._endpointUrl
		});
	}

	async readJson(jsonPath) {
		return JSON.parse(await readFile(jsonPath, {encoding: "utf8"}));
	}

	async _writeJson(jsonPath, jsonObject) {
		return writeFile(jsonPath, JSON.stringify(jsonObject));
	}

	async fetchPackageVersions({groupId, artifactId}) {
		const metadata = await this.getRepository().requestMavenMetadata({groupId, artifactId});

		if (!metadata?.versioning?.versions?.version) {
			throw new Error(`Missing Maven metadata for artifact ${groupId}:${artifactId}`);
		}
		return metadata.versioning.versions.version.filter((version) => {
			// This resolver can only handle SNAPSHOT versions
			return version.endsWith("-SNAPSHOT");
		});
	}

	/**
	 * Fills and maintains locally cached metadata for the given artifact coordinates
	 *
	 * @param {object} coordinates
	 * @param {string} coordinates.groupId GroupId of the requested artifact
	 * @param {string} coordinates.artifactId ArtifactId of the requested artifact
	 * @param {string} coordinates.version Version of the requested artifact
	 * @param {string} coordinates.classifier Classifier of the requested artifact
	 * @param {string} coordinates.extension Extension of the requested artifact
	 * @param {string} [coordinates.pkgName] npm package name the artifact corresponds to (if any)
	 * @returns {@ui5/project/ui5Framework/maven/Installer~LocalMetadata}
	 *
	 */
	async _fetchArtifactMetadata(coordinates) {
		const fsId = this._generateFsIdFromCoordinates(coordinates);
		const logId = this._generateLogIdFromCoordinates(coordinates);
		return this._synchronize("metadata-" + fsId, async () => {
			const localMetadata = await this._getLocalArtifactMetadata(fsId);

			if (this._cacheMode === "force" && !localMetadata.revision) {
				throw new Error(`Could not find artifact ` +
					`${logId} in local cache`);
			}

			const effectiveCacheTime = this._cacheMode === "relaxed" ? RELAXED_CACHE_TIME : STANDARD_CACHE_TIME;
			const now = new Date().getTime();
			const timeSinceLastCheck = now - localMetadata.lastCheck;

			if (this._cacheMode !== "force" &&
				(timeSinceLastCheck > effectiveCacheTime || this._cacheMode === "off")) {
				// No cached metadata (-> timeSinceLastCheck equals time since 1970) or
				// too old metadata or disabled cache
				// => Retrieve metadata from repository
				if (localMetadata.lastCheck === 0) {
					log.verbose(
						`Could not find metadata for artifact ${logId} in local cache. Fetching from repository...`);
				} else {
					log.verbose(
						`Refreshing metadata cache for artifact ${logId} ` +
						// TODO better formatting of elapsed time
						`(last checked ${timeSinceLastCheck/1000} seconds ago)`);
				}

				log.info(
					`Attempting to fetch latest metadata for artifact ${coordinates.artifactId} ` +
					`version ${coordinates.version} from Maven repository...`);
				try {
					const {lastRepositoryUpdate, revision} = await this._getRemoteArtifactMetadata(coordinates);

					if (revision === localMetadata.revision) {
						log.info(
							`Metadata for artifact ${coordinates.artifactId} ` +
							`version ${coordinates.version} is already up-to-date`);
						localMetadata.lastUpdate = now;
					} else {
						if (localMetadata.revision) {
							// TODO better formatting of elapsed time
							log.verbose(`Repository contains ` +
								`${(lastRepositoryUpdate - localMetadata.lastRepositoryUpdate) / 1000} ` +
								`seconds younger data for artifact ${logId}.`);
						}
						log.info(
							`Retrieved new revision for artifact ${coordinates.artifactId} ` +
							`version ${coordinates.version}: ${revision}`);

						this._rotateRevision(localMetadata, revision);
						await this._removeStaleRevisions(logId, localMetadata, coordinates);
						localMetadata.lastRepositoryUpdate = lastRepositoryUpdate;
						localMetadata.lastUpdate = now;
					}
				} catch (err) {
					if (err.cause && err.cause.code === "ENOTFOUND" &&
						this._cacheMode === "relaxed" && localMetadata.revision) {
						// Failed to connect to repository - But cache mode is set to relaxed, and metadata
						// cache is filled. So ignore this error and try again in RELAXED_CACHE_TIME

						// ...unless RELAXED_MAX_CACHE_TIME has been breached:
						const timeSinceLastUpdate = now - localMetadata.lastUpdate;
						if (timeSinceLastUpdate > RELAXED_MAX_CACHE_TIME) {
							// Cache should not be used anymore
							throw err;
						}
						log.info(`Could not connect to Maven repository. Falling back to cache...`);
					} else {
						throw err;
					}
				}
				localMetadata.lastCheck = now;
				await this._writeLocalArtifactMetadata(fsId, localMetadata);
			} else {
				log.verbose(`Using metadata for artifact ${logId} from local cache`);
			}
			return localMetadata;
		});
	}

	async _getRemoteArtifactMetadata({groupId, artifactId, version, classifier, extension}) {
		const metadata = await this.getRepository().requestMavenMetadata({groupId, artifactId, version});

		if (!metadata?.versioning?.snapshotVersions?.snapshotVersion) {
			throw new Error(`Missing Maven snapshot metadata for artifact ${groupId}:${artifactId}:${version}`);
		}

		const snapshotVersion = metadata.versioning.snapshotVersions.snapshotVersion;
		const deploymentMetadata = snapshotVersion.find(({
			classifier: candidateClassifier, // Classifier can be null, e.g. for the default "jar" artifact
			extension: candidateExtension
		}) => (!classifier || candidateClassifier === classifier) && candidateExtension === extension);

		if (!deploymentMetadata) {
			throw new Error(
				`Could not find deployment ${classifier}.${extension} for artifact ` +
				`${groupId}:${artifactId}:${version} in snapshot metadata:\n` +
				`${JSON.stringify(snapshotVersion)}`);
		}
		// Convert Maven timestamp (yyyyMMddHHmmss UTC) to ISO string (YYYY-MM-DDTHH:mm:ss.sssZ)
		// E.g. 20220828080910 becomes 2022-08-28T08:09:10.000Z
		const isoTimestamp = deploymentMetadata.updated.replace(mvnTimestampRegex, "$1-$2-$3T$4:$5:$6.000Z");
		const ts = new Date(isoTimestamp);

		const logId = this._generateLogIdFromCoordinates({groupId, artifactId, version, classifier, extension});
		log.verbose(`Retrieved metadata for ${logId}:` +
			`\n  Last update was at: ${ts.toISOString()}` +
			`\n  Current deployment version is: ${deploymentMetadata.value}`);
		return {
			lastRepositoryUpdate: ts.getTime(),
			revision: deploymentMetadata.value
		};
	}

	async _getLocalArtifactMetadata(id) {
		try {
			return await this.readJson(path.join(this._metadataDir, `${id}.json`));
		} catch (err) {
			if (err.code === "ENOENT") { // "File or directory does not exist"
				// If not found, initialize metadata
				return {
					lastCheck: 0, // Last time a metadata update was attempted by the client
					lastUpdate: 0, // Time the artifact metadata was last updated locally
					lastRepositoryUpdate: 0, // Time the artifact metadata was last updated in the repository
					revision: null, // Latest revision to use
					staleRevisions: [] // Old revisions that might have been used (also see _rotateRevision)
				};
			} else {
				throw err;
			}
		}
	}

	async _writeLocalArtifactMetadata(id, content) {
		await mkdir(this._metadataDir, {recursive: true});
		return await this._writeJson(path.join(this._metadataDir, `${id}.json`), content);
	}

	_rotateRevision(metadata, newRevision) {
		if (metadata.revision) {
			metadata.staleRevisions.push({
				revision: metadata.revision,
				lastUpdate: metadata.lastUpdate,
				lastRepositoryUpdate: metadata.lastRepositoryUpdate
			});
		}
		metadata.revision = newRevision;
	}

	async _removeStaleRevisions(logId, metadata, {pkgName, groupId, artifactId, version, classifier, extension}) {
		if (metadata.staleRevisions.length <= 1) {
			// Keep at least one revision
			// => Nothing to do
			return;
		}
		log.info(
			`Cleaning up stale revisions of artifact ${artifactId} ` +
			`version ${version}...`);
		log.verbose(`Removing ${metadata.staleRevisions.length - 1} stale revision for ${logId}...`);
		while (metadata.staleRevisions.length > 1) {
			const {revision} = metadata.staleRevisions.shift();
			const artifactPath = this._getTargetPathForArtifact({
				groupId,
				artifactId,
				revision,
				classifier,
				extension
			});
			log.verbose(`Removing artifact ${artifactPath}...`);
			await rm(artifactPath, {
				force: true
			});

			if (pkgName) {
				const packageDir = this._getTargetDirForPackage(pkgName, revision);
				log.verbose(`Removing package directory ${packageDir}...`);
				await rimraf(packageDir);
			}
		}
	}

	/**
	 * @typedef {object} @ui5/project/ui5Framework/maven/Installer~InstalledPackage
	 * @property {string} pkgPath
	 */

	/**
	 * Downloads the respective artifact for a package and extracts the archive into a
	 * structure similar to the npm installer
	 *
	 * @param {object} parameters
	 * @param {string} parameters.pkgName Name of the npm package
	 * @param {string} parameters.groupId GroupId of the requested artifact
	 * @param {string} parameters.artifactId ArtifactId of the requested artifact
	 * @param {string} parameters.version Version of the requested artifact
	 * @param {string} parameters.classifier Classifier of the requested artifact
	 * @param {string} parameters.extension Extension of the requested artifact
	 * @returns {@ui5/project/ui5Framework/maven/Installer~InstalledPackage}
	 */
	async installPackage({pkgName, groupId, artifactId, version, classifier, extension}) {
		const {revision} = await this._fetchArtifactMetadata({
			pkgName, groupId, artifactId, version, classifier, extension
		});

		const coordinates = {
			groupId, artifactId,
			version, revision,
			classifier, extension
		};

		const targetDir = this._getTargetDirForPackage(pkgName, revision);
		const installed = await this._projectExists(targetDir);

		if (!installed) {
			await this._synchronize(`package-${pkgName}@${revision}`, async () => {
				const installed = await this._projectExists(targetDir);

				if (installed) {
					log.verbose(`Already installed: ${pkgName} in SNAPSHOT version ${revision}`);
					return;
				}

				const stagingDir = this._getStagingDirForPackage(pkgName, revision);

				// Check whether staging dir already exists and remove it
				if (await this._pathExists(stagingDir)) {
					log.verbose(`Removing stale staging directory at ${stagingDir}...`);
					await rimraf(stagingDir);
				}

				await mkdir(stagingDir, {recursive: true});

				const {artifactPath, removeArtifact} = await this.installArtifact(coordinates);

				log.verbose(`Extracting archive at ${artifactPath} to ${stagingDir}...`);
				const zip = new StreamZip({file: artifactPath});
				let rootDir = null;
				if (extension === "jar") {
					rootDir = "META-INF";
				}
				await zip.extract(rootDir, stagingDir);
				await zip.close();

				// Check whether target dir already exists and remove it
				if (await this._pathExists(targetDir)) {
					log.verbose(`Removing existing target directory at ${targetDir}...`);
					await rimraf(targetDir);
				}

				// Do not create target dir itself to prevent EPERM error in following rename operation
				// (https://github.com/SAP/ui5-tooling/issues/487)
				await mkdir(path.dirname(targetDir), {recursive: true});
				log.verbose(`Promoting staging directory from ${stagingDir} to ${targetDir}...`);
				await rename(stagingDir, targetDir);

				await removeArtifact();
			});
		} else {
			log.verbose(`Already installed: ${pkgName} in SNAPSHOT version ${revision}`);
		}
		return {
			pkgPath: targetDir
		};
	}

	/**
	 * @typedef {object} @ui5/project/ui5Framework/maven/Installer~InstalledArtifact
	 * @property {string} artifactPath
	 * @property {Function} removeArtifact Callback to trigger removal of the artifact file in case it
	 * is no longer required.
	 */

	/**
	 * @param {object} parameters
	 * @param {string} parameters.groupId GroupId of the requested artifact
	 * @param {string} parameters.artifactId ArtifactId of the requested artifact
	 * @param {string} parameters.version Version of the requested artifact
	 * @param {string} parameters.classifier Classifier of the requested artifact
	 * @param {string} parameters.extension Extension of the requested artifact
	 * @param {string} [parameters.revision] Optional revision of the artifact to request.
	 * 	If not provided the latest revision will be determined via the repository metadata.
	 * @returns {@ui5/project/ui5Framework/maven/Installer~InstalledArtifact}
	 *
	 */
	async installArtifact({groupId, artifactId, version, classifier, extension, revision}) {
		if (!revision) {
			const metadata = await this._fetchArtifactMetadata({
				groupId, artifactId, version, classifier, extension
			});
			revision = metadata.revision;
		}
		const coordinates = {
			groupId, artifactId,
			version, revision,
			classifier, extension
		};

		const targetPath = this._getTargetPathForArtifact(coordinates);
		const installed = await this._pathExists(targetPath);
		const logId = this._generateLogIdFromCoordinates(coordinates);
		const fsId = this._generateFsIdFromCoordinates(coordinates);
		if (!installed) {
			await this._synchronize(`artifact-${fsId}`, async () => {
				// check again whether the artifact is now installed
				const installed = await this._pathExists(targetPath);
				if (installed) {
					log.verbose(`Already installed: ${artifactId} in version ${revision}`);
					return;
				}

				const stagingPath = this._getStagingPathForArtifact(coordinates);
				log.info(`Installing missing artifact ${logId}...`);

				// Check whether staging dir already exists and remove it
				if (await this._pathExists(stagingPath)) {
					log.verbose(`Removing existing file in staging dir at ${stagingPath}...`);
					await rm(stagingPath);
				}
				await mkdir(path.dirname(stagingPath), {recursive: true});

				log.verbose(`Installing ${artifactId} in version ${version} to ${stagingPath}...`);

				// TODO: Stream response body to installPackage and unzip directly via
				// https://github.com/isaacs/minizlib (already in dependencies through pacote)
				// This way we do not store the archive unnecessarily
				await this.getRepository().requestArtifact(coordinates, stagingPath);

				await mkdir(path.dirname(targetPath), {recursive: true});
				log.verbose(
					`Promoting artifact from staging path ${stagingPath} to target path at ${targetPath}...`);
				await rename(stagingPath, targetPath);
			});
		} else {
			log.verbose(`Already installed: ${artifactId} in version ${revision}`);
		}
		return {
			artifactPath: targetPath,
			removeArtifact: () => {
				return rm(targetPath);
			}
		};
	}

	async _projectExists(targetDir) {
		const markers = await Promise.all([
			this._pathExists(path.join(targetDir, "package.json")),
			this._pathExists(path.join(targetDir, ".ui5", "build-manifest.json"))
		]);
		return markers.includes(true);
	}

	async _pathExists(targetPath) {
		try {
			await stat(targetPath);
			return true;
		} catch (err) {
			if (err.code === "ENOENT") { // "File or directory does not exist"
				return false;
			} else {
				throw err;
			}
		}
	}

	/**
	 * Generate a staging path for a given artifact to be stored temporarily
	 *
	 * @param {object} coordinates
	 * @param {string} coordinates.groupId GroupId of the artifact
	 * @param {string} coordinates.artifactId ArtifactId of the artifact
	 * @param {string} coordinates.extension Extension of the artifact
	 * @param {string} [coordinates.classifier] Optional classifier of the artifact
	 * @param {string} [coordinates.version] Version of the artifact. Optional if revision is provided
	 * @param {string} [coordinates.revision] Optional revision of the artifact
	 * @returns {string} Absolute file-path to store the artifact at
	 */
	_getStagingPathForArtifact(coordinates) {
		// Staging dir should only contain single files, no directory hierarchy.
		// This makes cleanups after promoting artifacts easier and does not leave empty directories.
		return path.join(this._stagingDir, this._generateFsIdFromCoordinates(coordinates));
	}

	/**
	 * Generate a target path for a given artifact to be stored
	 *
	 * @param {object} coordinates
	 * @param {string} coordinates.groupId GroupId of the artifact
	 * @param {string} coordinates.artifactId ArtifactId of the artifact
	 * @param {string} coordinates.extension Extension of the artifact
	 * @param {string} [coordinates.classifier] Optional classifier of the artifact
	 * @param {string} [coordinates.version] Version of the artifact. Optional if revision is provided
	 * @param {string} [coordinates.revision] Optional revision of the artifact
	 * @returns {string} Absolute file-path to store the artifact at
	 */
	_getTargetPathForArtifact(coordinates) {
		// Since requested artifacts are often archives of packages, which get extracted and removed right after,
		// store them in a flat hierarchy. This prevents leaving empty directories after removing an artifact.
		return path.join(this._artifactsDir, this._generateFsIdFromCoordinates(coordinates));
	}

	/**
	 * Generate a staging path for a given package to be extracted into temporarily
	 *
	 * @param {string} pkgName Package name as defined in the package.json
	 * @param {string} version Version of the package
	 * @returns {string} Absolute directory-path to store the extracted package in
	 */
	_getStagingDirForPackage(pkgName, version) {
		// Staging dir should only contain single files, no directory hierarchy.
		// This makes cleanups after promoting artifacts easier and does not leave empty directories.
		return path.join(this._stagingDir, `${pkgName.replaceAll("/", "-")}-${version}`);
	}

	/**
	 * Generate a target path for a given package to be stored in
	 *
	 * @param {string} pkgName Package name as defined in the package.json
	 * @param {string} version Version of the package
	 * @returns {string} Absolute directory-path to store the extracted package in
	 */
	_getTargetDirForPackage(pkgName, version) {
		return path.join(this._packagesDir, ...pkgName.split("/"), version);
	}

	/**
	 * Generate an identifier for an artifact that is safe to use in file names.
	 * Used for naming metadata- and lock-files
	 *
	 * @param {object} coordinates
	 * @param {string} coordinates.groupId GroupId of the artifact
	 * @param {string} coordinates.artifactId ArtifactId of the artifact
	 * @param {string} coordinates.extension Extension of the artifact
	 * @param {string} [coordinates.classifier] Optional classifier of the artifact
	 * @param {string} [coordinates.version] Version of the artifact. Optional if revision is provided
	 * @param {string} [coordinates.revision] Optional revision of the artifact
	 * @returns {string} A unique identifier for the provided combination of coordinates
	 */
	_generateFsIdFromCoordinates({groupId, artifactId, version, classifier, extension, revision}) {
		// Using underscores instead of colons since colon is a reserved character for
		// filenames on Windows and macOS
		const optionalClassifier = classifier ? `${classifier}.` : "";
		return `${groupId}_${artifactId}_${revision || version}_${optionalClassifier}${extension}`;
	}

	/**
	 * Generate an identifier for an artifact that is suitable for logging purposes
	 *
	 * @param {object} coordinates
	 * @param {string} coordinates.groupId GroupId of the artifact
	 * @param {string} coordinates.artifactId ArtifactId of the artifact
	 * @param {string} coordinates.version Version of the artifact
	 * @param {string} coordinates.extension Extension of the artifact
	 * @param {string} [coordinates.classifier] Optional classifier of the artifact
	 * @param {string} [coordinates.revision] Optional revision of the artifact
	 * @returns {string} A string with the Maven-typical formatting of the provided coordinates
	 */
	_generateLogIdFromCoordinates({groupId, artifactId, version, classifier, extension, revision}) {
		const optionalClassifier = classifier ? `${classifier}.` : "";
		return `${groupId}:${artifactId}:${revision || version}:${optionalClassifier}${extension}`;
	}
}

export default Installer;
