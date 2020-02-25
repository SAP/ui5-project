const AbstractResolver = require("./AbstractResolver");
const Installer = require("./npm/Installer");

class Openui5Resolver extends AbstractResolver {
	constructor(parameters) {
		super(parameters);
		// TODO: pass parameters.cwd to installer and registry
		this._installer = new Installer();
	}
	static _getNpmPackageName(libraryName) {
		return "@openui5/" + libraryName;
	}
	_getLibaryName(pkgName) {
		return pkgName.replace(/^@openui5\//, "");
	}
	async _getLibraryMetadata(libraryName) {
		if (!this.metadata) {
			this.metadata = {libraries: {}};
		}
		if (!this.metadata.libraries[libraryName]) {
			// Trigger manifest request to gather transitive dependencies
			const pkgName = Openui5Resolver._getNpmPackageName(libraryName);
			const libraryManifest = await this._installer._fetchPackageManifest({pkgName});
			let dependencies = [];
			if (libraryManifest.dependencies) {
				dependencies = Object.keys(libraryManifest.dependencies).map(this._getLibaryName);
			}

			// npm devDependencies are handled as "optionalDependencies"
			// in terms of the UI5 framework metadata structure
			let optionalDependencies = [];
			if (libraryManifest.devDependencies) {
				optionalDependencies = Object.keys(libraryManifest.devDependencies).map(this._getLibaryName);
			}

			// Add metadata entry
			this.metadata.libraries[libraryName] = {
				npmPackageName: pkgName,
				version: this._version,
				dependencies,
				optionalDependencies
			};
		}
		return this.metadata.libraries[libraryName];
	}
	async handleLibrary(libraryName) {
		const pkgName = Openui5Resolver._getNpmPackageName(libraryName);

		// Trigger metadata request
		const pMetadata = this._getLibraryMetadata(libraryName);

		// Also trigger installation of package
		const install = this._installer._installPackage({
			pkgName,
			version: this._version
		});

		const libraryMetadata = await pMetadata;

		return {libraryMetadata, install};
	}
}

module.exports = Openui5Resolver;
