import path from "node:path";
import mkdirp from "mkdirp";
import fs from "graceful-fs";
import StreamZip from "node-stream-zip";
import {promisify} from "node:util";
import Registry from "./Registry.js";
import _rimraf from "rimraf";
const rimraf = promisify(_rimraf);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const rename = promisify(fs.rename);
const rm = promisify(fs.rm);
import logger from "@ui5/logger";
const log = logger.getLogger("ui5Framework:maven:Installer");
const mvnTimestampRegex = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/;

const CACHE_TIME = 30000; // TODO

class Installer {
	/*
		cacheMode: default|off|force aka. default|no-store|force-cache (make-fetch-happen options)
	*/
	constructor({cwd, ui5HomeDir, cacheMode = "default"}) {
		if (!cwd) {
			throw new Error(`Installer: Missing parameter "cwd"`);
		}
		if (!ui5HomeDir) {
			throw new Error(`Installer: Missing parameter "ui5HomeDir"`);
		}
		this._artifactsDir = path.join(ui5HomeDir, "framework", "mvn_artifacts");
		this._packagesDir = path.join(ui5HomeDir, "framework", "mvn_packages");
		this._cwd = cwd;
		this._caCacheDir = path.join(ui5HomeDir, "framework", "mvn_cacache");
		this._metadataDir = path.join(ui5HomeDir, "framework", "mvn_metadata");
		this._lockDir = path.join(ui5HomeDir, "framework", "locks");
		this._stagingDir = path.join(ui5HomeDir, "framework", "staging");
		this._cacheMode = cacheMode;

		log.verbose(`Installing to: ${this._artifactsDir}`);
		log.verbose(`Caching set to: ${this._cacheMode}`);
	}

	getRegistry() {
		if (this._cachedRegistry) {
			return this._cachedRegistry;
		}
		if (!process.env.SNAPSHOT_ENDPOINT_URL) {
			throw new Error("Missing environment variable SNAPSHOT_ENDPOINT_URL. TODO: Make this a configuration");
		}
		return this._cachedRegistry = new Registry({
			cwd: this._cwd,
			cacheDir: this._caCacheDir,
			endpointUrl: process.env.SNAPSHOT_ENDPOINT_URL // TODO: Make this a configuration
		});
	}

	async readJson(jsonPath) {
		return JSON.parse(await readFile(jsonPath, {encoding: "utf8"}));
	}

	async _writeJson(jsonPath, jsonObject) {
		return writeFile(jsonPath, JSON.stringify(jsonObject));
	}

	async fetchPackageVersions({pkgName}) {
		const packument = await this.getRegistry().requestPackagePackument(pkgName);
		return Object.keys(packument.versions);
	}

	async _fetchArtifactMetadata(coordinates) {
		const id = this._generateHashFromCoordinates(coordinates);
		const logId = this._generateLogIdFromCoordinates(coordinates);
		return this._synchronize("metadata-" + id, async () => {
			const localMetadata = await this._getLocalArtifactMetadata(id);

			if (this._cacheMode === "force" && !localMetadata.deploymentVersion) {
				throw new Error(`Could not find artifact ` +
					`${logId} in local cache`);
			}

			const now = new Date().getTime();
			const timeSinceLastCheck = now - localMetadata.lastCheck;

			if (timeSinceLastCheck > CACHE_TIME || this._cacheMode === "off") {
				// New artifact version or more than CACHE_TIME has passed since last check
				// => Retrieve metadata from registry
				if (localMetadata.lastCheck === 0) {
					log.verbose(`Could not find metadata for artifact ` +
						`${logId} in local cache`);
				} else {
					log.verbose(`Refreshing metadata cache for artifact ` +
						`${logId} ` +
						// TODO better formatting of elapsed time
						`(last checked ${timeSinceLastCheck/1000} seconds ago)`);
				}

				const {lastUpdate, deploymentVersion} = await this._getRemoteArtifactMetadata(coordinates);

				// TODO better formatting of elapsed time
				log.verbose(`Retrieved metadata for artifact ${logId} is ` +
					`${(lastUpdate - localMetadata.lastUpdate) / 1000} seconds younger than local metadata`);
				log.verbose(`Retrieved deployment version is ${deploymentVersion}`);

				this._rotateDeploymentVersion(localMetadata, deploymentVersion);

				localMetadata.lastCheck = now;
				localMetadata.lastUpdate = lastUpdate;
				await this._writeLocalArtifactMetadata(id, localMetadata);
			}
			return localMetadata;
		});
	}

