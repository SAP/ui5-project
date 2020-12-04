const test = require("ava");
const sinonGlobal = require("sinon");
const path = require("path");
const projectGraphFromTree = require("../../../lib/graph/projectGraphFromTree.js");

const applicationAPath = path.join(__dirname, "..", "..", "fixtures", "application.a");
const cycleDepsBasePath = path.join(__dirname, "..", "..", "fixtures", "cyclic-deps", "node_modules");

test.beforeEach((t) => {
	t.context.sinon = sinonGlobal.createSandbox();
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
});

test("Application A", async (t) => {
	const projectGraph = await projectGraphFromTree(applicationATree);
	const rootProject = projectGraph.getRoot();
	t.is(rootProject.getName(), "application.a", "Returned correct root project");
});

test("Application A: Traverse project graph breadth first", async (t) => {
	const projectGraph = await projectGraphFromTree(applicationATree);
	const callbackStub = t.context.sinon.stub().resolves();
	await projectGraph.traverseBreadthFirst(callbackStub);

	t.is(callbackStub.callCount, 5, "Five projects have been visited");

	const callbackCalls = callbackStub.getCalls().map((call) => call.args[0].project.getName());

	// Since libraries a, b and c are processed in parallel, their callback order can vary
	// Therefore we always sort the last three calls
	const lastThreeCalls = callbackCalls.splice(2, 3).sort();
	callbackCalls.push(...lastThreeCalls);
	t.deepEqual(callbackCalls, [
		"application.a",
		"library.d",
		"library.a",
		"library.b",
		"library.c"
	], "Traversed graph in correct order");
});

test("Application Cycle A: Traverse project graph breadth first with cycles", async (t) => {
	const projectGraph = await projectGraphFromTree(applicationCycleATreeIncDeduped);
	const callbackStub = t.context.sinon.stub().resolves();
	const error = await t.throwsAsync(projectGraph.traverseBreadthFirst(callbackStub));

	t.is(callbackStub.callCount, 4, "Four projects have been visited");

	t.is(error.message,
		"Detected cyclic dependency chain: application.cycle.a* -> component.cycle.a " +
		"-> application.cycle.a*",
		"Threw with expected error message");

	const callbackCalls = callbackStub.getCalls().map((call) => call.args[0].project.getName());
	t.deepEqual(callbackCalls, [
		"application.cycle.a",
		"component.cycle.a",
		"library.cycle.a",
		"library.cycle.b",
	], "Traversed graph in correct order");
});

test("Application Cycle B: Traverse project graph breadth first with cycles", async (t) => {
	const projectGraph = await projectGraphFromTree(applicationCycleBTreeIncDeduped);
	const callbackStub = t.context.sinon.stub().resolves();
	await projectGraph.traverseBreadthFirst(callbackStub);

	// TODO: Confirm this behavior with FW. BFS works fine since all modules have already been visited
	//	before a cycle is entered. DFS fails because it dives into the cycle first.

	t.is(callbackStub.callCount, 3, "Four projects have been visited");

	const callbackCalls = callbackStub.getCalls().map((call) => call.args[0].project.getName());
	t.deepEqual(callbackCalls, [
		"application.cycle.b",
		"module.d",
		"module.e"
	], "Traversed graph in correct order");
});

test("Application A: Traverse project graph depth first", async (t) => {
	const projectGraph = await projectGraphFromTree(applicationATree);
	const callbackStub = t.context.sinon.stub().resolves();
	await projectGraph.traverseDepthFirst(callbackStub);

	t.is(callbackStub.callCount, 5, "Five projects have been visited");

	const callbackCalls = callbackStub.getCalls().map((call) => call.args[0].project.getName());

	// Since libraries a, b and c are processed in parallel, their callback order can vary
	// Therefore we always sort the first three calls
	const firstThreeCalls = callbackCalls.splice(0, 3).sort();
	callbackCalls.unshift(...firstThreeCalls);
	t.deepEqual(callbackCalls, [
		"library.a",
		"library.b",
		"library.c",
		"library.d",
		"application.a",

	], "Traversed graph in correct order");
});


