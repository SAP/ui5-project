import path from "node:path";
import Extension from "../../Extension.js";

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
	*/
	async _validateConfig() {
		// TODO: Move to validator
		if (/--\d+$/.test(this.getName())) {
			throw new Error(`Server middleware name must not end with '--<number>'`);
		}
		// TODO: Check that paths exist
	}
}

export default ServerMiddleware;