	async _getRemoteArtifactMetadata({groupId, artifactId, version, classifier, extension}) {
		const metadata = await this.getRegistry().requestMavenMetadata({groupId, artifactId, version});

		if (!metadata?.versioning?.snapshotVersions) {
			throw new Error(`Missing snapshot metadata for artifact ${groupId}:${artifactId}:${version}`);
		}

		const {snapshotVersion} = metadata.versioning.snapshotVersions;
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
			lastUpdate: ts.getTime(),
			deploymentVersion: deploymentMetadata.value
		};
	}

	async _getLocalArtifactMetadata(id) {
		try {
			return await this.readJson(path.join(this._metadataDir, `${id}.json`));
		} catch (err) {
			if (err.code === "ENOENT") { // "File or directory does not exist"
				return { // If not found, initialize metadata
					lastCheck: 0,
					lastUpdate: 0,
					deploymentVersion: null,
					staleVersions: []
				};
			} else {
				throw err;
			}
		}
	}

	async _writeLocalArtifactMetadata(id, content) {
		await mkdirp(this._metadataDir);
		return await this._writeJson(path.join(this._metadataDir, `${id}.json`), content);
	}

	_rotateDeploymentVersion(metadata, newDeploymentVersion) {
		if (metadata.deploymentVersion) {
			metadata.staleVersions.push(metadata.deploymentVersion);
			// TODO: Create mechanism to cleanup stale versions
		}
		metadata.deploymentVersion = newDeploymentVersion;
	}

	/*
		Downloads respective artifact and extracts the zip archive into a structure similar to
		the npm installer
	*/
	async installPackage({pkgName, groupId, artifactId, version, classifier, extension}) {
		// TODO: store, check and invalidate timestamp

		const metadata = await this._fetchArtifactMetadata({
			groupId, artifactId, version, classifier, extension
		});

		const {deploymentVersion} = metadata;

		const targetDir = this._getTargetDirForPackage(pkgName, deploymentVersion);
		const installed = await this._projectExists(targetDir);

		if (!installed) {
			const id = `package-${pkgName}-${deploymentVersion}`;
			await this._synchronize(id, async () => {
				const installed = await this._projectExists(targetDir);

				if (installed) {
					log.verbose(`Already installed: ${pkgName} in SNAPSHOT version ${deploymentVersion}`);
					return;
				}

				const {artifactPath} = await this.installArtifact({
					groupId, artifactId, version, classifier, extension, metadata
				});
				const stagingDir = this._getStagingDirForPackage(pkgName, deploymentVersion);

				// Check whether staging dir already exists and remove it
				if (await this._pathExists(stagingDir)) {
					log.verbose(`Removing existing staging directory at ${stagingDir}...`);
					await rimraf(stagingDir);
				}

				// Check whether target dir already exists and remove it
				if (await this._pathExists(targetDir)) {
					log.verbose(`Removing existing target directory at ${targetDir}...`);
					await rimraf(targetDir);
				}

				await mkdirp(stagingDir);

				log.verbose(`Extracting archive at ${artifactPath}...`);
				const zip = new StreamZip.async({file: artifactPath});
				let rootDir = null;
				if (extension === "jar") {
					rootDir = "META-INF";
				}
				await zip.extract(rootDir, stagingDir);
				await zip.close();

				// Do not create target dir itself to prevent EPERM error in following rename operation
				// (https://github.com/SAP/ui5-tooling/issues/487)
				await mkdirp(path.dirname(targetDir));
				log.verbose(`Promoting staging directory from ${stagingDir} to ${targetDir}...`);
				await rename(stagingDir, targetDir);
			});
		} else {
			log.verbose(`Already installed: ${pkgName} in SNAPSHOT version ${deploymentVersion}`);
		}
		return {
			pkgPath: targetDir
		};
	}

	// deploymentVersion is optional
	async installArtifact({groupId, artifactId, version, deploymentVersion, classifier, extension}) {
		if (!deploymentVersion) {
			const metadata = await this._fetchArtifactMetadata({
				groupId, artifactId, version, classifier, extension
			});
			deploymentVersion = metadata.deploymentVersion;
		}
		const targetPath = this._getTargetPathForArtifact(
			groupId, artifactId, deploymentVersion, classifier, extension);
		const installed = await this._pathExists(targetPath);
		const id = this._generateHashFromCoordinates({
			groupId, artifactId,
			version: deploymentVersion,
			classifier, extension
		});
		if (!installed) {
			await this._synchronize(`artifact-${id}`, async () => {
				// check again whether the artifact is now installed
				const installed = await this._pathExists(targetPath);
				if (installed) {
					log.verbose(`Already installed: ${artifactId} in version ${deploymentVersion}`);
					return;
				}

				const stagingPath = this._getStagingPathForArtifact(
					groupId, artifactId, deploymentVersion, classifier, extension);
				log.info(`Installing missing artifact ${id}...`);

				// Check whether staging dir already exists and remove it
				if (await this._pathExists(stagingPath)) {
					log.verbose(`Removing existing file in staging dir at ${stagingPath}...`);
					await rm(stagingPath);
				}
				await mkdirp(path.dirname(stagingPath));

				log.verbose(`Installing ${artifactId} in version ${version} to ${stagingPath}...`);

				// TODO: Stream response body to installPackage and unzip directly via
				// https://github.com/isaacs/minizlib (already in dependencies through pacote)
				// This way we do not store the archive unnecessarily
				await this.getRegistry().requestArtifact({
					groupId, artifactId, version, deploymentVersion, classifier, extension,
					targetPath: stagingPath
				});

				await mkdirp(path.dirname(targetPath));
				log.verbose(
					`Promoting artifact from staging path ${stagingPath} to target path at ${targetPath}...`);
				await rename(stagingPath, targetPath);
			});
		} else {
			log.verbose(`Already installed: ${artifactId} in version ${deploymentVersion}`);
		}
		return {
			artifactPath: targetPath
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

	async _synchronize(lockName, callback) {
		const {
			default: lockfile
		} = await import("lockfile");
		const lock = promisify(lockfile.lock);
		const unlock = promisify(lockfile.unlock);
		const lockPath = this._getLockPath(lockName);
		await mkdirp(this._lockDir);
		log.verbose("Locking " + lockPath);
		await lock(lockPath, {
			wait: 10000,
			stale: 60000,
			retries: 10
		});
		try {
			const res = await callback();
			return res;
		} finally {
			log.verbose("Unlocking " + lockPath);
			await unlock(lockPath);
		}
	}

	_getLockPath(lockName) {
		const sanitizedLockName = lockName.replace(/\//g, "-");
		return path.join(this._lockDir, `${sanitizedLockName}.lock`);
	}

	_getStagingPathForArtifact(groupId, artifactId, version, classifier, extension) {
		if (!classifier) {
			classifier = version;
			version = "";
		}
		return path.join(this._stagingDir,
			groupId.replaceAll(".", "_"), artifactId, version, `${classifier}.${extension}`);
	}

	_getTargetPathForArtifact(groupId, artifactId, version, classifier, extension) {
		if (!classifier) {
			classifier = version;
			version = "";
		}
		return path.join(this._artifactsDir,
			groupId.replaceAll(".", "_"), artifactId, version, `${classifier}.${extension}`);
	}

	_getStagingDirForPackage(pkgName, version) {
		return path.join(this._stagingDir, ...pkgName.split("/"), version);
	}

	_getTargetDirForPackage(pkgName, version) {
		return path.join(this._packagesDir, ...pkgName.split("/"), version);
	}

	// File system safe identifier for an artifact
	_generateHashFromCoordinates({groupId, artifactId, version, classifier, extension}) {
		// Using underscores instead of colons since colon is a reserved character for
		// filenames on Windows and macOS
		const optionalClassifier = classifier ? `${classifier}.` : "";
		return `${groupId}_${artifactId}_${version}_${optionalClassifier}${extension}`;
	}

	// Log representation for an artifact
	_generateLogIdFromCoordinates({groupId, artifactId, version, classifier, extension}) {
		const optionalClassifier = classifier ? `${classifier}.` : "";
		return `${groupId}:${artifactId}:${version}:${optionalClassifier}${extension}`;
	}
}

export default Installer;