test("Application Cycle A: Traverse project graph depth first with cycles", async (t) => {
	const projectGraph = await projectGraphFromTree(applicationCycleATreeIncDeduped);
	const callbackStub = t.context.sinon.stub().resolves();
	const error = await t.throwsAsync(projectGraph.traverseDepthFirst(callbackStub));

	t.is(callbackStub.callCount, 0, "Zero projects have been visited");

	t.is(error.message,
		"Detected cyclic dependency chain: application.cycle.a* -> component.cycle.a " +
		"-> application.cycle.a*",
		"Threw with expected error message");
});

test("Application Cycle B: Traverse project graph depth first with cycles", async (t) => {
	const projectGraph = await projectGraphFromTree(applicationCycleBTreeIncDeduped);
	const callbackStub = t.context.sinon.stub().resolves();
	const error = await t.throwsAsync(projectGraph.traverseDepthFirst(callbackStub));

	t.is(callbackStub.callCount, 0, "Zero projects have been visited");

	t.is(error.message,
		"Detected cyclic dependency chain: application.cycle.b -> module.d* " +
		"-> module.e -> module.d*",
		"Threw with expected error message");
});


/* ========================= */
/* ======= Test data ======= */

const applicationATree = {
	id: "application.a.id",
	version: "1.0.0",
	path: applicationAPath,
	dependencies: [
		{
			id: "library.d.id",
			version: "1.0.0",
			path: path.join(applicationAPath, "node_modules", "library.d"),
			dependencies: [
				{
					id: "library.a.id",
					version: "1.0.0",
					path: path.join(applicationAPath, "node_modules", "collection", "library.a"),
					dependencies: []
				},
				{
					id: "library.b.id",
					version: "1.0.0",
					path: path.join(applicationAPath, "node_modules", "collection", "library.b"),
					dependencies: []
				},
				{
					id: "library.c.id",
					version: "1.0.0",
					path: path.join(applicationAPath, "node_modules", "collection", "library.c"),
					dependencies: []
				}
			]
		}
	]
};


const applicationCycleATreeIncDeduped = {
	id: "application.cycle.a",
	version: "1.0.0",
	path: path.join(cycleDepsBasePath, "application.cycle.a"),
	dependencies: [
		{
			id: "component.cycle.a",
			version: "1.0.0",
			path: path.join(cycleDepsBasePath, "component.cycle.a"),
			dependencies: [
				{
					id: "library.cycle.a",
					version: "1.0.0",
					path: path.join(cycleDepsBasePath, "library.cycle.a"),
					dependencies: [
						{
							id: "component.cycle.a",
							version: "1.0.0",
							path: path.join(cycleDepsBasePath, "component.cycle.a"),
							dependencies: [],
							deduped: true
						}
					]
				},
				{
					id: "library.cycle.b",
					version: "1.0.0",
					path: path.join(cycleDepsBasePath, "library.cycle.b"),
					dependencies: [
						{
							id: "component.cycle.a",
							version: "1.0.0",
							path: path.join(cycleDepsBasePath, "component.cycle.a"),
							dependencies: [],
							deduped: true
						}
					]
				},
				{
					id: "application.cycle.a",
					version: "1.0.0",
					path: path.join(cycleDepsBasePath, "application.cycle.a"),
					dependencies: [],
					deduped: true
				}
			]
		}
	]
};

const applicationCycleBTreeIncDeduped = {
	id: "application.cycle.b",
	version: "1.0.0",
	path: path.join(cycleDepsBasePath, "application.cycle.b"),
	dependencies: [
		{
			id: "module.d",
			version: "1.0.0",
			path: path.join(cycleDepsBasePath, "module.d"),
			dependencies: [
				{
					id: "module.e",
					version: "1.0.0",
					path: path.join(cycleDepsBasePath, "module.e"),
					dependencies: [
						{
							id: "module.d",
							version: "1.0.0",
							path: path.join(cycleDepsBasePath, "module.d"),
							dependencies: [],
							deduped: true
						}
					]
				}
			]
		},
		{
			id: "module.e",
			version: "1.0.0",
			path: path.join(cycleDepsBasePath, "module.e"),
			dependencies: [
				{
					id: "module.d",
					version: "1.0.0",
					path: path.join(cycleDepsBasePath, "module.d"),
					dependencies: [
						{
							id: "module.e",
							version: "1.0.0",
							path: path.join(cycleDepsBasePath, "module.e"),
							dependencies: [],
							deduped: true
						}
					]
				}
			]
		}
	]
};
