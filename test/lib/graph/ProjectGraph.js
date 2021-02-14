const test = require("ava");
const sinonGlobal = require("sinon");
const mock = require("mock-require");
const logger = require("@ui5/logger");
const Configuration = require("../../../lib/specifications/Configuration");
const Project = require("../../../lib/specifications/Project");
const Extension = require("../../../lib/specifications/Extension");

function createProject(name) {
	const basicConfiguration = new Configuration({
		specVersion: "2.3",
		kind: "project",
		type: "application",
		metadata: {name}
	});

	return new Project({
		id: "application.a.id",
		version: "1.0.0",
		modulePath: "some path",
		configuration: basicConfiguration
	});
}

function createExtension(name) {
	const basicConfiguration = new Configuration({
		specVersion: "2.3",
		kind: "extension",
		type: "task",
		metadata: {name}
	});

	return new Extension({
		id: "application.a.id",
		version: "1.0.0",
		modulePath: "some path",
		configuration: basicConfiguration
	});
}

function traverseBreadthFirst(...args) {
	return _traverse(...args, true);
}

function traverseDepthFirst(...args) {
	return _traverse(...args, false);
}

async function _traverse(t, graph, expectedOrder, bfs) {
	if (bfs === undefined) {
		throw new Error("Test error: Parameter 'bfs' must be specified");
	}
	const callbackStub = t.context.sinon.stub().resolves();
	if (bfs) {
		await graph.traverseBreadthFirst(callbackStub);
	} else {
		await graph.traverseDepthFirst(callbackStub);
	}

	t.is(callbackStub.callCount, expectedOrder.length, "Correct number of projects have been visited");

	const callbackCalls = callbackStub.getCalls().map((call) => call.args[0].project.getName());

	t.deepEqual(callbackCalls, expectedOrder, "Traversed graph in correct order");
}

test.beforeEach((t) => {
	const sinon = t.context.sinon = sinonGlobal.createSandbox();

	t.context.log = {
		warn: sinon.stub(),
		verbose: sinon.stub(),
		error: sinon.stub(),
		info: sinon.stub(),
		isLevelEnabled: () => true
	};
	sinon.stub(logger, "getLogger").callThrough()
		.withArgs("graph:ProjectGraph").returns(t.context.log);
	t.context.ProjectGraph = mock.reRequire("../../../lib/graph/ProjectGraph");
	logger.getLogger.restore(); // Immediately restore global stub for following tests
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
});

test("Instantiate a basic project graph", async (t) => {
	const {ProjectGraph} = t.context;
	t.notThrows(() => {
		new ProjectGraph({
			rootProjectName: "my root project"
		});
	}, "Should not throw");
});

test("Instantiate a basic project with missing parameter rootProjectName", async (t) => {
	const {ProjectGraph} = t.context;
	const error = t.throws(() => {
		new ProjectGraph({});
	});
	t.is(error.message, "Could not create ProjectGraph: Missing or empty parameter 'rootProjectName'",
		"Should throw with expected error message");
});

test("getRoot", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "application.a"
	});
	const project = createProject("application.a");
	graph.addProject(project);
	const res = graph.getRoot();
	t.is(res, project, "Should return correct root project");
});

test("getRoot: Root not added to graph", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "application.a"
	});

	const error = t.throws(() => {
		graph.getRoot();
	});
	t.is(error.message,
		"Unable to find root project with name application.a in graph",
		"Should throw with expected error message");
});

test("add-/getProject", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "my root project"
	});
	const project = createProject("application.a");
	graph.addProject(project);
	const res = graph.getProject("application.a");
	t.is(res, project, "Should return correct project");
});

test("addProject: Add duplicate", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "my root project"
	});
	const project1 = createProject("application.a");
	graph.addProject(project1);

	const project2 = createProject("application.a");
	const error = t.throws(() => {
		graph.addProject(project2);
	});
	t.is(error.message,
		"Failed to add project application.a to graph: A project with that name has already been added",
		"Should throw with expected error message");

	const res = graph.getProject("application.a");
	t.is(res, project1, "Should return correct project");
});

test("addProject: Add duplicate with ignoreDuplicates", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "my root project"
	});
	const project1 = createProject("application.a");
	graph.addProject(project1);

	const project2 = createProject("application.a");
	t.notThrows(() => {
		graph.addProject(project2, true);
	}, "Should not throw when adding duplicates");

	const res = graph.getProject("application.a");
	t.is(res, project1, "Should return correct project");
});

