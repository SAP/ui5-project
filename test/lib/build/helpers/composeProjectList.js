const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");
const path = require("path");
const logger = require("@ui5/logger");
const generateProjectGraph = require("../../../../lib/generateProjectGraph");

const applicationAPath = path.join(__dirname, "..", "..", "..", "fixtures", "application.a");
const libraryEPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.e");
const libraryFPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.f");
const libraryGPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.g");
const libraryDDependerPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.d-depender");

test.beforeEach((t) => {
	t.context.log = {
		warn: sinon.stub()
	};
	sinon.stub(logger, "getLogger").callThrough()
		.withArgs("build:helpers:composeProjectList").returns(t.context.log);
	t.context.composeProjectList = mock.reRequire("../../../../lib/build/helpers/composeProjectList");
});

test.afterEach.always((t) => {
	sinon.restore();
	mock.stopAll();
});

test.serial("_getFlattenedDependencyTree", async (t) => {
	const {_getFlattenedDependencyTree} = t.context.composeProjectList;
	const tree = { // Does not reflect actual dependencies in fixtures
		id: "application.a.id",
		version: "1.0.0",
		path: applicationAPath,
		dependencies: [{
			id: "library.e.id",
			version: "1.0.0",
			path: libraryEPath,
			dependencies: [{
				id: "library.d.id",
				version: "1.0.0",
				path: path.join(applicationAPath, "node_modules", "library.d"),
				dependencies: [{
					id: "library.a.id",
					version: "1.0.0",
					path: path.join(applicationAPath, "node_modules", "collection", "library.a"),
					dependencies: [{
						id: "library.b.id",
						version: "1.0.0",
						path: path.join(applicationAPath, "node_modules", "collection", "library.b"),
						dependencies: []
					}, {
						id: "library.c.id",
						version: "1.0.0",
						path: path.join(applicationAPath, "node_modules", "collection", "library.c"),
						dependencies: []
					}]
				}]
			}]
		}, {
			id: "library.f.id",
			version: "1.0.0",
			path: libraryFPath,
			dependencies: [{
				id: "library.a.id",
				version: "1.0.0",
				path: path.join(applicationAPath, "node_modules", "collection", "library.a"),
				dependencies: [{
					id: "library.b.id",
					version: "1.0.0",
					path: path.join(applicationAPath, "node_modules", "collection", "library.b"),
					dependencies: []
				}, {
					id: "library.c.id",
					version: "1.0.0",
					path: path.join(applicationAPath, "node_modules", "collection", "library.c"),
					dependencies: []
				}]
			}]
		}]
	};
	const graph = await generateProjectGraph.usingObject({dependencyTree: tree});

	t.deepEqual(await _getFlattenedDependencyTree(graph), {
		"library.e": ["library.d", "library.a", "library.b", "library.c"],
		"library.f": ["library.a", "library.b", "library.c"],
		"library.d": ["library.a", "library.b", "library.c"],
		"library.a": ["library.b", "library.c"],
		"library.b": [],
		"library.c": []
	});
});

async function assertCreateDependencyLists(t, {
	includeAllDependencies,
	includeDependency, includeDependencyRegExp, includeDependencyTree,
	excludeDependency, excludeDependencyRegExp, excludeDependencyTree,
	defaultIncludeDependency, defaultIncludeDependencyRegExp, defaultIncludeDependencyTree,
	expectedIncludedDependencies, expectedExcludedDependencies
}) {
	const tree = { // Does not reflect actual dependencies in fixtures
		id: "application.a.id",
		version: "1.0.0",
		path: applicationAPath,
		dependencies: [{
			id: "library.e.id",
			version: "1.0.0",
			path: libraryEPath,
			dependencies: [{
				id: "library.d.id",
				version: "1.0.0",
				path: path.join(applicationAPath, "node_modules", "library.d"),
				dependencies: []
			}, {
				id: "library.a.id",
				version: "1.0.0",
				path: path.join(applicationAPath, "node_modules", "collection", "library.a"),
				dependencies: [{
					id: "library.b.id",
					version: "1.0.0",
					path: path.join(applicationAPath, "node_modules", "collection", "library.b"),
					dependencies: []
				}]
			}]
		}, {
			id: "library.f.id",
			version: "1.0.0",
			path: libraryFPath,
			dependencies: [{
				id: "library.d.id",
				version: "1.0.0",
				path: path.join(applicationAPath, "node_modules", "library.d"),
				dependencies: []
			}, {
				id: "library.a.id",
				version: "1.0.0",
				path: path.join(applicationAPath, "node_modules", "collection", "library.a"),
				dependencies: [{
					id: "library.b.id",
					version: "1.0.0",
					path: path.join(applicationAPath, "node_modules", "collection", "library.b"),
					dependencies: []
				}]
			}, {
				id: "library.c.id",
				version: "1.0.0",
				path: path.join(applicationAPath, "node_modules", "collection", "library.c"),
				dependencies: []
			}]
		}, {
			id: "library.g.id",
			version: "1.0.0",
			path: libraryGPath,
			dependencies: [{
				id: "library.d-depender.id",
				version: "1.0.0",
				path: libraryDDependerPath,
				dependencies: []
			}]
		}]
	};

	const graph = await generateProjectGraph.usingObject({dependencyTree: tree});

	const {includedDependencies, excludedDependencies} = await t.context.composeProjectList(graph, {
		includeAllDependencies,
		includeDependency,
		includeDependencyRegExp,
		includeDependencyTree,
		excludeDependency,
		excludeDependencyRegExp,
		excludeDependencyTree,
		defaultIncludeDependency,
		defaultIncludeDependencyRegExp,
		defaultIncludeDependencyTree
	});
	t.deepEqual(includedDependencies, expectedIncludedDependencies, "Correct set of included dependencies");
	t.deepEqual(excludedDependencies, expectedExcludedDependencies, "Correct set of excluded dependencies");
}

