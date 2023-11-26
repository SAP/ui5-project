import {Buffer} from "node:buffer";
import Resource from "@ui5/fs/Resource";
import {createResource} from "@ui5/fs/resourceFactory";
import fsInterface from "@ui5/fs/fsInterface";

/**
 * Casts @ui5/fs/Resource-s into an Uint8Array transferable object
 *
 * @param {@ui5/fs/Resource[]} resourceCollection
 * @returns {Promise<object[]>}
 */
export async function serializeResources(resourceCollection) {
	return Promise.all(
		resourceCollection.map(async (res) => ({
			buffer: await res.getBuffer(),
			path: res.getPath()
		}))
	);
}

/**
 * Casts Uint8Array into @ui5/fs/Resource-s transferable object
 *
 * @param {Promise<object[]>} resources
 * @returns {@ui5/fs/Resource[]}
 */
export function deserializeResources(resources) {
	return resources.map((res) => {
		// res.buffer is an Uint8Array object and needs to be cast
		// to a Buffer in order to be read correctly.
		return createResource({path: res.path, buffer: Buffer.from(res.buffer)});
	});
}

function isPojo(obj) {
	const proto = Object.prototype;
	const gpo = Object.getPrototypeOf;

	if (obj === null || typeof obj !== "object") {
		return false;
	}
	return gpo(obj) === proto;
}

function isFsResourceLikeTransfer(input) {
	return isPojo(input) &&
		input["buffer"] && (Buffer.isBuffer(input.buffer) || ArrayBuffer.isView(input.buffer)) &&
		input["path"] && typeof input["path"] === "string";
}

export async function serializeData(input) {
	if (Array.isArray(input) || isPojo(input)) {
		for (const prop in input) {
			if (Object.hasOwn(input, prop)) {
				input[prop] = await serializeData(input[prop]);
			}
		}
	} else if (input instanceof Resource) {
		return (await serializeResources([input]))[0];
	}

	return input;
}

export async function deserializeData(input) {
	// Resource like transferrable object that could be converted to a @ui5/fs/Resource
	if (isFsResourceLikeTransfer(input)) {
		return (await deserializeResources([input]))[0];
	} else if (Array.isArray(input) || isPojo(input)) {
		for (const prop in input) {
			if (Object.hasOwn(input, prop)) {
				input[prop] = await deserializeData(input[prop]);
			}
		}
	}

	return input;
}

class AbstractMain {
	#comPorts = new Set();
	#reader = null;
	#fs = null;
	#cache = Object.create(null);

	/**
	 * Constructor
	 *
	 * @param {object} reader
	 */
	constructor(reader) {
		if (!reader) {
			throw new Error("reader is mandatory argument");
		}

		this.#reader = reader;
		this.#fs = fsInterface(reader);
	}

	getFs() {
		return this.#fs;
	}

	getReader() {
		return this.#reader;
	}

	/**
	 * Adds MessagePort and starts listening for requests on it.
	 *
	 * @param {MessagePort} comPort port1 from a {code}MessageChannel{/code}
	 */
	startCommunication(comPort) {
		if (!comPort) {
			throw new Error("Communication channel is mandatory argument");
		}

		this.#comPorts.add(comPort);
		comPort.on("message", (e) => this.#onMessage(e, comPort));
		comPort.on("close", () => comPort.close());
	}

	/**
	 * Ends MessagePort communication.
	 *
	 * @param {MessagePort} comPort port1 to remove from handling.
	 */
	endCommunication(comPort) {
		comPort.close();
		this.#comPorts.delete(comPort);
	}

	/**
	 * Destroys the FsMainThreadInterface
	 */
	cleanup() {
		this.#comPorts.forEach((comPort) => comPort.close());
		this.#cache = null;
		this.#reader = null;
	}

	/**
	 * Handles messages from the MessagePort
	 *
	 * @param {object} e data to construct the request
	 * @param {string} e.action Action to perform. Corresponds to the names of
	 * 	the public methods of "@ui5/fs/fsInterface"
	 * @param {string} e.fsPath Path of the Resource
	 * @param {object} e.options Options for "readFile" action
	 * @param {MessagePort} comPort The communication channel
	 */
	async #onMessage(e, comPort) {
		const {action, args, key: cacheKey} = e;

		if (!this._cache[cacheKey]) {
			this._cache[cacheKey] = this.get(action, args);
		}

		const fromCache = await this._cache[cacheKey];
		comPort.postMessage({action, key: cacheKey, ...fromCache});
	}