test("addProject: Add project with integer-like name", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "my root project"
	});
	const project = createProject("1337");

	const error = t.throws(() => {
		graph.addProject(project);
	});
	t.is(error.message,
		"Failed to add project 1337 to graph: Project name must not be integer-like",
		"Should throw with expected error message");
});

test("getProject: Project is not in graph", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "my root project"
	});
	const res = graph.getProject("application.a");
	t.is(res, undefined, "Should return undefined");
});

test("add-/getExtension", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "my root project"
	});
	const extension = createExtension("extension.a");
	graph.addExtension(extension);
	const res = graph.getExtension("extension.a");
	t.is(res, extension, "Should return correct extension");
});

test("addExtension: Add duplicate", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "my root project"
	});
	const extension1 = createExtension("extension.a");
	graph.addExtension(extension1);

	const extension2 = createExtension("extension.a");
	const error = t.throws(() => {
		graph.addExtension(extension2);
	});
	t.is(error.message,
		"Failed to add extension extension.a to graph: An extension with that name has already been added",
		"Should throw with expected error message");

	const res = graph.getExtension("extension.a");
	t.is(res, extension1, "Should return correct extension");
});

test("addExtension: Add extension with integer-like name", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "my root project"
	});
	const extension = createExtension("1337");

	const error = t.throws(() => {
		graph.addExtension(extension);
	});
	t.is(error.message,
		"Failed to add extension 1337 to graph: Extension name must not be integer-like",
		"Should throw with expected error message");
});

test("getExtension: Project is not in graph", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "my root project"
	});
	const res = graph.getExtension("extension.a");
	t.is(res, undefined, "Should return undefined");
});

test("getAllExtensions", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "my root project"
	});
	const extension1 = createExtension("extension.a");
	graph.addExtension(extension1);

	const extension2 = createExtension("extension.b");
	graph.addExtension(extension2);
	const res = graph.getAllExtensions();
	t.deepEqual(res, {
		"extension.a": extension1,
		"extension.b": extension2
	}, "Should return all extensions");
});

test("declareDependency / getDependencies", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "my root project"
	});
	graph.addProject(createProject("library.a"));
	graph.addProject(createProject("library.b"));

	graph.declareDependency("library.a", "library.b");
	t.deepEqual(graph.getDependencies("library.a"), [
		"library.b"
	], "Should store and return correct dependencies for library.a");
	t.deepEqual(graph.getDependencies("library.b"), [],
		"Should store and return correct dependencies for library.b");

	graph.declareDependency("library.b", "library.a");

	t.deepEqual(graph.getDependencies("library.a"), [
		"library.b"
	], "Should store and return correct dependencies for library.a");
	t.deepEqual(graph.getDependencies("library.b"), [
		"library.a"
	], "Should store and return correct dependencies for library.b");
});

test("declareDependency: Unknown source", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "my root project"
	});
	graph.addProject(createProject("library.b"));

	const error = t.throws(() => {
		graph.declareDependency("library.a", "library.b");
	});
	t.is(error.message,
		"Failed to declare dependency from project library.a to library.b: Unable " +
		"to find depending project with name library.a in graph",
		"Should throw with expected error message");
});

test("declareDependency: Unknown target", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "my root project"
	});
	graph.addProject(createProject("library.a"));

	const error = t.throws(() => {
		graph.declareDependency("library.a", "library.b");
	});
	t.is(error.message,
		"Failed to declare dependency from project library.a to library.b: Unable " +
		"to find dependency project with name library.b in graph",
		"Should throw with expected error message");
});

test("declareDependency: Already declared", async (t) => {
	const {ProjectGraph, log} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "my root project"
	});
	graph.addProject(createProject("library.a"));
	graph.addProject(createProject("library.b"));

	graph.declareDependency("library.a", "library.b");
	graph.declareDependency("library.a", "library.b");

	t.is(log.warn.callCount, 1, "log.warn should be called once");
	t.is(log.warn.getCall(0).args[0],
		`Dependency has already been declared: library.a depends on library.b`,
		"log.warn should be called once with the expected argument");
});

test("traverseBreadthFirst", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "library.a"
	});
	graph.addProject(createProject("library.a"));
	graph.addProject(createProject("library.b"));

	graph.declareDependency("library.a", "library.b");

	await traverseBreadthFirst(t, graph, [
		"library.a",
		"library.b"
	]);
});

