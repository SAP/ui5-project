const fsPath = require("path");
const resourceFactory = require("@ui5/fs").resourceFactory;
const Library = require("./Library");

/**
 * Legacy UI5 library with resources outside its namespace
 */
class LegacyLibrary extends Library {
	constructor(parameters) {
		super(parameters);
	}

	/* === Attributes === */

	/* === Resource Access === */
	/*
	 *
	 * Get a resource reader for the sources of the project (excluding any test resources)
	 * In the future the path structure can be flat or namespaced depending on the project
	 *
	 * @public
	 * @returns {module:@ui5/fs.ReaderCollection} Reader collection
	*/
	_getSourceReader() {
		return resourceFactory.createReader({
			fsBasePath: fsPath.join(this.getPath(), this._srcPath),
			virBasePath: "/",
			name: `Source reader for library project ${this.getName()}`,
			project: this
		});
	}

	_getFlatSourceReader(virBasePath = "/") {
		return resourceFactory.createReader({
			fsBasePath: fsPath.join(this.getPath(), this._srcPath),
			virBasePath: this._stripNamespace(virBasePath),
			name: `Source reader for library project ${this.getName()}`,
			project: this
		});
	}

	_getFlatTestReader(virBasePath = "/") {
		if (!this._testPathExists) {
			return null;
		}
		const testReader = resourceFactory.createReader({
			fsBasePath: fsPath.join(this.getPath(), this._testPath),
			virBasePath: this._stripNamespace(virBasePath),
			name: `Runtime test-resources reader for library project ${this.getName()}`,
			project: this
		});
		return testReader;
	}

	/**
	 * Legacy libraries have resources outside their namespace or multiple namespaces
	 * Therefore it is necessary to remove the namespace form any virtual base paths
	 *
	 * @param {string} string Virtual base path to remove an eventual namespace from
	 */
	_stripNamespace(string) {
		return string.replace(this._namespace + "/", "");
	}
}

module.exports = LegacyLibrary;
