import path from "node:path";
import os from "node:os";

/**
 *
 *
 * @public
 * @class
 * @alias @ui5/project/config/Configuration
 */
class Configuration {
	/**
	 * @param {object} configuration
	 * @param {string} [configuration.baseDir="~/.ui5/"]
	 * @param {string} [configuration.frameworkDir="~/${baseDir}/framework"]
	 *   Directory to store framework artifacts and metadata in.
	 * @param {string} [configuration.buildCacheDir="~/${baseDir}/build-cache"]
	 *   Directory to store build-cache in.
	 */
	constructor({baseDir, frameworkDir, buildCacheDir}) {
		this._baseDir = baseDir ? path.resolve(baseDir) : path.join(os.homedir(), ".ui5");
		this._frameworkDir = frameworkDir ? path.resolve(frameworkDir) : path.join(this._baseDir, "framework");
		this._buildCacheDir = buildCacheDir ? path.resolve(buildCacheDir) : path.join(this._baseDir, "build-cache");
	}

	getFrameworkDir() {
		return this._frameworkDir;
	}

	getCacheDir() {
		return this._buildCacheDir;
	}
}

export default Configuration;

/**
 * Create Configuration from JSON file
 *
 * @public
 * @static
 * @param {string} [filePath="~/.ui5rc"] Path to configuration JSON file
 * @returns {@ui5/project/config/Configuration} Configuration instance
 */
export async function fromFile(filePath) {
	filePath = filePath || path.join(os.homedir(), ".ui5rc");

	const {default: fs} = await import("graceful-fs");
	const {promisify} = await import("node:util");
	const readFile = promisify(fs.readFile);
	let config;
	try {
		const fileContent = await readFile(filePath);
		config = JSON.parse(fileContent);
	} catch (err) {
		if (err.code === "ENOENT") { // "File or directory does not exist"
			config = {};
		} else {
			throw err;
		}
	}
	return new Configuration(config);
}

