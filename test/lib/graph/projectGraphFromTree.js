const test = require("ava");
const path = require("path");
const sinonGlobal = require("sinon");
const mock = require("mock-require");
const logger = require("@ui5/logger");
const ValidationError = require("../../../lib/validation/ValidationError");

const applicationAPath = path.join(__dirname, "..", "..", "fixtures", "application.a");
const applicationBPath = path.join(__dirname, "..", "..", "fixtures", "application.b");
const applicationCPath = path.join(__dirname, "..", "..", "fixtures", "application.c");
const libraryAPath = path.join(__dirname, "..", "..", "fixtures", "collection", "library.a");
const libraryBPath = path.join(__dirname, "..", "..", "fixtures", "collection", "library.b");
// const libraryCPath = path.join(__dirname, "..", "..", "fixtures", "collection", "library.c");
const libraryDPath = path.join(__dirname, "..", "..", "fixtures", "library.d");
const cycleDepsBasePath = path.join(__dirname, "..", "..", "fixtures", "cyclic-deps", "node_modules");
const pathToInvalidModule = path.join(__dirname, "..", "..", "fixtures", "invalidModule");

const legacyLibraryAPath = path.join(__dirname, "..", "fixtures", "legacy.library.a");
const legacyLibraryBPath = path.join(__dirname, "..", "fixtures", "legacy.library.b");
const legacyCollectionAPath = path.join(__dirname, "..", "fixtures", "legacy.collection.a");
const legacyCollectionLibraryX = path.join(__dirname, "..", "fixtures", "legacy.collection.a",
	"src", "legacy.library.x");
const legacyCollectionLibraryY = path.join(__dirname, "..", "fixtures", "legacy.collection.a",
	"src", "legacy.library.y");

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
		.withArgs("graph:projectGraphFromTree").returns(t.context.log);
	t.context.projectGraphFromTree = mock.reRequire("../../../lib/graph/projectGraphFromTree");
	logger.getLogger.restore(); // Immediately restore global stub for following tests
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
});

test("Application A", async (t) => {
	const {projectGraphFromTree} = t.context;
	const projectGraph = await projectGraphFromTree(applicationATree);
	const rootProject = projectGraph.getRoot();
	t.is(rootProject.getName(), "application.a", "Returned correct root project");
});

test("Application A: Traverse project graph breadth first", async (t) => {
	const {projectGraphFromTree} = t.context;
	const projectGraph = await projectGraphFromTree(applicationATree);
	const callbackStub = t.context.sinon.stub().resolves();
	await projectGraph.traverseBreadthFirst(callbackStub);

	t.is(callbackStub.callCount, 5, "Five projects have been visited");

	const callbackCalls = callbackStub.getCalls().map((call) => call.args[0].project.getName());

	t.deepEqual(callbackCalls, [
		"application.a",
		"library.d",
		"library.a",
		"library.b",
		"library.c"
	], "Traversed graph in correct order");
});

test("Application Cycle A: Traverse project graph breadth first with cycles", async (t) => {
	const {projectGraphFromTree} = t.context;
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
	const {projectGraphFromTree} = t.context;
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
	const {projectGraphFromTree} = t.context;
	const projectGraph = await projectGraphFromTree(applicationATree);
	const callbackStub = t.context.sinon.stub().resolves();
	await projectGraph.traverseDepthFirst(callbackStub);

	t.is(callbackStub.callCount, 5, "Five projects have been visited");

	const callbackCalls = callbackStub.getCalls().map((call) => call.args[0].project.getName());

	t.deepEqual(callbackCalls, [
		"library.a",
		"library.b",
		"library.c",
		"library.d",
		"application.a",

	], "Traversed graph in correct order");
});


test("Application Cycle A: Traverse project graph depth first with cycles", async (t) => {
	const {projectGraphFromTree} = t.context;
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
	const {projectGraphFromTree} = t.context;
	const projectGraph = await projectGraphFromTree(applicationCycleBTreeIncDeduped);
	const callbackStub = t.context.sinon.stub().resolves();
	const error = await t.throwsAsync(projectGraph.traverseDepthFirst(callbackStub));

	t.is(callbackStub.callCount, 0, "Zero projects have been visited");

	t.is(error.message,
		"Detected cyclic dependency chain: application.cycle.b -> module.d* " +
		"-> module.e -> module.d*",
		"Threw with expected error message");
});


