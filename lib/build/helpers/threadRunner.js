import workerpool from "workerpool";
import {FsWorkerThreadInterface, deserializeResources, serializeData, deserializeData} from "./threadUtils.js";
import {getLogger} from "@ui5/logger";
import {createResource} from "@ui5/fs/resourceFactory";

export default async function execProcessor({modulePath, args}) {
	const {default: moduleToExecute} = await import(modulePath);
	if (!moduleToExecute) {
		throw new Error(`No default export for module ${modulePath}`);
	}
	const methodCall = moduleToExecute;
	const {options, resources, fsInterfaceComPort} = args;

	const buildUpArgs = {
		options: await deserializeData(options),
		resourceFactory: {createResource},
		log: getLogger(`builder:processor:${modulePath}`)
	};

	if (resources) {
		buildUpArgs.resources = await deserializeResources(resources);
	}
	if (fsInterfaceComPort) {
		buildUpArgs.fs = new FsWorkerThreadInterface(fsInterfaceComPort);
	}

	const result = await methodCall(buildUpArgs);

	return serializeData(result);
}

// Test execution via ava is never done on the main thread
/* istanbul ignore else */
if (!workerpool.isMainThread) {
	// Script got loaded through workerpool
	// => Create a worker and register public functions
	workerpool.worker({
		execProcessor,
	});
}
