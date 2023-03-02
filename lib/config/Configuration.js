import path from "node:path";
import os from "node:os";

/**
 * @public
 * @typedef @ui5/project/config/Configuration~cacheMode
 * @property {string} "default" Cache everything, invalidate after 9 hours
 * @property {string} "off" Do not cache
 * @property {string} "force" Use cache only - no requests
 * @property {string} "relaxed" Try to refresh, but fallback to cache if refresh fails for up to one week
 */

/**
 *
 *
 * @public
 * @class
 * @alias @ui5/project/config/Configuration
 */
export class Configuration {
	#cwd;
	#sources;
	#version;
	#cacheMode;
	#ui5HomeDir;
	#snapshotEndpointUrl;
	#frameworkDir;
	#artifactsDir;
	#packagesDir;
	#metadataDir;
	#stagingDir;
	#lockDir;
	#cacheDir;

	/**
	 * @param {object} configuration
	 * @param {string} [configuration.cwd="./"]
	 * @param {string} [configuration.version=""]
	 * @param {string} [configuration.sources=false]
	 * @param {string} [configuration.ui5HomeDir="~/.ui5/"]
	 * @param {string} [configuration.snapshotEndpointUrl=""]
	 * @param {@ui5/project/config/Configuration~cacheMode} [configuration.cacheMode="default"]
	 * @param {string} [configuration.frameworkDir="~/${ui5HomeDir}/framework"]
	 *   Directory to store framework artifacts and metadata in.
	 * @param {string} [configuration.cacheDir="~/${ui5HomeDir}/cacache"]
	 * @param {string} [configuration.artifactsDir="~/${ui5HomeDir}/artifacts"]
	 * @param {string} [configuration.packagesDir="~/${ui5HomeDir}/packages"]
	 * @param {string} [configuration.metadataDir="~/${ui5HomeDir}/metadata"]
	 * @param {string} [configuration.stagingDir="~/${ui5HomeDir}/staging"]
	 * @param {string} [configuration.lockDir="~/${ui5HomeDir}/locks"]
	 */
	constructor({
		cwd,
		version,
		sources,
		ui5HomeDir,
		snapshotEndpointUrl,
		cacheMode = "default",
		frameworkDir,
		cacheDir,
		artifactsDir,
		packagesDir,
		metadataDir,
		stagingDir,
		lockDir
	}) {
		this.#cwd = cwd ? path.resolve(cwd) : process.cwd();
		this.#sources = !!sources;
		this.#version = version;
		this.#cacheMode = cacheMode;
		this.#ui5HomeDir = ui5HomeDir ? path.resolve(ui5HomeDir) : path.join(os.homedir(), ".ui5");

		this.#snapshotEndpointUrl = process.env.UI5_MAVEN_SNAPSHOT_ENDPOINT || snapshotEndpointUrl;
		this.#frameworkDir = frameworkDir ? path.resolve(frameworkDir) : path.join(this.#ui5HomeDir, "framework");
		this.#artifactsDir = artifactsDir ?
			path.resolve(artifactsDir) : path.join(this.#frameworkDir, "artifacts");
		this.#packagesDir = packagesDir ?
			path.resolve(packagesDir) : path.join(this.#frameworkDir, "packages");
		this.#metadataDir = metadataDir ?
			path.resolve(metadataDir) : path.join(this.#frameworkDir, "metadata");
		this.#stagingDir = stagingDir ? path.resolve(stagingDir) : path.join(this.#frameworkDir, "staging");
		this.#lockDir = lockDir ? path.resolve(lockDir) : path.join(this.#frameworkDir, "locks");
		this.#cacheDir = cacheDir ? path.resolve(cacheDir) : path.join(this.#frameworkDir, "cacache");
	}

	/**
	 * CWD path
	 *
	 * @public
	 * @returns {string}
	 */
	getCwd() {
		return this.#cwd;
	}

	/**
	 * Prebuild or source files
	 *
	 * TODO: Private for now until we decide on how to handle this properly
	 *
	 * @private
	 * @returns {boolean}
	 */
	getSources() {
		return this.#sources;
	}

	/**
	 * UI5 Version
	 *
	 * @public
	 * @returns {string}
	 */
	getVersion() {
		return this.#version;
	}

	/**
	 * Cache mode
	 *
	 * @public
	 * @returns {string}
	 */
	getCacheMode() {
		return this.#cacheMode;
	}

	/**
	 * .ui5 home direcotry
	 *
	 * @public
	 * @returns {string}
	 */
	getUi5HomeDir() {
		return this.#ui5HomeDir;
	}

	/**
	 * SNAPSHOTs URL
	 *
	 * @public
	 * @returns {string}
	 */
	getSnapshotEndpointUrl() {
		return this.#snapshotEndpointUrl;
	}

	/**
	 * Directory to store framework artifacts and metadata in.
	 *
	 * @public
	 * @returns {string}
	 */
	getFrameworkDir() {
		return this.#frameworkDir;
	}

	/**
	 * Directory to store artifacts in.
	 *
	 * @public
	 * @returns {string}
	 */
	getArtifactsDir() {
		return this.#artifactsDir;
	}

	/**
	 * Directory to packages in
	 *
	 * @public
	 * @returns {string}
	 */
	getPackagesDir() {
		return this.#packagesDir;
	}

	/**
	 * Directory to store metadata in
	 *
	 * @public
	 * @returns {string}
	 */
	getMetadataDir() {
		return this.#metadataDir;
	}

	/**
	 * Directory to store staging artifacts in
	 *
	 * @public
	 * @returns {string}
	 */
	getStagingDir() {
		return this.#stagingDir;
	}

	/**
	 * Lockfiles directory
	 *
	 * @public
	 * @returns {string}
	 */
	getLockDir() {
		return this.#lockDir;
	}

	/**
	 * Cache directory
	 *
	 * @public
	 * @returns {string}
	 */
	getCacheDir() {
		return this.#cacheDir;
	}

	/**
	 * @public
	 * @returns {object} The configuration in a JSON format
	 */
	toJSON() {
		return {
			cwd: this.#cwd,
			sources: this.#sources,
			version: this.#version,
			cacheMode: this.#cacheMode,
			ui5HomeDir: this.#ui5HomeDir,
			snapshotEndpointUrl: this.#snapshotEndpointUrl,
			frameworkDir: this.#frameworkDir,
			artifactsDir: this.#artifactsDir,
			packagesDir: this.#packagesDir,
			metadataDir: this.#metadataDir,
			stagingDir: this.#stagingDir,
			lockDir: this.#lockDir,
			cacheDir: this.#cacheDir,
		};
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

/**
 * Save Configuration to a JSON file
 *
 * @public
 * @static
 * @param {string} [filePath="~/.ui5rc"] Path to configuration JSON file
 * @param {@ui5/project/config/Configuration} config Configuration to save
 */
export async function saveConfig(filePath, config) {
	filePath = filePath || path.join(os.homedir(), ".ui5rc");

	const {default: fs} = await import("graceful-fs");
	const {promisify} = await import("node:util");
	const writeFile = promisify(fs.writeFile);

	return writeFile(filePath, JSON.stringify(config.toJSON()));
}


export async function resolveSnapshotEndpointUrl(settingsXML, skipConfirmation) {
	let ok = true;
	if (!skipConfirmation) {
		const {default: yesno} = await import("yesno");
		ok = await yesno({
			question:
				"SnapshotURL is missing. " +
				"Do you want to try to resolve it from ~/.m2/settings.xml? (yes)",
			defaultValue: true,
		});
	}

	settingsXML = settingsXML || path.join(os.homedir(), ".m2", "settings.xml");
	const {default: fs} = await import("graceful-fs");
	const {promisify} = await import("node:util");
	const readFile = promisify(fs.readFile);
	const xml2js = await import("xml2js");
	const parser = new xml2js.Parser({
		// explicitChildren: true,
		preserveChildrenOrder: true,
		xmlns: true
	});
	let xmlContents;

	try {
		const fileContent = await readFile(settingsXML);
		xmlContents = await parser.parseStringPromise(fileContent);
	} catch (err) {
		if (err.code === "ENOENT") { // "File or directory does not exist"
			xmlContents = null;
		} else {
			throw err;
		}
	}

	if (!ok || !xmlContents) {
		throw new Error("SnapshotURL not resolved");
	}

	return xmlContents?.settings?.profiles[0]?.profile
		.filter((prof)=> prof.id[0]._ === "snapshot.build")[0]
		.pluginRepositories[0].pluginRepository[0].url[0]._;
}