/* ================================================================================================= */
/* ======= The following tests have been derived from the existing projectPreprocessor tests ======= */

function testBasicGraphCreationBfs(...args) {
	return _testBasicGraphCreation(...args, true);
}

function testBasicGraphCreationDfs(...args) {
	return _testBasicGraphCreation(...args, false);
}

async function _testBasicGraphCreation(t, tree, expectedOrder, bfs) {
	if (bfs === undefined) {
		throw new Error("Test error: Parameter 'bfs' must be specified");
	}
	const {projectGraphFromTree} = t.context;
	const projectGraph = await projectGraphFromTree(tree);
	const callbackStub = t.context.sinon.stub().resolves();
	if (bfs) {
		await projectGraph.traverseBreadthFirst(callbackStub);
	} else {
		await projectGraph.traverseDepthFirst(callbackStub);
	}

	t.is(callbackStub.callCount, expectedOrder.length, "Correct number of projects have been visited");

	const callbackCalls = callbackStub.getCalls().map((call) => call.args[0].project.getName());

	t.deepEqual(callbackCalls, expectedOrder, "Traversed graph in correct order");
	return projectGraph;
}

test("Project with inline configuration", async (t) => {
	const tree = {
		id: "application.a.id",
		path: applicationAPath,
		dependencies: [],
		version: "1.0.0",
		configuration: {
			specVersion: "2.3",
			type: "application",
			metadata: {
				name: "xy"
			}
		}
	};

	await testBasicGraphCreationDfs(t, tree, [
		"xy"
	]);
});


test("Project with inline configuration as array", async (t) => {
	const tree = {
		id: "application.a.id",
		path: applicationAPath,
		dependencies: [],
		version: "1.0.0",
		configuration: [{
			specVersion: "2.3",
			type: "application",
			metadata: {
				name: "xy"
			}
		}]
	};

	await testBasicGraphCreationDfs(t, tree, [
		"xy"
	]);
});

test("Project with inline configuration for two projects", async (t) => {
	const tree = {
		id: "application.a.id",
		path: applicationAPath,
		dependencies: [],
		version: "1.0.0",
		configuration: [{
			specVersion: "2.3",
			type: "application",
			metadata: {
				name: "xy"
			}
		}, {
			specVersion: "2.3",
			type: "library",
			metadata: {
				name: "yz"
			}
		}]
	};

	const {projectGraphFromTree} = t.context;
	await t.throwsAsync(projectGraphFromTree(tree),
		{
			message:
				"Invalid configuration for module application.a.id: Per module there " +
				"must be no more than one configuration of kind 'project'"
		},
		"Rejected with error");
});

test("Project with configPath", async (t) => {
	const tree = {
		id: "application.a.id",
		path: applicationAPath,
		configPath: path.join(applicationBPath, "ui5.yaml"), // B, not A - just to have something different
		dependencies: [],
		version: "1.0.0"
	};

	await testBasicGraphCreationDfs(t, tree, [
		"application.b"
	]);
});

test("Project with ui5.yaml at default location", async (t) => {
	const tree = {
		id: "application.a.id",
		version: "1.0.0",
		path: applicationAPath,
		dependencies: []
	};

	await testBasicGraphCreationDfs(t, tree, [
		"application.a"
	]);
});

test("Project with ui5.yaml at default location and some configuration", async (t) => {
	const tree = {
		id: "application.c",
		version: "1.0.0",
		path: applicationCPath,
		dependencies: []
	};

	await testBasicGraphCreationDfs(t, tree, [
		"application.c"
	]);
});

test("Missing configuration file for root project", async (t) => {
	const {projectGraphFromTree} = t.context;
	const tree = {
		id: "application.a.id",
		version: "1.0.0",
		path: "non-existent",
		dependencies: []
	};
	await t.throwsAsync(projectGraphFromTree(tree),
		{
			message:
				"Failed to crate a UI5 project from module application.a.id at non-existent. " +
				"Make sure the path is correct and a project configuration is present or supplied."
		},
		"Rejected with error");
});

