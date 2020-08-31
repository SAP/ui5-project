const test = require("ava");
const path = require("path");
const mock = require("mock-require");
const applicationAPath = path.join(__dirname, "..", "..", "fixtures", "application.a");
const applicationCPath = path.join(__dirname, "..", "..", "fixtures", "application.c");
const applicationC2Path = path.join(__dirname, "..", "..", "fixtures", "application.c2");
const applicationC3Path = path.join(__dirname, "..", "..", "fixtures", "application.c3");
const applicationDPath = path.join(__dirname, "..", "..", "fixtures", "application.d");
const applicationFPath = path.join(__dirname, "..", "..", "fixtures", "application.f");
const applicationGPath = path.join(__dirname, "..", "..", "fixtures", "application.g");
const errApplicationAPath = path.join(__dirname, "..", "..", "fixtures", "err.application.a");
const cycleDepsBasePath = path.join(__dirname, "..", "..", "fixtures", "cyclic-deps", "node_modules");

let npmTranslator = require("../../../lib/translators/npm");

test.serial("AppA: project with collection dependency", (t) => {
	// Also cover log level based conditionals in this test
	const logger = require("@ui5/logger");
	mock("@ui5/logger", {
		getLogger: () => {
			const log = logger.getLogger();
			log.isLevelEnabled = () => true;
			return log;
		}
	});
	npmTranslator = mock.reRequire("../../../lib/translators/npm");
	return npmTranslator.generateDependencyTree(applicationAPath).then((parsedTree) => {
		t.deepEqual(parsedTree, applicationATree, "Parsed correctly");
		mock.stop("@ui5/logger");
	});
});

test("AppC: project with dependency with optional dependency resolved through root project", (t) => {
	return npmTranslator.generateDependencyTree(applicationCPath).then((parsedTree) => {
		t.deepEqual(parsedTree, applicationCTree, "Parsed correctly");
	});
});

test("AppC2: project with dependency with optional dependency resolved through other project", (t) => {
	return npmTranslator.generateDependencyTree(applicationC2Path).then((parsedTree) => {
		t.deepEqual(parsedTree, applicationC2Tree, "Parsed correctly");
	});
});

test("AppC3: project with dependency with optional dependency resolved " +
	"through other project (but got hoisted)", (t) => {
	return npmTranslator.generateDependencyTree(applicationC3Path).then((parsedTree) => {
		t.deepEqual(parsedTree, applicationC3Tree, "Parsed correctly");
	});
});

test("AppD: project with dependency with unresolved optional dependency", (t) => {
	// application.d`s dependency "library.e" has an optional dependency to "library.d"
	//	which is already present in the node_modules directory of library.e
	return npmTranslator.generateDependencyTree(applicationDPath).then((parsedTree) => {
		t.deepEqual(parsedTree, applicationDTree, "Parsed correctly. library.d is not in dependency tree.");
	});
});

test("AppF: project with UI5-dependencies", (t) => {
	return npmTranslator.generateDependencyTree(applicationFPath).then((parsedTree) => {
		t.deepEqual(parsedTree, applicationFTree, "Parsed correctly");
	});
});

test("AppG: project with npm 'optionalDependencies' should not fail if optional dependency cannot be resolved", (t) => {
	return npmTranslator.generateDependencyTree(applicationGPath).then((parsedTree) => {
		t.deepEqual(parsedTree, applicationGTree, "Parsed correctly");
	});
});

test("AppCycleA: cyclic dev deps", (t) => {
	const applicationCycleAPath = path.join(cycleDepsBasePath, "application.cycle.a");

	return npmTranslator.generateDependencyTree(applicationCycleAPath).then((parsedTree) => {
		t.deepEqual(parsedTree, applicationCycleATree, "Parsed correctly");
	});
});