test("traverseBreadthFirst: No project visited twice", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "library.a"
	});
	graph.addProject(createProject("library.a"));
	graph.addProject(createProject("library.b"));
	graph.addProject(createProject("library.c"));

	graph.declareDependency("library.a", "library.b");
	graph.declareDependency("library.a", "library.c");
	graph.declareDependency("library.b", "library.c");

	await traverseBreadthFirst(t, graph, [
		"library.a",
		"library.b",
		"library.c"
	]);
});

test("traverseBreadthFirst: Detect cycle", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "library.a"
	});
	graph.addProject(createProject("library.a"));
	graph.addProject(createProject("library.b"));

	graph.declareDependency("library.a", "library.b");
	graph.declareDependency("library.b", "library.a");

	const error = await t.throwsAsync(graph.traverseBreadthFirst(() => {}));
	t.is(error.message,
		"Detected cyclic dependency chain: library.a* -> library.b -> library.a*",
		"Should throw with expected error message");
});

test("traverseBreadthFirst: No cycle when visited breadth first", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "library.a"
	});
	graph.addProject(createProject("library.a"));
	graph.addProject(createProject("library.b"));
	graph.addProject(createProject("library.c"));

	graph.declareDependency("library.a", "library.b");
	graph.declareDependency("library.a", "library.c");
	graph.declareDependency("library.b", "library.c");
	graph.declareDependency("library.c", "library.b");

	await traverseBreadthFirst(t, graph, [
		"library.a",
		"library.b",
		"library.c"
	]);
});

test("traverseBreadthFirst: Can't find start node", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "library.a"
	});

	const error = await t.throwsAsync(graph.traverseBreadthFirst(() => {}));
	t.is(error.message,
		"Failed to start graph traversal: Could not find project library.a in graph",
		"Should throw with expected error message");
});

test("traverseBreadthFirst: Custom start node", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "library.a"
	});
	graph.addProject(createProject("library.a"));
	graph.addProject(createProject("library.b"));
	graph.addProject(createProject("library.c"));

	graph.declareDependency("library.a", "library.b");
	graph.declareDependency("library.b", "library.c");

	const callbackStub = t.context.sinon.stub().resolves();
	await graph.traverseBreadthFirst(callbackStub, "library.b");

	t.is(callbackStub.callCount, 2, "Correct number of projects have been visited");

	const callbackCalls = callbackStub.getCalls().map((call) => call.args[0].project.getName());

	t.deepEqual(callbackCalls, [
		"library.b",
		"library.c"
	], "Traversed graph in correct order, starting with library.b");
});

test("traverseBreadthFirst: getDependencies callback", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "library.a"
	});
	graph.addProject(createProject("library.a"));
	graph.addProject(createProject("library.b"));
	graph.addProject(createProject("library.c"));

	graph.declareDependency("library.a", "library.b");
	graph.declareDependency("library.a", "library.c");
	graph.declareDependency("library.b", "library.c");

	const callbackStub = t.context.sinon.stub().resolves();
	await graph.traverseBreadthFirst(callbackStub);

	t.is(callbackStub.callCount, 3, "Correct number of projects have been visited");

	const callbackCalls = callbackStub.getCalls().map((call) => call.args[0].project.getName());
	const dependencies = callbackStub.getCalls().map((call) => {
		return call.args[0].getDependencies().map((dep) => {
			return dep.getName();
		});
	});

	t.deepEqual(callbackCalls, [
		"library.a",
		"library.b",
		"library.c"
	], "Traversed graph in correct order");

	t.deepEqual(dependencies, [
		["library.b", "library.c"],
		["library.c"],
		[]
	], "Provided correct dependencies for each visited project");
});

test("traverseBreadthFirst: Dependency declaration order is followed", async (t) => {
	const {ProjectGraph} = t.context;
	const graph1 = new ProjectGraph({
		rootProjectName: "library.a"
	});
	graph1.addProject(createProject("library.a"));
	graph1.addProject(createProject("library.b"));
	graph1.addProject(createProject("library.c"));
	graph1.addProject(createProject("library.d"));

	graph1.declareDependency("library.a", "library.b");
	graph1.declareDependency("library.a", "library.c");
	graph1.declareDependency("library.a", "library.d");

	await traverseBreadthFirst(t, graph1, [
		"library.a",
		"library.b",
		"library.c",
		"library.d"
	]);

	const graph2 = new ProjectGraph({
		rootProjectName: "library.a"
	});
	graph2.addProject(createProject("library.a"));
	graph2.addProject(createProject("library.b"));
	graph2.addProject(createProject("library.c"));
	graph2.addProject(createProject("library.d"));

	graph2.declareDependency("library.a", "library.d");
	graph2.declareDependency("library.a", "library.c");
	graph2.declareDependency("library.a", "library.b");

	await traverseBreadthFirst(t, graph2, [
		"library.a",
		"library.d",
		"library.c",
		"library.b"
	]);
});