test("Missing id for root project", async (t) => {
	const {projectGraphFromTree} = t.context;
	const tree = {
		path: path.join(__dirname, "../fixtures/application.a"),
		dependencies: []
	};
	await t.throwsAsync(projectGraphFromTree(tree),
		{message: "Could not create Module: Missing or empty parameter 'id'"}, "Rejected with error");
});

test("No type configured for root project", async (t) => {
	const {projectGraphFromTree} = t.context;
	const tree = {
		id: "application.a.id",
		version: "1.0.0",
		path: path.join(__dirname, "../fixtures/application.a"),
		dependencies: [],
		configuration: {
			specVersion: "2.1",
			metadata: {
				name: "application.a",
				namespace: "id1"
			}
		}
	};
	const error = await t.throwsAsync(projectGraphFromTree(tree));

	t.is(error.message, `Invalid ui5.yaml configuration for project application.a.id

Configuration must have required property 'type'`,
	"Rejected with expected error");
});

test("Missing dependencies", async (t) => {
	const {projectGraphFromTree} = t.context;
	const tree = ({
		id: "application.a.id",
		version: "1.0.0",
		path: applicationAPath
	});
	await t.notThrowsAsync(projectGraphFromTree(tree),
		"Gracefully accepted project with no dependencies attribute");
});

test("Missing second-level dependencies", async (t) => {
	const {projectGraphFromTree} = t.context;
	const tree = ({
		id: "application.a.id",
		version: "1.0.0",
		path: applicationAPath,
		dependencies: [{
			id: "library.d.id",
			version: "1.0.0",
			path: path.join(applicationAPath, "node_modules", "library.d")
		}]
	});
	return t.notThrowsAsync(projectGraphFromTree(tree),
		"Gracefully accepted project with no dependencies attribute");
});

test("Single non-root application-project", async (t) => {
	const tree = ({
		id: "library.a",
		version: "1.0.0",
		path: libraryAPath,
		dependencies: [{
			id: "application.a.id",
			version: "1.0.0",
			path: applicationAPath,
			dependencies: []
		}]
	});

	await testBasicGraphCreationDfs(t, tree, [
		"application.a",
		"library.a"
	]);
});

test("Multiple non-root application-projects on same level", async (t) => {
	const {log} = t.context;
	const tree = ({
		id: "library.a",
		version: "1.0.0",
		path: libraryAPath,
		dependencies: [{
			id: "application.a",
			version: "1.0.0",
			path: applicationAPath,
			dependencies: []
		}, {
			id: "application.b",
			version: "1.0.0",
			path: applicationBPath,
			dependencies: []
		}]
	});

	await testBasicGraphCreationDfs(t, tree, [
		"application.a",
		"library.a"
	]);

	t.is(log.info.callCount, 1, "log.info should be called once");
	t.is(log.info.getCall(0).args[0],
		`Excluding additional application project application.b from graph. `+
		`The project graph can only feature a single project of type application. ` +
		`Project application.a has already qualified for that role.`,
		"log.info should be called once with the expected argument");
});

test("Multiple non-root application-projects on different levels", async (t) => {
	const {log} = t.context;
	const tree = ({
		id: "library.a",
		version: "1.0.0",
		path: libraryAPath,
		dependencies: [{
			id: "application.a",
			version: "1.0.0",
			path: applicationAPath,
			dependencies: []
		}, {
			id: "library.b",
			version: "1.0.0",
			path: libraryBPath,
			dependencies: [{
				id: "application.b",
				version: "1.0.0",
				path: applicationBPath,
				dependencies: []
			}]
		}]
	});

	await testBasicGraphCreationDfs(t, tree, [
		"application.a",
		"library.b",
		"library.a"
	]);

	t.is(log.info.callCount, 1, "log.info should be called once");
	t.is(log.info.getCall(0).args[0],
		`Excluding additional application project application.b from graph. `+
		`The project graph can only feature a single project of type application. ` +
		`Project application.a has already qualified for that role.`,
		"log.info should be called once with the expected argument");
});

