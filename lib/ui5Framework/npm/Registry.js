import {getLogger} from "@ui5/logger";
const log = getLogger("ui5Framework:npm:Registry");

function logConfig(config, configName) {
	const configValue = config[configName];
	if (configValue) {
		log.verbose(`   ${configName}: ${configValue}`);
	}
}

class Registry {
	constructor({cwd, cacheDir}) {
		if (!cwd) {
			throw new Error(`Registry: Missing parameter "cwd"`);
		}
		if (!cacheDir) {
			throw new Error(`Registry: Missing parameter "cacheDir"`);
		}
		this._cwd = cwd;
		this._cacheDir = cacheDir;
	}
	async requestPackagePackument(pkgName) {
		const {pacote, pacoteOptions} = await this._getPacote();
		return pacote.packument(pkgName, pacoteOptions);
	}
	async requestPackageManifest(pkgName, version) {
		const {pacote, pacoteOptions} = await this._getPacote();
		// TODO: Pacote#manifest essentially installs and unpacks a package
		// (https://github.com/npm/pacote/blob/b0c286cc44b1558f6c41c4c64e4930cff9bfbbf5/lib/file.js#L27-L29)
		// So we could to this ourselves via #extractPackage maybe save some time?
		return pacote.manifest(`${pkgName}@${version}`, pacoteOptions);
	}
	async extractPackage(pkgName, version, targetDir) {
		const {pacote, pacoteOptions} = await this._getPacote();
		try {
			await pacote.extract(`${pkgName}@${version}`, targetDir, pacoteOptions);
		} catch (err) {
			throw new Error(`Failed to extract package ${pkgName}@${version}: ${err.message}`);
		}
	}
	async _getPacote() {
		return {
			pacote: (await import("pacote")).default,
			pacoteOptions: await this._getPacoteOptions()
		};
	}
	async _getPacoteOptions() {
		if (!this._npmConfig) {
			const {default: libnpmconfig} = await import("libnpmconfig");
			const opts = {
				cache: this._cacheDir
			};
			const config = libnpmconfig.read(opts, {
				cwd: this._cwd
			}).toJSON();

			log.verbose(`Using npm configuration (extract):`);
			// Do not log full configuration as it may contain authentication tokens
			logConfig(config, "registry");
			logConfig(config, "@sapui5:registry");
			logConfig(config, "@openui5:registry");
			logConfig(config, "proxy");
			logConfig(config, "globalconfig");
			logConfig(config, "userconfig");
			logConfig(config, "cache");
			logConfig(config, "cwd");

			this._npmConfig = config;
		}

		// Use cached config
		return this._npmConfig;
	}
}

export default Registry;