test("traverseDepthFirst", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "library.a"
	});
	graph.addProject(createProject("library.a"));
	graph.addProject(createProject("library.b"));

	graph.declareDependency("library.a", "library.b");

	await traverseDepthFirst(t, graph, [
		"library.b",
		"library.a"
	]);
});

test("traverseDepthFirst: No project visited twice", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "library.a"
	});
	graph.addProject(createProject("library.a"));
	graph.addProject(createProject("library.b"));
	graph.addProject(createProject("library.c"));

	graph.declareDependency("library.a", "library.b");
	graph.declareDependency("library.a", "library.c");
	graph.declareDependency("library.b", "library.c");

	await traverseDepthFirst(t, graph, [
		"library.c",
		"library.b",
		"library.a"
	]);
});

test("traverseDepthFirst: Detect cycle", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "library.a"
	});
	graph.addProject(createProject("library.a"));
	graph.addProject(createProject("library.b"));

	graph.declareDependency("library.a", "library.b");
	graph.declareDependency("library.b", "library.a");

	const error = await t.throwsAsync(graph.traverseDepthFirst(() => {}));
	t.is(error.message,
		"Detected cyclic dependency chain: library.a* -> library.b -> library.a*",
		"Should throw with expected error message");
});

test("traverseDepthFirst: Cycle which does not occur in BFS", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "library.a"
	});
	graph.addProject(createProject("library.a"));
	graph.addProject(createProject("library.b"));
	graph.addProject(createProject("library.c"));

	graph.declareDependency("library.a", "library.b");
	graph.declareDependency("library.a", "library.c");
	graph.declareDependency("library.b", "library.c");
	graph.declareDependency("library.c", "library.b");

	const error = await t.throwsAsync(graph.traverseDepthFirst(() => {}));
	t.is(error.message,
		"Detected cyclic dependency chain: library.a -> library.b* -> library.c -> library.b*",
		"Should throw with expected error message");
});

test("traverseDepthFirst: Can't find start node", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "library.a"
	});

	const error = await t.throwsAsync(graph.traverseDepthFirst(() => {}));
	t.is(error.message,
		"Failed to start graph traversal: Could not find project library.a in graph",
		"Should throw with expected error message");
});

test("traverseDepthFirst: Custom start node", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "library.a"
	});
	graph.addProject(createProject("library.a"));
	graph.addProject(createProject("library.b"));
	graph.addProject(createProject("library.c"));

	graph.declareDependency("library.a", "library.b");
	graph.declareDependency("library.b", "library.c");

	const callbackStub = t.context.sinon.stub().resolves();
	await graph.traverseDepthFirst(callbackStub, "library.b");

	t.is(callbackStub.callCount, 2, "Correct number of projects have been visited");

	const callbackCalls = callbackStub.getCalls().map((call) => call.args[0].project.getName());

	t.deepEqual(callbackCalls, [
		"library.c",
		"library.b"
	], "Traversed graph in correct order, starting with library.b");
});

test("traverseDepthFirst: getDependencies callback", async (t) => {
	const {ProjectGraph} = t.context;
	const graph = new ProjectGraph({
		rootProjectName: "library.a"
	});
	graph.addProject(createProject("library.a"));
	graph.addProject(createProject("library.b"));
	graph.addProject(createProject("library.c"));

	graph.declareDependency("library.a", "library.b");
	graph.declareDependency("library.a", "library.c");
	graph.declareDependency("library.b", "library.c");

	const callbackStub = t.context.sinon.stub().resolves();
	await graph.traverseDepthFirst(callbackStub);

	t.is(callbackStub.callCount, 3, "Correct number of projects have been visited");

	const callbackCalls = callbackStub.getCalls().map((call) => call.args[0].project.getName());
	const dependencies = callbackStub.getCalls().map((call) => {
		return call.args[0].getDependencies().map((dep) => {
			return dep.getName();
		});
	});

	t.deepEqual(callbackCalls, [
		"library.c",
		"library.b",
		"library.a",
	], "Traversed graph in correct order");

	t.deepEqual(dependencies, [
		[],
		["library.c"],
		["library.b", "library.c"],
	], "Provided correct dependencies for each visited project");
});