test("AppCycleA: cyclic dev deps - include deduped", (t) => {
	const applicationCycleAPath = path.join(cycleDepsBasePath, "application.cycle.a");

	return npmTranslator.generateDependencyTree(applicationCycleAPath, {includeDeduped: true}).then((parsedTree) => {
		t.deepEqual(parsedTree, applicationCycleATreeIncDeduped, "Parsed correctly");
	});
});

test("AppCycleB: cyclic npm deps - Cycle via devDependency on second level - include deduped", (t) => {
	const applicationCycleBPath = path.join(cycleDepsBasePath, "application.cycle.b");
	return npmTranslator.generateDependencyTree(applicationCycleBPath, {includeDeduped: true}).then((parsedTree) => {
		t.deepEqual(parsedTree, applicationCycleBTreeIncDeduped, "Parsed correctly");
	});
});

test("AppCycleB: cyclic npm deps - Cycle via devDependency on second level", (t) => {
	const applicationCycleBPath = path.join(cycleDepsBasePath, "application.cycle.b");
	return npmTranslator.generateDependencyTree(applicationCycleBPath, {includeDeduped: false}).then((parsedTree) => {
		t.deepEqual(parsedTree, applicationCycleBTree, "Parsed correctly");
	});
});

test("AppCycleC: cyclic npm deps - Cycle on third level (one indirection)", (t) => {
	const applicationCycleCPath = path.join(cycleDepsBasePath, "application.cycle.c");
	return npmTranslator.generateDependencyTree(applicationCycleCPath, {includeDeduped: false}).then((parsedTree) => {
		t.deepEqual(parsedTree, applicationCycleCTree, "Parsed correctly");
	});
});

test("AppCycleC: cyclic npm deps - Cycle on third level (one indirection) - include deduped", (t) => {
	const applicationCycleCPath = path.join(cycleDepsBasePath, "application.cycle.c");
	return npmTranslator.generateDependencyTree(applicationCycleCPath, {includeDeduped: true}).then((parsedTree) => {
		t.deepEqual(parsedTree, applicationCycleCTreeIncDeduped, "Parsed correctly");
	});
});

test("AppCycleD: cyclic npm deps - Cycles everywhere", (t) => {
	const applicationCycleDPath = path.join(cycleDepsBasePath, "application.cycle.d");
	return npmTranslator.generateDependencyTree(applicationCycleDPath, {includeDeduped: true}).then((parsedTree) => {
		t.deepEqual(parsedTree, applicationCycleDTree, "Parsed correctly");
	});
});

test("AppCycleE: cyclic npm deps - Cycle via devDependency - include deduped", (t) => {
	const applicationCycleEPath = path.join(cycleDepsBasePath, "application.cycle.e");
	return npmTranslator.generateDependencyTree(applicationCycleEPath, {includeDeduped: true}).then((parsedTree) => {
		t.deepEqual(parsedTree, applicationCycleETreeIncDeduped, "Parsed correctly");
	});
});

test("AppCycleE: cyclic npm deps - Cycle via devDependency", (t) => {
	const applicationCycleEPath = path.join(cycleDepsBasePath, "application.cycle.e");
	return npmTranslator.generateDependencyTree(applicationCycleEPath, {includeDeduped: false}).then((parsedTree) => {
		t.deepEqual(parsedTree, applicationCycleETree, "Parsed correctly");
	});
});

test("Error: missing package.json", async (t) => {
	const dir = path.parse(__dirname).root;
	const error = await t.throwsAsync(npmTranslator.generateDependencyTree(dir));
	t.is(error.message, `[npm translator] Failed to locate package.json for directory "${dir}"`);
});

test("Error: missing dependency", async (t) => {
	const error = await t.throwsAsync(npmTranslator.generateDependencyTree(errApplicationAPath));
	t.is(error.message, "[npm translator] Could not locate " +
		"module library.xx via resolve logic (error: Cannot find module 'library.xx/package.json' from '" +
		errApplicationAPath + "') or in a collection");
});