	get(method) {
		throw new Error(`${method} method's handler has to be implemented`);
	}
}

class AbstractThread {
	#comPort = null;
	#callbacks = [];
	#cache = Object.create(null);

	/**
	 * Constructor
	 *
	 * @param {MessagePort} comPort Communication port
	 */
	constructor(comPort) {
		if (!comPort) {
			throw new Error("Communication port is mandatory argument");
		}

		this.#comPort = comPort;
		comPort.on("message", this.#onMessage.bind(this));
		comPort.on("close", this.#onClose.bind(this));
	}

	/**
	 * Handles messages from MessagePort
	 *
	 * @param {object} e
	 * @param {string} e.action Action to perform. Corresponds to the names of
	 * 	the public methods of "@ui5/fs/fsInterface"
	 * @param {string} e.fsPath Path of the Resource
	 * @param {*} e.result Response from the "action".
	 * @param {object} e.error Error from the "action".
	 */
	#onMessage(e) {
		const cbObject = this.#callbacks.find((cb) => cb.key === e.key);

		if (cbObject) {
			this.#cache[e.key] = {
				error: e.error,
				result: e.result,
			};
			this.#callbacks.splice(this.#callbacks.indexOf(cbObject), 1);
			cbObject.callback(e.error, e.result);
		} else {
			throw new Error(
				"No callback found for this message! Possible hang for the thread!",
				e
			);
		}
	}

	/**
	 * End communication
	 */
	#onClose() {
		this.#comPort.close();
		this.#cache = null;
	}

	/**
	 * Makes a request via the MessagePort
	 *
	 * @param {object} parameters
	 * @param {string} parameters.action Action to perform. Corresponds to the names of
	 * 	the public methods.
	 * @param {string} parameters.key
	 * @param {object} parameters.args
	 * @param {Function} callback Callback to call when the "action" is executed and ready.
	 */
	_doRequest({action, key, args}, callback) {
		// fsPath, options
		if (this.#cache[key]) {
			const {result, error} = this.#cache[key];
			callback(error, result);
		} else {
			this.#callbacks.push({key, callback});
			this.#comPort.postMessage({action, key, args});
		}
	}
}

/**
 * "@ui5/fs/fsInterface" like class that uses internally
 * "@ui5/fs/fsInterface", implements its methods, and
 * sends the results to a MessagePort.
 *
 * Used in the main thread in a combination with FsWorkerThreadInterface.
 */
export class FsMainThreadInterface extends AbstractMain {
	constructor(fsInterfaceComPort) {
		super(fsInterfaceComPort);
	}

	#parseResults(method, result) {
		// Stats object cannot be sent over postMessage.
		// Cast it to simple object that is alike the stats.
		if (method === "stat" && !!result) {
			return JSON.parse(JSON.stringify(result));
		} else {
			return result;
		}
	}

	get(method, args) {
		const {fsPath, options} = args;
		const composedArgs = [fsPath, options].filter(($) => $ !== undefined);

		return new Promise((resolve) => {
			this.getFs()[method](...composedArgs, (error, result) => {
				resolve({error, result: this.#parseResults(method, result)});
			});
		});
	}
}

/**
 * "@ui5/fs/fsInterface" like class that uses internally
 * "@ui5/fs/fsInterface", implements its methods, and
 * requests resources via MessagePort.
 *
 * Used in the worker thread in a combination with FsMainThreadInterface.
 */
export class FsWorkerThreadInterface extends AbstractThread {
	readFile(fsPath, options, callback) {
		const key = `${fsPath}-readFile`;
		this._doRequest({action: "readFile", key, args: {fsPath, options}}, callback);
	}

	stat(fsPath, callback) {
		const key = `${fsPath}-stat`;
		this._doRequest({action: "stat", key, args: {fsPath}}, callback);
	}
}

