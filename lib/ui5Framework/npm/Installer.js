const path = require("path");
const fs = require("graceful-fs");
const {promisify} = require("util");
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const open = promisify(fs.open);
const close = promisify(fs.close);
const unlink = promisify(fs.unlink);
const lockfile = require("lockfile");
const lock = promisify(lockfile.lock);
const unlock = promisify(lockfile.unlock);
const mkdirp = require("mkdirp");
const Registry = require("./Registry");
const log = require("@ui5/logger").getLogger("normalizer:ui5Framework:npm:Installer");

class Installer {
	constructor({cwd, ui5HomeDir}) {
		if (!cwd) {
			throw new Error(`Installer: Missing parameter "cwd"`);
		}
		if (!ui5HomeDir) {
			throw new Error(`Installer: Missing parameter "ui5HomeDir"`);
		}
		this._baseDir = path.join(ui5HomeDir, "framework", "packages");
		log.verbose(`Installing to: ${this._baseDir}`);
		this._registry = new Registry({
			cwd,
			cacheDir: path.join(ui5HomeDir, "framework", "cacache")
		});
		this._lockDir = path.join(ui5HomeDir, "framework", "locks");
		this._installProgressDir = path.join(ui5HomeDir, "framework", "install-progress");
	}

	async readJson(jsonPath) {
		return JSON.parse(await readFile(jsonPath, {encoding: "utf8"}));
	}

	async fetchPackageVersions({pkgName}) {
		const packument = await this._registry.requestPackagePackument(pkgName);
		return Object.keys(packument.versions);
	}

	async fetchPackageManifest({pkgName, version}) {
		const targetDir = this._getTargetDirForPackage({pkgName, version});
		try {
			const pkg = await this.readJson(path.join(targetDir, "package.json"));
			return {
				name: pkg.name,
				dependencies: pkg.dependencies,
				devDependencies: pkg.devDependencies
			};
		} catch (err) {
			if (err.code === "ENOENT") { // "File or directory does not exist"
				const manifest = await this._registry.requestPackageManifest(pkgName, version);
				return {
					name: manifest.name,
					dependencies: manifest.dependencies,
					devDependencies: manifest.devDependencies
				};
			} else {
				throw err;
			}
		}
	}

	async installPackage({pkgName, version}) {
		const targetDir = this._getTargetDirForPackage({pkgName, version});
		const [installed, installInProgress] = await Promise.all([
			this._packageJsonExists(targetDir),
			this._isInstallInProgress({pkgName, version})
		]);
		if (!installed || installInProgress) {
			// Package is either not installed or installation is still in progress
			await this._synchronize({pkgName, version}, async () => {
				const installInProgress = await this._isInstallInProgress({pkgName, version});
				if (installInProgress) {
					// Package install is marked as "in progress" but no lock is set
					// This might indicate an incomplete or corrupted install
					// => Remove the directory and reinstall

					log.verbose(
						`Detected a potentially incomplete installation of package ${pkgName} in version ${version}. ` +
						`Attempting to remove and reinstall it...`);
					const rimraf = promisify(require("rimraf"));
					log.verbose(
						`Removing package ${pkgName} in version ${version} at ${targetDir}...`);
					await rimraf(targetDir);
				}

				// check again whether package is now installed
				const installed = await this._packageJsonExists(targetDir);
				if (!installed) {
					log.info(`Installing missing package ${pkgName}...`);
					await this._markInstallInProgress({pkgName, version}, async () => {
						log.verbose(`Installing ${pkgName} in version ${version} to ${targetDir}...`);
						await this._registry.extractPackage(pkgName, version, targetDir);
					});
				} else {
					log.verbose(`Alrady installed: ${pkgName} in version ${version}`);
				}
			});
		} else {
			log.verbose(`Alrady installed: ${pkgName} in version ${version}`);
		}
		return {
			pkgPath: targetDir
		};
	}

	async _packageJsonExists(targetDir) {
		try {
			await stat(path.join(targetDir, "package.json"));
			return true;
		} catch (err) {
			if (err.code === "ENOENT") { // "File or directory does not exist"
				return false;
			} else {
				throw err;
			}
		}
	}

	async _synchronize({pkgName, version}, callback) {
		const lockPath = this._getLockPath({pkgName, version});
		await mkdirp(this._lockDir);
		log.verbose("Locking " + lockPath);
		await lock(lockPath, {
			wait: 10000,
			stale: 60000,
			retries: 10
		});
		try {
			await callback();
		} finally {
			log.verbose("Unlocking " + lockPath);
			await unlock(lockPath);
		}
	}

	_getLockPath({pkgName, version}) {
		const lockName = pkgName.replace(/\//g, "-");
		return path.join(this._lockDir, `package-${lockName}@${version}.lock`);
	}


	async _markInstallInProgress({pkgName, version}, callback) {
		const markerPath = this._getInstallProgressMarkerPath({pkgName, version});
		await mkdirp(this._installProgressDir);

		log.verbose(`Creating install-in-progress marker at ${markerPath}...`);
		const fd = await open(markerPath, "w");
		await close(fd);

		try {
			await callback();
		} catch (err) {
			log.verbose(
				`Installation of package ${pkgName}@${version} failed. ` +
				`install-in-progress marker will not be removed.`);
			throw err;
		}
		log.verbose(`Removing install-in-progress marker at ${markerPath}...`);
		await unlink(markerPath);
	}

	async _isInstallInProgress({pkgName, version}) {
		try {
			const markerPath = this._getInstallProgressMarkerPath({pkgName, version});
			await stat(markerPath);
			return true;
		} catch (err) {
			if (err.code === "ENOENT") { // "File or directory does not exist"
				return false;
			} else {
				throw err;
			}
		}
	}

	_getInstallProgressMarkerPath({pkgName, version}) {
		const name = pkgName.replace(/\//g, "-");
		return path.join(this._installProgressDir, `package-${name}@${version}.install-in-progress`);
	}

	_getTargetDirForPackage({pkgName, version}) {
		return path.join(this._baseDir, ...pkgName.split("/"), version);
	}
}

module.exports = Installer;