// TODO: Test for scenarios where a dependency is missing *and there is no package.json* in the path above the root module
//	This should test whether the collection-fallback can handle not receiving a .pkg object from readPkgUp
//	Currently tricky to test as there is always a package.json located above the test fixtures.

/* ========================= */
/* ======= Test data ======= */

const applicationATree = {
	id: "application.a",
	version: "1.0.0",
	path: applicationAPath,
	dependencies: [
		{
			id: "library.d",
			version: "1.0.0",
			path: path.join(applicationAPath, "node_modules", "library.d"),
			dependencies: []
		},
		{
			id: "library.a",
			version: "1.0.0",
			path: path.join(applicationAPath, "node_modules", "collection", "library.a"),
			dependencies: []
		},
		{
			id: "library.b",
			version: "1.0.0",
			path: path.join(applicationAPath, "node_modules", "collection", "library.b"),
			dependencies: []
		},
		{
			id: "library.c",
			version: "1.0.0",
			path: path.join(applicationAPath, "node_modules", "collection", "library.c"),
			dependencies: []
		}
	]
};

const applicationCTree = {
	id: "application.c",
	version: "1.0.0",
	path: applicationCPath,
	dependencies: [
		{
			id: "library.e",
			version: "1.0.0",
			path: path.join(applicationCPath, "node_modules", "library.e"),
			dependencies: [
				{
					id: "library.d",
					version: "1.0.0",
					path: path.join(applicationCPath, "node_modules", "library.d"),
					dependencies: []
				}
			]
		},
		{
			id: "library.d",
			version: "1.0.0",
			path: path.join(applicationCPath, "node_modules", "library.d"),
			dependencies: []
		}
	]
};


const applicationC2Tree = {
	id: "application.c2",
	version: "1.0.0",
	path: applicationC2Path,
	dependencies: [
		{
			id: "library.e",
			version: "1.0.0",
			path: path.join(applicationC2Path, "node_modules", "library.e"),
			dependencies: [
				{
					id: "library.d",
					version: "1.0.0",
					path: path.join(applicationC2Path, "node_modules", "library.d-depender",
						"node_modules", "library.d"),
					dependencies: []
				}
			]
		},
		{
			id: "library.d-depender",
			version: "1.0.0",
			path: path.join(applicationC2Path, "node_modules", "library.d-depender"),
			dependencies: [
				{
					id: "library.d",
					version: "1.0.0",
					path: path.join(applicationC2Path, "node_modules", "library.d-depender",
						"node_modules", "library.d"),
					dependencies: []
				}
			]
		}
	]
};

const applicationC3Tree = {
	id: "application.c3",
	version: "1.0.0",
	path: applicationC3Path,
	dependencies: [
		{
			id: "library.e",
			version: "1.0.0",
			path: path.join(applicationC3Path, "node_modules", "library.e"),
			dependencies: [
				{
					id: "library.d",
					version: "1.0.0",
					path: path.join(applicationC3Path, "node_modules", "library.d"),
					dependencies: []
				}
			]
		},
		{
			id: "library.d-depender",
			version: "1.0.0",
			path: path.join(applicationC3Path, "node_modules", "library.d-depender"),
			dependencies: [
				{
					id: "library.d",
					version: "1.0.0",
					path: path.join(applicationC3Path, "node_modules", "library.d"),
					dependencies: []
				}
			]
		}
	]
};

const applicationDTree = {
	id: "application.d",
	version: "1.0.0",
	path: applicationDPath,
	dependencies: [
		{
			id: "library.e",
			version: "1.0.0",
			path: path.join(applicationDPath, "node_modules", "library.e"),
			dependencies: []
		}
	]
};

const applicationFTree = {
	id: "application.f",
	version: "1.0.0",
	path: applicationFPath,
	dependencies: [
		{
			id: "library.d",
			version: "1.0.0",
			path: path.join(applicationFPath, "node_modules", "library.d"),
			dependencies: []
		}
	]
};