test("Root- and non-root application-projects", async (t) => {
	const {log} = t.context;
	const tree = ({
		id: "application.a",
		version: "1.0.0",
		path: applicationAPath,
		dependencies: [{
			id: "library.a",
			version: "1.0.0",
			path: libraryAPath,
			dependencies: [{
				id: "application.b",
				version: "1.0.0",
				path: applicationBPath,
				dependencies: []
			}]
		}]
	});
	await testBasicGraphCreationDfs(t, tree, [
		"library.a",
		"application.a",
	]);

	t.is(log.info.callCount, 1, "log.info should be called once");
	t.is(log.info.getCall(0).args[0],
		`Excluding additional application project application.b from graph. `+
		`The project graph can only feature a single project of type application. ` +
		`Project application.a has already qualified for that role.`,
		"log.info should be called once with the expected argument");
});

test("Ignores additional application-projects", async (t) => {
	const {log} = t.context;
	const tree = ({
		id: "application.a",
		version: "1.0.0",
		path: applicationAPath,
		dependencies: [{
			id: "application.b",
			version: "1.0.0",
			path: applicationBPath,
			dependencies: []
		}]
	});
	await testBasicGraphCreationDfs(t, tree, [
		"application.a",
	]);

	t.is(log.info.callCount, 1, "log.info should be called once");
	t.is(log.info.getCall(0).args[0],
		`Excluding additional application project application.b from graph. `+
		`The project graph can only feature a single project of type application. ` +
		`Project application.a has already qualified for that role.`,
		"log.info should be called once with the expected argument");
});

test("Inconsistent dependencies with same ID", async (t) => {
	// The one closer to the root should win
	const tree = {
		id: "application.a",
		version: "1.0.0",
		specVersion: "2.3",
		path: applicationAPath,
		type: "application",
		metadata: {
			name: "application.a"
		},
		dependencies: [
			{
				id: "library.d",
				version: "1.0.0",
				specVersion: "2.3",
				path: libraryDPath,
				type: "library",
				metadata: {
					name: "library.d",
				},
				resources: {
					configuration: {
						propertiesFileSourceEncoding: "UTF-8",
						paths: {
							src: "main/src",
							test: "main/test"
						}
					}
				},
				dependencies: [
					{
						id: "library.a",
						version: "1.0.0",
						specVersion: "2.3",
						path: libraryBPath, // B, not A - inconsistency!
						configuration: {
							specVersion: "2.3",
							type: "library",
							metadata: {
								name: "library.XY",
							}
						},
						dependencies: []
					}
				]
			},
			{
				id: "library.a",
				version: "1.0.0",
				specVersion: "2.3",
				path: libraryAPath,
				type: "library",
				metadata: {
					name: "library.a",
				},
				dependencies: []
			}
		]
	};
	await testBasicGraphCreationDfs(t, tree, [
		// "library.XY" is ignored since the ID has already been processed and resolved to library A
		"library.a",
		"library.d",
		"application.a"
	]);
});

test("Project tree A with inline configs depth first", async (t) => {
	await testBasicGraphCreationDfs(t, applicationATreeWithInlineConfigs, [
		"library.a",
		"library.d",
		"application.a"
	]);
});

test("Project tree A with configPaths depth first", async (t) => {
	await testBasicGraphCreationDfs(t, applicationATreeWithConfigPaths, [
		"library.a",
		"library.d",
		"application.a"

	]);
});

test("Project tree A with default YAMLs depth first", async (t) => {
	await testBasicGraphCreationDfs(t, applicationATreeWithDefaultYamls, [
		"library.a",
		"library.d",
		"application.a"
	]);
});

test("Project tree A with inline configs breadth first", async (t) => {
	await testBasicGraphCreationBfs(t, applicationATreeWithInlineConfigs, [
		"application.a",
		"library.d",
		"library.a",
	]);
});

test("Project tree A with configPaths breadth first", async (t) => {
	await testBasicGraphCreationBfs(t, applicationATreeWithConfigPaths, [
		"application.a",
		"library.d",
		"library.a"

	]);
});

test("Project tree A with default YAMLs breadth first", async (t) => {
	await testBasicGraphCreationBfs(t, applicationATreeWithDefaultYamls, [
		"application.a",
		"library.d",
		"library.a"
	]);
});

test("Project tree B with inline configs", async (t) => {
	// Tree B depends on Library B which has a dependency to Library D
	await testBasicGraphCreationDfs(t, applicationBTreeWithInlineConfigs, [
		"library.a",
		"library.d",
		"library.b",
		"application.b"
	]);
});

