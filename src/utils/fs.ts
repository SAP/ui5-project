import fs from "graceful-fs";
import {promisify} from "node:util";
const mkdir = promisify(fs.mkdir);

/**
 *
 * @param dirPath
 */
export async function mkdirp(dirPath) {
	return mkdir(dirPath, {recursive: true});
}