const applicationGTree = {
	id: "application.g",
	version: "1.0.0",
	path: applicationGPath,
	dependencies: [
		{
			id: "library.d",
			version: "1.0.0",
			path: path.join(applicationGPath, "node_modules", "library.d"),
			dependencies: []
		}
	]
};

const applicationCycleATree = {
	"id": "application.cycle.a",
	"version": "1.0.0",
	"path": path.join(cycleDepsBasePath, "application.cycle.a"),
	"dependencies": [
		{
			"id": "component.cycle.a",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "component.cycle.a"),
			"dependencies": [
				{
					"id": "library.cycle.a",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "library.cycle.a"),
					"dependencies": []
				},
				{
					"id": "library.cycle.b",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "library.cycle.b"),
					"dependencies": []
				}
			]
		}
	]
};

const applicationCycleATreeIncDeduped = {
	"id": "application.cycle.a",
	"version": "1.0.0",
	"path": path.join(cycleDepsBasePath, "application.cycle.a"),
	"dependencies": [
		{
			"id": "component.cycle.a",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "component.cycle.a"),
			"dependencies": [
				{
					"id": "library.cycle.a",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "library.cycle.a"),
					"dependencies": [
						{
							"id": "component.cycle.a",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "component.cycle.a"),
							"dependencies": [],
							"deduped": true
						}
					]
				},
				{
					"id": "library.cycle.b",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "library.cycle.b"),
					"dependencies": [
						{
							"id": "component.cycle.a",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "component.cycle.a"),
							"dependencies": [],
							"deduped": true
						}
					]
				},
				{
					"id": "application.cycle.a",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "application.cycle.a"),
					"dependencies": [],
					"deduped": true
				}
			]
		}
	]
};

const applicationCycleBTree = {
	"id": "application.cycle.b",
	"version": "1.0.0",
	"path": path.join(cycleDepsBasePath, "application.cycle.b"),
	"dependencies": [
		{
			"id": "module.d",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "module.d"),
			"dependencies": [
				{
					"id": "module.e",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.e"),
					"dependencies": []
				}
			]
		},
		{
			"id": "module.e",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "module.e"),
			"dependencies": [
				{
					"id": "module.d",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.d"),
					"dependencies": []
				}
			]
		}
	]
};

const applicationCycleBTreeIncDeduped = {
	"id": "application.cycle.b",
	"version": "1.0.0",
	"path": path.join(cycleDepsBasePath, "application.cycle.b"),
	"dependencies": [
		{
			"id": "module.d",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "module.d"),
			"dependencies": [
				{
					"id": "module.e",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.e"),
					"dependencies": [
						{
							"id": "module.d",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.d"),
							"dependencies": [],
							"deduped": true
						}
					]
				}
			]
		},
		{
			"id": "module.e",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "module.e"),
			"dependencies": [
				{
					"id": "module.d",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.d"),
					"dependencies": [
						{
							"id": "module.e",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.e"),
							"dependencies": [],
							"deduped": true
						}
					]
				}
			]
		}
	]
};

const applicationCycleCTree = {
	"id": "application.cycle.c",
	"version": "1.0.0",
	"path": path.join(cycleDepsBasePath, "application.cycle.c"),
	"dependencies": [
		{
			"id": "module.f",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "module.f"),
			"dependencies": [
				{
					"id": "module.a",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.a"),
					"dependencies": [
						{
							"id": "module.b",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.b"),
							"dependencies": [
								{
									"id": "module.c",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.c"),
									"dependencies": []
								}
							]
						}
					]
				}
			]
		},
		{
			"id": "module.g",
			"version": "1.0.0", "path": path.join(cycleDepsBasePath, "module.g"),
			"dependencies": [
				{
					"id": "module.a",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.a"),
					"dependencies": [
						{
							"id": "module.b",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.b"),
							"dependencies": [
								{
									"id": "module.c",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.c"),
									"dependencies": []
								}
							]
						}
					]
				}
			]
		}
	]
};

