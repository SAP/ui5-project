import path from "node:path";
import Extension from "../Extension.js";
import {pathToFileURL} from "node:url";
import {type SpecificationConfiguration} from "../Specification.js";
import type AbstractReaderWriter from "@ui5/fs/AbstractReaderWriter";
import type Logger from "@ui5/logger/Logger";

interface ServerMiddlewareConfiguration extends SpecificationConfiguration {
	middleware: {
		path: string;
	};
}

interface CustomMiddlewareParams {
	log: Logger;
	middlewareUtil: any;
	options: Record<string, unknown>;
	resources: {
		workspace: AbstractReaderWriter;
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExpressMiddleware = (req: any, res: any, next: any) => void;

type CustomMiddleware =
	({log, middlewareUtil, options, resources}: CustomMiddlewareParams) => Promise<ExpressMiddleware>;

/**
 * ServerMiddleware
 *
 * @hideconstructor
 */
class ServerMiddleware extends Extension<ServerMiddlewareConfiguration> {
	public async getMiddleware() {
		const middlewarePath = path.join(this.getRootPath(), this._config.middleware.path);
		const {default: middleware} = await import(pathToFileURL(middlewarePath)) as {default: CustomMiddleware};
		return middleware;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	protected async _validateConfig() {
		// TODO: Move to validator
		if (/--\d+$/.test(this.getName())) {
			throw new Error(`Server middleware name must not end with '--<number>'`);
		}
		// TODO: Check that paths exist
	}
}

export default ServerMiddleware;
