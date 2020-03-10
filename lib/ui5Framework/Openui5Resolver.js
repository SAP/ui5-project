const AbstractResolver = require("./AbstractResolver");
const Installer = require("./npm/Installer");

/**
 * Resolver for the OpenUI5 framework
 *
 * @public
 * @memberof module:@ui5/project.ui5Framework
 * @extends  module:@ui5/project.ui5Framework.AbstractResolver
 */
class Openui5Resolver extends AbstractResolver {
	/**
	 * @param {*} options options
	 * @param {string} options.version version
	 * @param {string} [options.cwd=process.cwd()] cwd
	 * @param {string} [options.ui5HomeDir=os.homedir()] UI5 home dir
	 */
	constructor(options) {
		super(options);

		this._installer = new Installer({
			cwd: this._cwd,
			ui5HomeDir: this._ui5HomeDir
		});
		this._loadLibraryMetadata = {};
	}
	static _getNpmPackageName(libraryName) {
		return "@openui5/" + libraryName;
	}
	static _getLibaryName(pkgName) {
		return pkgName.replace(/^@openui5\//, "");
	}
	_getLibraryMetadata(libraryName) {
		if (!this._loadLibraryMetadata[libraryName]) {
			this._loadLibraryMetadata[libraryName] = Promise.resolve().then(async () => {
				// Trigger manifest request to gather transitive dependencies
				const pkgName = Openui5Resolver._getNpmPackageName(libraryName);
				const libraryManifest = await this._installer.fetchPackageManifest({pkgName, version: this._version});
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
		return {
			// Trigger metadata request
			metadata: this._getLibraryMetadata(libraryName),
			// Also trigger installation of package
			install: this._installer.installPackage({
				pkgName,
				version: this._version
			})
		};
	}
}

module.exports = Openui5Resolver;
