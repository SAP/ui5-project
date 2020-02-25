const log = require("@ui5/logger").getLogger("normalizer:ui5Framework:npm:Registry");

class Registry {
	constructor({cacheDir}) {
		this._pacote = require("pacote");
		this._cacheDir = cacheDir;
	}
	requestPackageManifest(pkgName, version) {
		return this._pacote.manifest(`${pkgName}@${version}`, this._getPacoteOptions());
	}
	extractPackage(pkgName, version, targetDir) {
		return this._pacote.extract(`${pkgName}@${version}`, targetDir, this._getPacoteOptions());
	}
	_getPacoteOptions() {
		if (!this._npmConfig) {
			const libnpmconfig = require("libnpmconfig");
			const config = libnpmconfig.read({
				log: log.isLevelEnabled("verbose") ? log._getLogger() : undefined,
				cache: this._cacheDir
			}, {
				cwd: this._cwd
			});

			log.verbose(`Using npm configuration (extract):`);
			// Do not log full configuration as it may contain authentication tokens
			log.verbose(`   registry: ${config["registry"]}`);
			log.verbose(`   cache: ${config["cache"]}`);
			log.verbose(`   proxy: ${config["proxy"]}`);

			this._npmConfig = config;
		}

		// Use cached config
		return this._npmConfig;
	}
}

module.exports = Registry;
