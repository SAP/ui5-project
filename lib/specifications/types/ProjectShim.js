const Extension = require("../Extension");

class ProjectShim extends Extension {
	constructor(parameters) {
		super(parameters);
	}


	/* === Attributes === */
	/**
	* @public
	*/
	getShimConfiguration() {
		return this._config.shims;
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
