import path from "node:path";
import os from "node:os";

/**
 * Provides basic configuration settings for the resolvers.
 * Reads/writes configuration from/to ~/.ui5rc
 *
 * @public
 * @class
 * @alias @ui5/project/config/Configuration
 */
export default class Configuration {
	#snapshotEndpointUrl;

	/**
	 * @param {object} configuration
	 * @param {string} [configuration.snapshotEndpointUrl]
	 */
	constructor({snapshotEndpointUrl}) {
		this.#snapshotEndpointUrl = snapshotEndpointUrl;
	}

	/**
	 * Maven Repository Snapshot URL.
	 * Used to download artifacts and packages from Maven's build-snapshots URL.
	 *
	 * @public
	 * @returns {string}
	 */
	getSnapshotEndpointUrl() {
		return this.#snapshotEndpointUrl;
	}

	/**
	 * @public
	 * @returns {object} The configuration in a JSON format
	 */
	toJSON() {
		return {
			snapshotEndpointUrl: this.#snapshotEndpointUrl,
		};
	}

	/**
	 * Create Configuration from JSON file
	 *
	 * @public
	 * @static
	 * @param {string} [filePath="~/.ui5rc"] Path to configuration JSON file
	 * @returns {Promise<@ui5/project/config/Configuration>} Configuration instance
	 */
	static async fromFile(filePath) {
		filePath = filePath || path.resolve(path.join(os.homedir(), ".ui5rc"));

		const {default: fs} = await import("graceful-fs");
		const {promisify} = await import("node:util");
		const readFile = promisify(fs.readFile);
		let config;
		try {
			const fileContent = await readFile(filePath);
			config = JSON.parse(fileContent);
		} catch (err) {
			if (err.code === "ENOENT") {
				// "File or directory does not exist"
				config = {};
			} else {
				throw err;
			}
		}
		return new Configuration(config);
	}

	/**
	 * Save Configuration to a JSON file
	 *
	 * @public
	 * @static
	 * @param {string} [filePath="~/.ui5rc"] Path to configuration JSON file
	 * @param {@ui5/project/config/Configuration} config Configuration to save
	 * @returns {Promise<void>}
	 */
	static async saveConfig(filePath, config) {
		filePath = filePath || path.resolve(path.join(os.homedir(), ".ui5rc"));

		const {default: fs} = await import("graceful-fs");
		const {promisify} = await import("node:util");
		const writeFile = promisify(fs.writeFile);

		return writeFile(filePath, JSON.stringify(config.toJSON()));
	}
}