const applicationCycleCTreeIncDeduped = {
	"id": "application.cycle.c",
	"version": "1.0.0",
	"path": path.join(cycleDepsBasePath, "application.cycle.c"),
	"dependencies": [
		{
			"id": "module.f",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "module.f"),
			"dependencies": [
				{
					"id": "module.a",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.a"),
					"dependencies": [
						{
							"id": "module.b",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.b"),
							"dependencies": [
								{
									"id": "module.c",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.c"),
									"dependencies": [
										{
											"id": "module.a",
											"version": "1.0.0",
											"path": path.join(cycleDepsBasePath, "module.a"),
											"dependencies": [],
											"deduped": true
										}
									]
								}
							]
						}
					]
				}
			]
		},
		{
			"id": "module.g",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "module.g"),
			"dependencies": [
				{
					"id": "module.a",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.a"),
					"dependencies": [
						{
							"id": "module.b",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.b"),
							"dependencies": [
								{
									"id": "module.c",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.c"),
									"dependencies": [
										{
											"id": "module.a",
											"version": "1.0.0",
											"path": path.join(cycleDepsBasePath, "module.a"),
											"dependencies": [],
											"deduped": true
										}
									]
								}
							]
						}
					]
				}
			]
		}
	]
};

const applicationCycleDTree = {
	"id": "application.cycle.d",
	"version": "1.0.0",
	"path": path.join(cycleDepsBasePath, "application.cycle.d"),
	"dependencies": [
		{
			"id": "module.h",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "module.h"),
			"dependencies": [
				{
					"id": "module.i",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.i"),
					"dependencies": [
						{
							"id": "module.k",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.k"),
							"dependencies": [
								{
									"id": "module.h",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.h"),
									"dependencies": [],
									"deduped": true
								},
								{
									"id": "module.i",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.i"),
									"dependencies": [],
									"deduped": true
								},
								{
									"id": "module.j",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.j"),
									"dependencies": [
										{
											"id": "module.i",
											"version": "1.0.0",
											"path": path.join(cycleDepsBasePath, "module.i"),
											"dependencies": [],
											"deduped": true
										}
									]
								}
							]
						}
					]
				},
				{
					"id": "module.j",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.j"),
					"dependencies": [
						{
							"id": "module.i",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.i"),
							"dependencies": [
								{
									"id": "module.k",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.k"),
									"dependencies": [
										{
											"id": "module.h",
											"version": "1.0.0",
											"path": path.join(cycleDepsBasePath, "module.h"),
											"dependencies": [],
											"deduped": true
										},
										{
											"id": "module.i",
											"version": "1.0.0",
											"path": path.join(cycleDepsBasePath, "module.i"),
											"dependencies": [],
											"deduped": true
										},
										{
											"id": "module.j",
											"version": "1.0.0",
											"path": path.join(cycleDepsBasePath, "module.j"),
											"dependencies": [],
											"deduped": true
										}
									]
								}
							]
						}
					]
				}
			]
		},
		{
			"id": "module.i",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "module.i"),
			"dependencies": [
				{
					"id": "module.k",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.k"),
					"dependencies": [
						{
							"id": "module.h",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.h"),
							"dependencies": [
								{
									"id": "module.i",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.i"),
									"dependencies": [],
									"deduped": true
								},
								{
									"id": "module.j",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.j"),
									"dependencies": [
										{
											"id": "module.i",
											"version": "1.0.0",
											"path": path.join(cycleDepsBasePath, "module.i"),
											"dependencies": [],
											"deduped": true
										}
									]
								}
							]
						},
						{
							"id": "module.i",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.i"),
							"dependencies": [],
							"deduped": true
						},
						{
							"id": "module.j",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.j"),
							"dependencies": [
								{
									"id": "module.i",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.i"),
									"dependencies": [],
									"deduped": true
								}
							]
						}
					]
				}
			]
		},
		{
			"id": "module.j",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "module.j"),
			"dependencies": [
				{
					"id": "module.i",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.i"),
					"dependencies": [
						{
							"id": "module.k",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.k"),
							"dependencies": [
								{
									"id": "module.h",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.h"),
									"dependencies": [
										{
											"id": "module.i",
											"version": "1.0.0",
											"path": path.join(cycleDepsBasePath, "module.i"),
											"dependencies": [],
											"deduped": true
										},
										{
											"id": "module.j",
											"version": "1.0.0",
											"path": path.join(cycleDepsBasePath, "module.j"),
											"dependencies": [],
											"deduped": true
										}
									]
								},
								{
									"id": "module.i",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.i"),
									"dependencies": [],
									"deduped": true
								},
								{
									"id": "module.j",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.j"),
									"dependencies": [],
									"deduped": true
								}
							]
						}
					]
				}
			]
		},
		{
			"id": "module.k",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "module.k"),
			"dependencies": [
				{
					"id": "module.h",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.h"),
					"dependencies": [
						{
							"id": "module.i",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.i"),
							"dependencies": [
								{
									"id": "module.k",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.k"),
									"dependencies": [],
									"deduped": true
								}
							]
						},
						{
							"id": "module.j",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.j"),
							"dependencies": [
								{
									"id": "module.i",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.i"),
									"dependencies": [
										{
											"id": "module.k",
											"version": "1.0.0",
											"path": path.join(cycleDepsBasePath, "module.k"),
											"dependencies": [],
											"deduped": true
										}
									]
								}
							]
						}
					]
				},
				{
					"id": "module.i",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.i"),
					"dependencies": [
						{
							"id": "module.k",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.k"),
							"dependencies": [],
							"deduped": true
						}
					]
				},
				{
					"id": "module.j",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.j"),
					"dependencies": [
						{
							"id": "module.i",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.i"),
							"dependencies": [
								{
									"id": "module.k",
									"version": "1.0.0",
									"path": path.join(cycleDepsBasePath, "module.k"),
									"dependencies": [],
									"deduped": true
								}
							]
						}
					]
				}
			]
		}
	]
};

