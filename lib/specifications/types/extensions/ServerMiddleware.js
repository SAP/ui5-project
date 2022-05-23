const path = require("path");
const Extension = require("../../Extension");

class ServerMiddleware extends Extension {
	constructor(parameters) {
		super(parameters);
	}

	/* === Attributes === */
	/**
	* @public
	*/
	getMiddleware() {
		const middlewarePath = path.join(this.getPath(), this._config.middleware.path);
		return require(middlewarePath);
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

module.exports = ServerMiddleware;
