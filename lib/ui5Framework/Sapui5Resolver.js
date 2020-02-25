const path = require("path");
const AbstractResolver = require("./AbstractResolver");
const Installer = require("./npm/Installer");
const log = require("@ui5/logger").getLogger("normalizer:ui5Framework:Sapui5Resolver");

const DIST_PKG_NAME = "@sapui5/distribution-metadata";

class Sapui5Resolver extends AbstractResolver {
	constructor(parameters) {
		super(parameters);
		// TODO: pass parameters.cwd to installer and registry
		this._installer = new Installer();
	}
	async loadDistMetadata() {
		if (!this._loadDistMetadata) {
			this._loadDistMetadata = Promise.resolve().then(async () => {
				const version = this._version;
				log.verbose(`Using dist package in version ${version}...`);
				const pkgName = DIST_PKG_NAME;
				const {pkgPath} = await this._installer.installPackage({
					pkgName,
					version
				});

				this.metadata = require(path.join(pkgPath, "metadata.json"));
			});
		}
		return this._loadDistMetadata;
	}
	async handleLibrary(libraryName) {
		if (!this.metadata) {
			await this.loadDistMetadata();
		}

		const libraryMetadata = this.metadata.libraries[libraryName];

		// Trigger installation of package
		const install = this._installer.installPackage({
			pkgName: libraryMetadata.npmPackageName,
			version: libraryMetadata.version
		});

		return {libraryMetadata, install};
	}
}

module.exports = Sapui5Resolver;