test.serial("createDependencyLists: only includes", async (t) => {
	await assertCreateDependencyLists(t, {
		includeAllDependencies: false,
		includeDependency: ["library.f", "library.c"],
		includeDependencyRegExp: ["^library\\.d$"],
		includeDependencyTree: ["library.g"],
		expectedIncludedDependencies: ["library.f", "library.c", "library.d", "library.g", "library.d-depender"],
		expectedExcludedDependencies: []
	});
});

test.serial("createDependencyLists: only excludes", async (t) => {
	await assertCreateDependencyLists(t, {
		includeAllDependencies: false,
		excludeDependency: ["library.f", "library.c"],
		excludeDependencyRegExp: ["^library\\.d$"],
		excludeDependencyTree: ["library.g"],
		expectedIncludedDependencies: [],
		expectedExcludedDependencies: ["library.f", "library.c", "library.d", "library.g", "library.d-depender"]
	});
});

test.serial("createDependencyLists: include all + excludes", async (t) => {
	await assertCreateDependencyLists(t, {
		includeAllDependencies: true,
		includeDependency: [],
		excludeDependency: ["library.f", "library.c"],
		excludeDependencyRegExp: ["^library\\.d$"],
		excludeDependencyTree: ["library.g"],
		expectedIncludedDependencies: ["library.b", "library.a", "library.e"],
		expectedExcludedDependencies: ["library.f", "library.c", "library.d", "library.g", "library.d-depender"]
	});
});

test.serial("createDependencyLists: include all", async (t) => {
	await assertCreateDependencyLists(t, {
		includeAllDependencies: true,
		includeDependency: [],
		excludeDependency: [],
		excludeDependencyRegExp: [],
		excludeDependencyTree: [],
		expectedIncludedDependencies: [
			"library.d", "library.b", "library.c",
			"library.d-depender", "library.a", "library.g",
			"library.e", "library.f"
		],
		expectedExcludedDependencies: []
	});
});

test.serial("createDependencyLists: includeDependencyTree has lower priority than excludes", async (t) => {
	await assertCreateDependencyLists(t, {
		includeAllDependencies: false,
		includeDependencyTree: ["library.f"],
		excludeDependency: ["library.f"],
		excludeDependencyRegExp: ["^library\\.[acd]$"],
		expectedIncludedDependencies: ["library.b"],
		expectedExcludedDependencies: ["library.f", "library.d", "library.c", "library.a"]
	});
});

test.serial("createDependencyLists: excludeDependencyTree has lower priority than includes", async (t) => {
	await assertCreateDependencyLists(t, {
		includeAllDependencies: false,
		includeDependency: ["library.f"],
		includeDependencyRegExp: ["^library\\.[acd]$"],
		excludeDependencyTree: ["library.f"],
		expectedIncludedDependencies: ["library.f", "library.d", "library.c", "library.a"],
		expectedExcludedDependencies: ["library.b"]
	});
});

test.serial("createDependencyLists: include all, exclude tree and include single", async (t) => {
	await assertCreateDependencyLists(t, {
		includeAllDependencies: true,
		includeDependency: ["library.f"],
		includeDependencyRegExp: ["^library\\.[acd]$"],
		excludeDependencyTree: ["library.f"],
		expectedIncludedDependencies: [
			"library.f", "library.d", "library.c", "library.a", "library.d-depender",
			"library.g", "library.e"
		],
		expectedExcludedDependencies: ["library.b"]
	});
});

test.serial("createDependencyLists: includeDependencyTree has higher priority than excludeDependencyTree",
	async (t) => {
		await assertCreateDependencyLists(t, {
			includeAllDependencies: false,
			includeDependencyTree: ["library.f"],
			excludeDependencyTree: ["library.f"],
			expectedIncludedDependencies: ["library.f", "library.d", "library.a", "library.b", "library.c"],
			expectedExcludedDependencies: []
		});
	});

test.serial("createDependencyLists: defaultIncludeDependency/RegExp has lower priority than excludes", async (t) => {
	await assertCreateDependencyLists(t, {
		includeAllDependencies: false,
		defaultIncludeDependency: ["library.f", "library.c", "library.b"],
		defaultIncludeDependencyRegExp: ["^library\\.d$"],
		excludeDependency: ["library.f"],
		excludeDependencyRegExp: ["^library\\.[acd](-depender)?$"],
		expectedIncludedDependencies: ["library.b"],
		expectedExcludedDependencies: ["library.f", "library.d", "library.c", "library.d-depender", "library.a"]
	});
});
test.serial("createDependencyLists: include all and defaultIncludeDependency/RegExp", async (t) => {
	await assertCreateDependencyLists(t, {
		includeAllDependencies: true,
		defaultIncludeDependency: ["library.f", "library.c", "library.b"],
		defaultIncludeDependencyRegExp: ["^library\\.d$"],
		excludeDependency: ["library.f"],
		excludeDependencyRegExp: ["^library\\.[acd](-depender)?$"],
		expectedIncludedDependencies: ["library.b", "library.g", "library.e"],
		expectedExcludedDependencies: ["library.f", "library.d", "library.c", "library.d-depender", "library.a"]
	});
});

test.serial("createDependencyLists: defaultIncludeDependencyTree has lower priority than excludes", async (t) => {
	await assertCreateDependencyLists(t, {
		includeAllDependencies: false,
		defaultIncludeDependencyTree: ["library.f"],
		excludeDependencyTree: ["library.a"],
		expectedIncludedDependencies: ["library.f", "library.d", "library.c"],
		expectedExcludedDependencies: ["library.a", "library.b"]
	});
});