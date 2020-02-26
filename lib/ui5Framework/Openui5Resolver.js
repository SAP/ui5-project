const AbstractResolver = require("./AbstractResolver");
const Installer = require("./npm/Installer");

class Openui5Resolver extends AbstractResolver {
	constructor(parameters) {
		super(parameters);

		this._installer = new Installer({
			cwd: this._cwd,
			// homedir
		});
		this._loadLibraryMetadata = {};
	}
	static _getNpmPackageName(libraryName) {
		return "@openui5/" + libraryName;
	}
	static _getLibaryName(pkgName) {
		return pkgName.replace(/^@openui5\//, "");
	}
	async _getLibraryMetadata(libraryName) {
		if (!this._loadLibraryMetadata[libraryName]) {
			this._loadLibraryMetadata[libraryName] = Promise.resolve().then(async () => {
				// Trigger manifest request to gather transitive dependencies
				const pkgName = Openui5Resolver._getNpmPackageName(libraryName);
				const libraryManifest = await this._installer.fetchPackageManifest({pkgName});
				let dependencies = [];
				if (libraryManifest.dependencies) {
					const depNames = Object.keys(libraryManifest.dependencies);
					dependencies = depNames.map(Openui5Resolver._getLibaryName);
				}

				// npm devDependencies are handled as "optionalDependencies"
				// in terms of the UI5 framework metadata structure
				let optionalDependencies = [];
				if (libraryManifest.devDependencies) {
					const devDepNames = Object.keys(libraryManifest.devDependencies);
					optionalDependencies = devDepNames.map(Openui5Resolver._getLibaryName);
				}

				return {
					id: pkgName,
					version: this._version,
					dependencies,
					optionalDependencies
				};
			});
		}
		return this._loadLibraryMetadata[libraryName];
	}
	async handleLibrary(libraryName) {
		const pkgName = Openui5Resolver._getNpmPackageName(libraryName);

		// Trigger metadata request
		const pMetadata = this._getLibraryMetadata(libraryName);

		// Also trigger installation of package
		const install = this._installer.installPackage({
			pkgName,
			version: this._version
		});

		const libraryMetadata = await pMetadata;

		return {
			libraryMetadata,
			install
		};
	}
}

module.exports = Openui5Resolver;