test("Project with nested invalid dependencies", async (t) => {
	await testBasicGraphCreationDfs(t, treeWithInvalidModules, [
		"library.a",
		"library.b",
		"application.a"
	]);
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


/* === Tree A === */
const applicationATreeWithInlineConfigs = {
	id: "application.a",
	version: "1.0.0",
	path: applicationAPath,
	configuration: {
		specVersion: "2.3",
		type: "application",
		metadata: {
			name: "application.a",
		},
	},
	dependencies: [
		{
			id: "library.d",
			version: "1.0.0",
			path: libraryDPath,
			configuration: {
				specVersion: "2.3",
				type: "library",
				metadata: {
					name: "library.d",
				},
			},
			resources: {
				configuration: {
					propertiesFileSourceEncoding: "UTF-8",
					paths: {
						src: "main/src",
						test: "main/test"
					}
				}
			},
			dependencies: [
				{
					id: "library.a",
					version: "1.0.0",
					path: libraryAPath,
					configuration: {
						specVersion: "2.3",
						type: "library",
						metadata: {
							name: "library.a",
						},
					},
					dependencies: []
				}
			]
		},
		{
			id: "library.a",
			version: "1.0.0",
			path: libraryAPath,
			configuration: {
				specVersion: "2.3",
				type: "library",
				metadata: {
					name: "library.a"
				},
			},
			dependencies: []
		}
	]
};

const applicationATreeWithConfigPaths = {
	id: "application.a",
	version: "1.0.0",
	path: applicationAPath,
	configPath: path.join(applicationAPath, "ui5.yaml"),
	dependencies: [
		{
			id: "library.d",
			version: "1.0.0",
			path: libraryDPath,
			configPath: path.join(libraryDPath, "ui5.yaml"),
			dependencies: [
				{
					id: "library.a",
					version: "1.0.0",
					path: libraryAPath,
					configPath: path.join(libraryAPath, "ui5.yaml"),
					dependencies: []
				}
			]
		},
		{
			id: "library.a",
			version: "1.0.0",
			path: libraryAPath,
			configPath: path.join(libraryAPath, "ui5.yaml"),
			dependencies: []
		}
	]
};

const applicationATreeWithDefaultYamls = {
	id: "application.a",
	version: "1.0.0",
	path: applicationAPath,
	dependencies: [
		{
			id: "library.d",
			version: "1.0.0",
			path: libraryDPath,
			dependencies: [
				{
					id: "library.a",
					version: "1.0.0",
					path: libraryAPath,
					dependencies: []
				}
			]
		},
		{
			id: "library.a",
			version: "1.0.0",
			path: libraryAPath,
			dependencies: []
		}
	]
};

/* === Tree B === */
const applicationBTreeWithInlineConfigs = {
	id: "application.b",
	version: "1.0.0",
	path: applicationBPath,
	configuration: {
		specVersion: "2.3",
		type: "application",
		metadata: {
			name: "application.b"
		}
	},
	dependencies: [
		{
			id: "library.b",
			version: "1.0.0",
			path: libraryBPath,
			configuration: {
				specVersion: "2.3",
				type: "library",
				metadata: {
					name: "library.b",
				}
			},
			dependencies: [
				{
					id: "library.d",
					version: "1.0.0",
					path: libraryDPath,
					configuration: {
						specVersion: "2.3",
						type: "library",
						metadata: {
							name: "library.d",
						},
						resources: {
							configuration: {
								propertiesFileSourceEncoding: "UTF-8",
								paths: {
									src: "main/src",
									test: "main/test"
								}
							}
						}
					},
					dependencies: [
						{
							id: "library.a",
							version: "1.0.0",
							path: libraryAPath,
							configuration: {
								specVersion: "2.3",
								type: "library",
								metadata: {
									name: "library.a"
								}
							},
							dependencies: []
						}
					]
				}
			]
		},
		{
			id: "library.d",
			version: "1.0.0",
			path: libraryDPath,
			configuration: {
				specVersion: "2.3",
				type: "library",
				metadata: {
					name: "library.d",
				},
				resources: {
					configuration: {
						propertiesFileSourceEncoding: "UTF-8",
						paths: {
							src: "main/src",
							test: "main/test"
						}
					}
				}
			},
			dependencies: [
				{
					id: "library.a",
					version: "1.0.0",
					path: libraryAPath,
					configuration: {
						specVersion: "2.3",
						type: "library",
						metadata: {
							name: "library.a"
						}
					},
					dependencies: []
				}
			]
		}
	]
};

/* === Invalid Modules */
const treeWithInvalidModules = {
	id: "application.a",
	path: applicationAPath,
	dependencies: [
		// A
		{
			id: "library.a",
			path: libraryAPath,
			dependencies: [
				{
					// C - invalid - should be missing in preprocessed tree
					id: "module.c",
					dependencies: [],
					path: pathToInvalidModule,
					version: "1.0.0"
				},
				{
					// D - invalid - should be missing in preprocessed tree
					id: "module.d",
					dependencies: [],
					path: pathToInvalidModule,
					version: "1.0.0"
				}
			],
			version: "1.0.0",
			configuration: {
				specVersion: "2.3",
				type: "library",
				metadata: {name: "library.a"}
			}
		},
		// B
		{
			id: "library.b",
			path: libraryBPath,
			dependencies: [
				{
					// C - invalid - should be missing in preprocessed tree
					id: "module.c",
					dependencies: [],
					path: pathToInvalidModule,
					version: "1.0.0"
				},
				{
					// D - invalid - should be missing in preprocessed tree
					id: "module.d",
					dependencies: [],
					path: pathToInvalidModule,
					version: "1.0.0"
				}
			],
			version: "1.0.0",
			configuration: {
				specVersion: "2.3",
				type: "library",
				metadata: {name: "library.b"}
			}
		}
	],
	version: "1.0.0",
	configuration: {
		specVersion: "2.3",
		type: "application",
		metadata: {
			name: "application.a"
		}
	}
};

/* ======================================================================================= */
/* ======= The following tests have been derived from the existing extension tests ======= */

/* The following scenario is supported by the projectPreprocessor but not by projectGraphFromTree
 * A shim extension located in a project's dependencies can't influence other dependencies of that project anymore
 * TODO: Check whether the above is fine for us

test.only("Legacy: Project with project-shim extension with dependency configuration", async (t) => {
	const tree = {
		id: "application.a.id",
		path: applicationAPath,
		version: "1.0.0",
		configuration: {
			specVersion: "2.3",
			type: "application",
			metadata: {
				name: "application.a"
			}
		},
		dependencies: [{
			id: "extension.a.id",
			path: applicationAPath,
			version: "1.0.0",
			dependencies: [],
			configuration: {
				specVersion: "2.3",
				kind: "extension",
				type: "project-shim",
				metadata: {
					name: "shim.a"
				},
				shims: {
					configurations: {
						"legacy.library.a.id": {
							specVersion: "2.3",
							type: "library",
							metadata: {
								name: "legacy.library.a",
							}
						}
					}
				}
			}
		}, {
			id: "legacy.library.a.id",
			version: "1.0.0",
			path: legacyLibraryAPath,
			dependencies: []
		}]
	};
	await testBasicGraphCreationDfs(t, tree, [
		"legacy.library.a",
		"application.a",
	]);
});*/

test("Project with project-shim extension with dependency configuration", async (t) => {
	const tree = {
		id: "application.a.id",
		path: applicationAPath,
		version: "1.0.0",
		configuration: [{
			specVersion: "2.3",
			type: "application",
			metadata: {
				name: "application.a"
			}
		}, {
			specVersion: "2.3",
			kind: "extension",
			type: "project-shim",
			metadata: {
				name: "shim.a"
			},
			shims: {
				configurations: {
					"legacy.library.a.id": {
						specVersion: "2.3",
						type: "library",
						metadata: {
							name: "legacy.library.a",
						}
					}
				}
			}
		}],
		dependencies: [{
			id: "legacy.library.a.id",
			version: "1.0.0",
			path: legacyLibraryAPath,
			dependencies: []
		}]
	};
	await testBasicGraphCreationDfs(t, tree, [
		"legacy.library.a",
		"application.a",
	]);
});

test("Project with project-shim extension dependency with dependency configuration", async (t) => {
	const tree = {
		id: "application.a.id",
		path: applicationAPath,
		version: "1.0.0",
		configuration: {
			specVersion: "2.3",
			type: "application",
			metadata: {
				name: "application.a"
			}
		},
		dependencies: [{
			id: "extension.a.id",
			path: applicationAPath,
			version: "1.0.0",
			configuration: {
				specVersion: "2.3",
				kind: "extension",
				type: "project-shim",
				metadata: {
					name: "shim.a"
				},
				shims: {
					configurations: {
						"legacy.library.a.id": {
							specVersion: "2.3",
							type: "library",
							metadata: {
								name: "legacy.library.a",
							}
						}
					}
				}
			},
			dependencies: [{
				id: "legacy.library.a.id",
				version: "1.0.0",
				path: legacyLibraryAPath,
				dependencies: []
			}],
		}]
	};
	await testBasicGraphCreationDfs(t, tree, [
		"legacy.library.a",
		"application.a",
	]);

	const {log} = t.context;
	t.is(log.warn.callCount, 0, "log.warn should not have been called");
	t.is(log.info.callCount, 0, "log.info should not have been called");
});

test("Project with project-shim extension with invalid dependency configuration", async (t) => {
	const tree = {
		id: "application.a.id",
		path: applicationAPath,
		version: "1.0.0",
		configuration: [{
			specVersion: "2.3",
			type: "application",
			metadata: {
				name: "xy"
			}
		}, {
			specVersion: "2.3",
			kind: "extension",
			type: "project-shim",
			metadata: {
				name: "shims.a"
			},
			shims: {
				configurations: {
					"legacy.library.a.id": {
						specVersion: "2.3",
						type: "library"
					}
				}
			}
		}],
		dependencies: [{
			id: "legacy.library.a.id",
			version: "1.0.0",
			path: legacyLibraryAPath,
			dependencies: []
		}]
	};
	const {projectGraphFromTree} = t.context;
	const validationError = await t.throwsAsync(projectGraphFromTree(tree), {
		instanceOf: ValidationError
	});
	t.true(validationError.message.includes("Configuration must have required property 'metadata'"),
		"ValidationError should contain error about missing metadata configuration");
});

test("Project with project-shim extension with dependency declaration and configuration", async (t) => {
	const tree = {
		id: "application.a.id",
		path: applicationAPath,
		version: "1.0.0",
		configuration: {
			specVersion: "2.3",
			type: "application",
			metadata: {
				name: "application.a"
			}
		},
		dependencies: [{
			id: "extension.a.id",
			path: applicationAPath,
			version: "1.0.0",
			configuration: {
				specVersion: "2.3",
				kind: "extension",
				type: "project-shim",
				metadata: {
					name: "shims.a"
				},
				shims: {
					configurations: {
						"legacy.library.a.id": {
							specVersion: "2.3",
							type: "library",
							metadata: {
								name: "legacy.library.a",
							}
						},
						"legacy.library.b.id": {
							specVersion: "2.3",
							type: "library",
							metadata: {
								name: "legacy.library.b",
							}
						}
					},
					dependencies: {
						"legacy.library.a.id": [
							"legacy.library.b.id"
						]
					}
				}
			},
			dependencies: [{
				id: "legacy.library.a.id",
				version: "1.0.0",
				path: legacyLibraryAPath,
				dependencies: []
			}, {
				id: "legacy.library.b.id",
				version: "1.0.0",
				path: legacyLibraryBPath,
				dependencies: []
			}],
		}]
	};
	// application.a and legacy.library.a will both have a dependency to legacy.library.b
	//	(one because it's the actual dependency and one because it's a shimmed dependency)
	const graph = await testBasicGraphCreationDfs(t, tree, [
		"legacy.library.b",
		"legacy.library.a",
		"application.a",
	]);
	t.deepEqual(graph.getDependencies("legacy.library.a"), [
		"legacy.library.b"
	], "Shimmed dependencies should be applied");

	const {log} = t.context;
	t.is(log.warn.callCount, 0, "log.warn should not have been called");
	t.is(log.info.callCount, 0, "log.info should not have been called");
});

test("Project with project-shim extension with collection", async (t) => {
	const tree = {
		id: "application.a.id",
		path: applicationAPath,
		version: "1.0.0",
		configuration: {
			specVersion: "2.3",
			type: "application",
			metadata: {
				name: "application.a"
			}
		},
		dependencies: [{
			id: "extension.a.id",
			path: applicationAPath,
			version: "1.0.0",
			configuration: {
				specVersion: "2.3",
				kind: "extension",
				type: "project-shim",
				metadata: {
					name: "shims.a"
				},
				shims: {
					configurations: {
						"legacy.library.x.id": {
							specVersion: "2.3",
							type: "library",
							metadata: {
								name: "legacy.library.x",
							}
						},
						"legacy.library.y.id": {
							specVersion: "2.3",
							type: "library",
							metadata: {
								name: "legacy.library.y",
							}
						}
					},
					dependencies: {
						"application.a.id": [
							"legacy.library.x.id",
							"legacy.library.y.id"
						],
						"legacy.library.x.id": [
							"legacy.library.y.id"
						]
					},
					collections: {
						"legacy.collection.a": {
							modules: {
								"legacy.library.x.id": "src/legacy.library.x",
								"legacy.library.y.id": "src/legacy.library.y"
							}
						}
					}
				}
			},
			dependencies: [{
				id: "legacy.collection.a",
				version: "1.0.0",
				path: legacyCollectionAPath,
				dependencies: []
			}]
		}]
	};

	const graph = await testBasicGraphCreationDfs(t, tree, [
		"legacy.library.y",
		"legacy.library.x",
		"application.a",
	]);
	t.deepEqual(graph.getDependencies("application.a"), [
		"legacy.library.x",
		"legacy.library.y"
	], "Shimmed dependencies should be applied");

	const {log} = t.context;
	t.is(log.warn.callCount, 0, "log.warn should not have been called");
	t.is(log.info.callCount, 0, "log.info should not have been called");
});

test("Project with unknown extension dependency inline configuration", async (t) => {
	const tree = {
		id: "application.a",
		path: applicationAPath,
		version: "1.0.0",
		configuration: {
			specVersion: "2.3",
			type: "application",
			metadata: {
				name: "xy"
			}
		},
		dependencies: [{
			id: "extension.a",
			path: applicationAPath,
			version: "1.0.0",
			configuration: {
				specVersion: "2.3",
				kind: "extension",
				type: "phony-pony",
				metadata: {
					name: "pinky.pie"
				}
			},
			dependencies: [],
		}],
	};
	const {projectGraphFromTree} = t.context;
	const validationError = await t.throwsAsync(projectGraphFromTree(tree), {
		instanceOf: ValidationError
	});
	t.true(validationError.message.includes("Configuration type must be equal to one of the allowed value"),
		"ValidationError should contain error about missing metadata configuration");
});

test("Project with task extension dependency", async (t) => {
	const tree = {
		id: "application.a.id",
		path: applicationAPath,
		version: "1.0.0",
		configuration: {
			specVersion: "2.3",
			type: "application",
			metadata: {
				name: "application.a"
			}
		},
		dependencies: [{
			id: "ext.task.a",
			path: applicationAPath,
			version: "1.0.0",
			configuration: {
				specVersion: "2.3",
				kind: "extension",
				type: "task",
				metadata: {
					name: "task.a"
				},
				task: {
					path: "task.a.js"
				}
			},
			dependencies: [],
		}]
	};
	const graph = await testBasicGraphCreationDfs(t, tree, [
		"application.a"
	]);
	t.truthy(graph.getExtension("task.a"), "Extension should be added to the graph");
});

test("Project with middleware extension dependency", async (t) => {
	const tree = {
		id: "application.a.id",
		path: applicationAPath,
		version: "1.0.0",
		configuration: {
			specVersion: "2.3",
			type: "application",
			metadata: {
				name: "application.a"
			}
		},
		dependencies: [{
			id: "ext.middleware.a",
			path: applicationAPath,
			version: "1.0.0",
			configuration: {
				specVersion: "2.3",
				kind: "extension",
				type: "server-middleware",
				metadata: {
					name: "middleware.a"
				},
				middleware: {
					path: "middleware.a.js"
				}
			},
			dependencies: [],
		}],
	};
	const graph = await testBasicGraphCreationDfs(t, tree, [
		"application.a"
	]);
	t.truthy(graph.getExtension("middleware.a"), "Extension should be added to the graph");
});
