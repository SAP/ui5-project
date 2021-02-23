const Extension = require("../Extension");

class ProjectShim extends Extension {
	constructor(parameters) {
		super(parameters);
	}


	/* === Attributes === */
	/**
	* @public
	*/
	getDependencyShims() {
		return this._config.shims.dependencies;
	}

	/**
	* @public
	*/
	getConfigurationShims() {
		return this._config.shims.configurations;
	}

	/**
	* @public
	*/
	getCollectionShims() {
		return this._config.shims.collections;
	}

	/* === Internals === */
	/**
	 * @private
	 * @param {object} config Configuration object
	*/
	async _parseConfiguration(config) {
		await super._parseConfiguration(config);
	}

	async _validate() {
		await super._validate();
	}
}

module.exports = ProjectShim;
