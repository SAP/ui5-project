const path = require("path");
const AbstractResolver = require("./AbstractResolver");
const Installer = require("./npm/Installer");
const log = require("@ui5/logger").getLogger("normalizer:ui5Framework:Sapui5Resolver");

const DIST_PKG_NAME = "@sapui5/distribution-metadata";

class Sapui5Resolver extends AbstractResolver {
	constructor(parameters) {
		super(parameters);

		this._installer = new Installer({
			cwd: this._cwd,
			ui5HomeDir: this._ui5HomeDir
		});
		this._distMetadata = null;
	}
	async loadDistMetadata() {
		if (!this._loadDistMetadata) {
			this._loadDistMetadata = Promise.resolve().then(async () => {
				const version = this._version;
				log.verbose(`Installing ${DIST_PKG_NAME} in version ${version}...`);
				const pkgName = DIST_PKG_NAME;
				const {pkgPath} = await this._installer.installPackage({
					pkgName,
					version
				});

				this._distMetadata = require(path.join(pkgPath, "metadata.json"));
			});
		}
		return this._loadDistMetadata;
	}
	async handleLibrary(libraryName) {
		if (!this._distMetadata) {
			await this.loadDistMetadata();
		}

		const metadata = this._distMetadata.libraries[libraryName];
		if (!metadata) {
			throw new Error(`Could not find library "${libraryName}"`);
		}

		// Trigger installation of package
		log.verbose("Triggering installation of " + libraryName);
		const install = this._installer.installPackage({
			pkgName: metadata.npmPackageName,
			version: metadata.version
		});

		return {
			metadata: {
				id: metadata.npmPackageName,
				version: metadata.version,
				dependencies: metadata.dependencies,
				optionalDependencies: metadata.optionalDependencies
			},
			install
		};
	}
}

module.exports = Sapui5Resolver;
