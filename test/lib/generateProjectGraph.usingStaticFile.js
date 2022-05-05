const test = require("ava");
const path = require("path");
const sinonGlobal = require("sinon");

const projectGraphFromStaticFile = require("../../lib/generateProjectGraph").usingStaticFile;

const applicationHPath = path.join(__dirname, "..", "fixtures", "application.h");
const notExistingPath = path.join(__dirname, "..", "fixtures", "does_not_exist");

test.beforeEach((t) => {
	t.context.sinon = sinonGlobal.createSandbox();
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
});

test("Application H: Traverse project graph breadth first", async (t) => {
	const projectGraph = await projectGraphFromStaticFile({
		cwd: applicationHPath
	});
	const callbackStub = t.context.sinon.stub().resolves();
	await projectGraph.traverseBreadthFirst(callbackStub);

	t.is(callbackStub.callCount, 2, "Two projects have been visited");

	const callbackCalls = callbackStub.getCalls().map((call) => call.args[0].project.getName());

	t.deepEqual(callbackCalls, [
		"application.a",
		"library.e",
	], "Traversed graph in correct order");
});

test("Throws error if file not found", async (t) => {
	const err = await t.throwsAsync(projectGraphFromStaticFile({
		cwd: notExistingPath
	}));
	t.is(err.message,
		`Failed to load dependency tree configuration from path ${notExistingPath}/projectDependencies.yaml: ` +
		`ENOENT: no such file or directory, open '${notExistingPath}/projectDependencies.yaml'`,
		"Correct error message");
});