const applicationCycleETree = {
	"id": "application.cycle.e",
	"version": "1.0.0",
	"path": path.join(cycleDepsBasePath, "application.cycle.e"),
	"dependencies": [
		{
			"id": "module.l",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "module.l"),
			"dependencies": [
				{
					"id": "module.m",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.m"),
					"dependencies": []
				}
			]
		},
		{
			"id": "module.m",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "module.m"),
			"dependencies": [
				{
					"id": "module.l",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.l"),
					"dependencies": []
				}
			]
		}
	]
};

const applicationCycleETreeIncDeduped = {
	"id": "application.cycle.e",
	"version": "1.0.0",
	"path": path.join(cycleDepsBasePath, "application.cycle.e"),
	"dependencies": [
		{
			"id": "module.l",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "module.l"),
			"dependencies": [
				{
					"id": "module.m",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.m"),
					"dependencies": [
						{
							"id": "module.l",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.l"),
							"dependencies": [],
							"deduped": true
						}
					]
				}
			]
		},
		{
			"id": "module.m",
			"version": "1.0.0",
			"path": path.join(cycleDepsBasePath, "module.m"),
			"dependencies": [
				{
					"id": "module.l",
					"version": "1.0.0",
					"path": path.join(cycleDepsBasePath, "module.l"),
					"dependencies": [
						{
							"id": "module.m",
							"version": "1.0.0",
							"path": path.join(cycleDepsBasePath, "module.m"),
							"dependencies": [],
							"deduped": true
						}
					]
				}
			]
		}
	]
};