test("traverseDepthFirst: Dependency declaration order is followed", async (t) => {
	const {ProjectGraph} = t.context;
	const graph1 = new ProjectGraph({
		rootProjectName: "library.a"
	});
	graph1.addProject(createProject("library.a"));
	graph1.addProject(createProject("library.b"));
	graph1.addProject(createProject("library.c"));
	graph1.addProject(createProject("library.d"));

	graph1.declareDependency("library.a", "library.b");
	graph1.declareDependency("library.a", "library.c");
	graph1.declareDependency("library.a", "library.d");

	await traverseDepthFirst(t, graph1, [
		"library.b",
		"library.c",
		"library.d",
		"library.a",
	]);

	const graph2 = new ProjectGraph({
		rootProjectName: "library.a"
	});
	graph2.addProject(createProject("library.a"));
	graph2.addProject(createProject("library.b"));
	graph2.addProject(createProject("library.c"));
	graph2.addProject(createProject("library.d"));

	graph2.declareDependency("library.a", "library.d");
	graph2.declareDependency("library.a", "library.c");
	graph2.declareDependency("library.a", "library.b");

	await traverseDepthFirst(t, graph2, [
		"library.d",
		"library.c",
		"library.b",
		"library.a",
	]);
});

test("join", async (t) => {
	const {ProjectGraph} = t.context;
	const graph1 = new ProjectGraph({
		rootProjectName: "library.a"
	});
	const graph2 = new ProjectGraph({
		rootProjectName: "theme.a"
	});
	graph1.addProject(createProject("library.a"));
	graph1.addProject(createProject("library.b"));
	graph1.addProject(createProject("library.c"));
	graph1.addProject(createProject("library.d"));

	graph1.declareDependency("library.a", "library.b");
	graph1.declareDependency("library.a", "library.c");
	graph1.declareDependency("library.a", "library.d");

	const extensionA = createExtension("extension.a");
	graph1.addExtension(extensionA);

	graph2.addProject(createProject("theme.a"));
	graph2.addProject(createProject("theme.b"));
	graph2.addProject(createProject("theme.c"));
	graph2.addProject(createProject("theme.d"));

	graph2.declareDependency("theme.a", "theme.d");
	graph2.declareDependency("theme.a", "theme.c");
	graph2.declareDependency("theme.b", "theme.a"); // This causes theme.b to not appear

	const extensionB = createExtension("extension.b");
	graph2.addExtension(extensionB);

	graph1.join(graph2);
	graph1.declareDependency("library.d", "theme.a");

	await traverseDepthFirst(t, graph1, [
		"library.b",
		"library.c",
		"theme.d",
		"theme.c",
		"theme.a",
		"library.d",
		"library.a",
	]);

	t.is(graph1.getExtension("extension.a"), extensionA, "Should return correct extension");
	t.is(graph1.getExtension("extension.b"), extensionB, "Should return correct joined extension");
});

test("join: Unexpected project intersection", async (t) => {
	const {ProjectGraph} = t.context;
	const graph1 = new ProjectGraph({
		rootProjectName: "😹"
	});
	const graph2 = new ProjectGraph({
		rootProjectName: "😼"
	});
	graph1.addProject(createProject("library.a"));
	graph2.addProject(createProject("library.a"));


	const error = t.throws(() => {
		graph1.join(graph2);
	});
	t.is(error.message,
		"Failed to join graph with root project 😼 into 😹: Failed to merge map: " +
		"Key 'library.a' already present in target set",
		"Should throw with expected error message");
});

test("join: Unexpected extension intersection", async (t) => {
	const {ProjectGraph} = t.context;
	const graph1 = new ProjectGraph({
		rootProjectName: "😹"
	});
	const graph2 = new ProjectGraph({
		rootProjectName: "😼"
	});
	graph1.addExtension(createExtension("extension.a"));
	graph2.addExtension(createExtension("extension.a"));


	const error = t.throws(() => {
		graph1.join(graph2);
	});
	t.is(error.message,
		"Failed to join graph with root project 😼 into 😹: Failed to merge map: " +
		"Key 'extension.a' already present in target set",
		"Should throw with expected error message");
});
