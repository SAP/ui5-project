import test from "ava";
import path from "node:path";
import sinon from "sinon";
import Specification from "../../../../../lib/specifications/Specification.js";
import ServerMiddleware from "../../../../../lib/specifications/types/extensions/ServerMiddleware.js";

function clone(obj) {
	return JSON.parse(JSON.stringify(obj));
}

const genericExtensionPath = path.join(__dirname, "..", "..", "..", "..", "fixtures", "extension.a");
const basicServerMiddlewareInput = {
	id: "server.middleware.a",
	version: "1.0.0",
	modulePath: genericExtensionPath,
	configuration: {
		specVersion: "2.6",
		kind: "extension",
		type: "server-middleware",
		metadata: {
			name: "middleware-a"
		},
		middleware: {
			path: "lib/extensionModule.js"
		}
	}
};

test.afterEach.always((t) => {
	sinon.restore();
});

test("Correct class", async (t) => {
	const extension = await Specification.create(clone(basicServerMiddlewareInput));
	t.true(extension instanceof ServerMiddleware, `Is an instance of the ServerMiddleware class`);
});

test("getMiddleware", async (t) => {
	const extension = await Specification.create(clone(basicServerMiddlewareInput));
	t.is(extension.getMiddleware(), "extension module",
		"Returned correct module");
});

test("Middleware with illegal suffix", async (t) => {
	const serverMiddlewareInput = clone(basicServerMiddlewareInput);
	serverMiddlewareInput.configuration.metadata.name += "--1";
	const err = await t.throwsAsync(Specification.create(serverMiddlewareInput));
	t.is(err.message,
		"Failed to validate configuration of server-middleware extension middleware-a--1: " +
		"Server middleware name must not end with '--<number>'",
		"Threw with expected error message");
});
