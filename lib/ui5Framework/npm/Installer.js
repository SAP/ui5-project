const path = require("path");
const fs = require("graceful-fs");
const {promisify} = require("util");
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const Registry = require("./Registry");
const log = require("@ui5/logger").getLogger("normalizer:ui5Framework:npm:Installer");

class Installer {
	constructor({cwd, homedir}) {
		homedir = homedir || require("os").homedir();
		this._baseDir = path.join(homedir, ".ui5", "framework", "packages");
		log.verbose(`Installing to: ${this._baseDir}`);
		this._registry = new Registry({
			cwd,
			cacheDir: path.join(homedir, ".ui5", "framework", "cacache")
		});

		this._installedCounter = 0;
		this._cachedCounter = 0;
	}

	async fetchPackageManifest({pkgName, version}) {
		const targetDir = this._getTargetDirForPackage({pkgName, version});
		try {
			const pkg = JSON.parse(await readFile(path.join(targetDir, "package.json"), {encoding: "utf8"}));
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
		try {
			await stat(path.join(targetDir, "package.json"));
			log.verbose(`Alrady installed: ${pkgName} in version ${version}`);
			this._cachedCounter++;
		} catch (err) {
			if (err.code === "ENOENT") { // "File or directory does not exist"
				log.info(`Installing missing package ${pkgName}...`);
				log.verbose(`Installing ${pkgName} in version ${version} to ${targetDir}...`);
				await this._registry.extractPackage(pkgName, version, targetDir);
				this._installedCounter++;
			} else {
				throw err;
			}
		}
		return {
			pkgPath: targetDir
		};
	}

	_getTargetDirForPackage({pkgName, version}) {
		return path.join(this._baseDir, ...pkgName.split("/"), version);
	}
}

module.exports = Installer;
