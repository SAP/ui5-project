import path from "node:path";
import Extension from "../Extension.js";
import {pathToFileURL} from "node:url";

/**
 * ServerMiddleware
 *
 * @alias @ui5/project/specifications/extensions/ServerMiddleware
 * @hideconstructor
 */
class ServerMiddleware extends Extension {
	constructor(parameters) {
		super(parameters);
	}

	public async getMiddleware() {
		const middlewarePath = path.join(this.getRootPath(), this._config.middleware.path);
		const {default: middleware} = await import(pathToFileURL(middlewarePath));
		return middleware;
	}

	private async _validateConfig() {
		// TODO: Move to validator
		if (/--\d+$/.test(this.getName())) {
			throw new Error(`Server middleware name must not end with '--<number>'`);
		}
		// TODO: Check that paths exist
	}
}

export default ServerMiddleware;
