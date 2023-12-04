import workerpool from "workerpool";
import os from "node:os";
import {fileURLToPath} from "node:url";
import {getLogger} from "@ui5/logger";
import {serializeData, deserializeData, serializeResources, FsMainThreadInterface} from "./threadUtils.js";
import {setTimeout as setTimeoutPromise} from "node:timers/promises";

const MIN_WORKERS = 2;
const MAX_WORKERS = 4;
const osCpus = os.cpus().length || 1;
const maxWorkers = Math.max(Math.min(osCpus - 1, MAX_WORKERS), MIN_WORKERS);

export default class WorkDispatcher {
	#log = getLogger("build:helpers:WorkDispatcher");
	#activeBuilds = new Set();
	#pool;
	static #ensureSingleton = false;
	static #instance;

	#getPool() {
		if (!this.#pool) {
			this.#log.verbose(
				`Creating workerpool with up to ${maxWorkers} workers (available CPU cores: ${osCpus})`
			);
			const workerPath = fileURLToPath(
				new URL("./threadRunner.js", import.meta.url)
			);
			this.#pool = workerpool.pool(workerPath, {
				workerType: "auto",
				maxWorkers,
			});
		}
		return this.#pool;
	}

	constructor() {
		if (!WorkDispatcher.#ensureSingleton) {
			throw new Error(
				"WorkDispatcher is a singleton class. Use WorkDispatcher.getInstance()"
			);
		}
	}

	static getInstance(buildRef) {
		if (!buildRef) {
			throw new Error(`A reference to the calling instance must be provided`);
		}
		if (!WorkDispatcher.#instance) {
			WorkDispatcher.#ensureSingleton = true;
			WorkDispatcher.#instance = new WorkDispatcher();
			WorkDispatcher.#ensureSingleton = false;
		}

		WorkDispatcher.#instance.#registerActiveBuild(buildRef);

		return WorkDispatcher.#instance;
	}

	getProcessor(modulePath) {
		return {
			execute: async ({resources, options, reader}) => {
				const buildUpArgs = {modulePath, args: {options: await serializeData(options)}};
				let toTransfer;
				let threadMessageHandler;
				let fsInterfaceMainPort;

				if (reader) {
					const {port1, port2} = new MessageChannel();
					fsInterfaceMainPort = port1;
					buildUpArgs.args.fsInterfaceComPort = port2;
					toTransfer = {transfer: [port2]};

					threadMessageHandler = new FsMainThreadInterface(reader);
					threadMessageHandler.startCommunication(fsInterfaceMainPort);
				}

				if (resources) {
					buildUpArgs.args.resources = await serializeResources(resources);
				}

				const result = await this.#getPool().exec("execProcessor", [buildUpArgs], toTransfer);

				if (reader) {
					threadMessageHandler.endCommunication(fsInterfaceMainPort);
				}

				return deserializeData(result);
			}
		};
	}

	async cleanup(buildRef, force) {
		const attemptPoolTermination = async () => {
			if (this.#activeBuilds.size && !force) {
				this.#log.verbose(
					`Pool termination canceled. There are still ${this.#activeBuilds.size} active builds`
				);
				return;
			}

			this.#log.verbose(`Attempting to terminate the workerpool...`);

			if (!this.#pool) {
				this.#log.verbose(
					"Pool termination requested, but a pool has not been initialized or has already been terminated."
				);
				return;
			}

			// There are many stats that could be used, but these ones seem the most
			// convenient. When all the (available) workers are idle, then it's safe to terminate.
			// There are many stats that could be used, but these ones seem the most
			// convenient. When all the (available) workers are idle, then it's safe to terminate.
			let {idleWorkers, totalWorkers} = this.#pool.stats();
			while (idleWorkers !== totalWorkers && !force) {
				await setTimeoutPromise(100); // Wait a bit workers to finish and try again
				({idleWorkers, totalWorkers} = this.#pool.stats());
			}

			return await this.terminateTasks(force);
		};

		if (!buildRef) {
			throw new Error(`A reference to the calling instance must be provided`);
		}
		if (!this.#activeBuilds.has(buildRef)) {
			throw new Error(`The provided build reference is unknown`);
		}
		this.#activeBuilds.delete(buildRef);

		return await attemptPoolTermination();
	}

	async terminateTasks(force) {
		if (!this.#pool) {
			this.#log.verbose(
				"Pool termination requested, but a pool has not been initialized or has already been terminated");
			return;
		}

		this.#activeBuilds = [];
		const pool = this.#pool;
		this.#pool = null;
		return await pool.terminate(force);
	}

	#registerActiveBuild(instanceRef) {
		if (this.#activeBuilds.has(instanceRef)) {
			throw new Error(`Build already registered in Work Dispatcher. This should never happen`);
		}
		this.#activeBuilds.add(instanceRef);
	}
}
