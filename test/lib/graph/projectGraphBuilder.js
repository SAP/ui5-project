import test from "ava";
import path from "node:path";
import {fileURLToPath} from "node:url";
import sinonGlobal from "sinon";
import esmock from "esmock";
import projectGraphBuilder from "../../../lib/graph/projectGraphBuilder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const libraryEPath = path.join(__dirname, "..", "..", "fixtures", "library.e");
const libraryFPath = path.join(__dirname, "..", "..", "fixtures", "library.f");
const libraryGPath = path.join(__dirname, "..", "..", "fixtures", "library.g");
const collectionPath = path.join(__dirname, "..", "..", "fixtures", "collection");
const nonExistingPath = path.join(__dirname, "..", "..", "fixtures", "does-not-exist");

function createNode({id, name, version = "1.0.0", modulePath, optional, configuration}) {
	if (!Array.isArray(configuration)) {
		configuration = Object.assign({
			specVersion: "2.6",
			type: "library",
			metadata: {
				name: name || id
			}
		}, configuration);
	}
	return {
		id,
		version,
		path: modulePath || libraryEPath,
		optional,
		configuration
	};
}

function traverseBreadthFirst(...args) {
	return _traverse(...args, true);
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
	t.context.sinon = sinonGlobal.createSandbox();
	t.context.getRootNode = t.context.sinon.stub();
	t.context.getDependencies = t.context.sinon.stub().resolves([]);

	t.context.provider = {
		getRootNode: t.context.getRootNode,
		getDependencies: t.context.getDependencies,
	};
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
});

test("Basic graph creation", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1"
	}));
	const graph = await projectGraphBuilder(t.context.provider);

	await traverseBreadthFirst(t, graph, [
		"id1"
	]);

	const p = graph.getProject("id1");
	t.is(p.getRootPath(), libraryEPath, "Project returned correct path");

	t.is(t.context.getRootNode.callCount, 1, "NodeProvider#getRoodNode got called once");
	t.is(t.context.getDependencies.callCount, 1, "NodeProvider#getDependencies got called once");
});

test("Basic graph with dependencies", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	t.context.getDependencies.onFirstCall().resolves([createNode({
		id: "id2",
		name: "project-2"
	})]);
	t.context.getDependencies.onSecondCall().resolves([createNode({
		id: "id3",
		name: "project-3"
	})]);
	const graph = await projectGraphBuilder(t.context.provider);

	await traverseBreadthFirst(t, graph, [
		"project-1",
		"project-2",
		"project-3"
	]);

	const p = graph.getProject("project-1");
	t.is(p.getRootPath(), libraryEPath, "Project returned correct path");

	t.is(t.context.getRootNode.callCount, 1, "NodeProvider#getRoodNode got called once");
	t.is(t.context.getDependencies.callCount, 3, "NodeProvider#getDependencies got called once");
});

test.serial("Correct warnings logged", async (t) => {
	const {sinon, getRootNode, getDependencies, provider} = t.context;
	const logWarnStub = sinon.stub();

	const projectGraphBuilder = await esmock("../../../lib/graph/projectGraphBuilder.js", {
		"@ui5/logger": {
			getLogger: sinon.stub()
				.withArgs("graph:projectGraphBuilder").returns({
					warn: logWarnStub,
					verbose: () => "",
					silly: () => "",
				})
		}
	});

	getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	const node2 = createNode({
		id: "id2",
		name: "project-2"
	});
	node2.configuration.metadata.deprecated = true;
	node2.configuration.metadata.sapInternal = true;
	getDependencies.onFirstCall().resolves([node2]);
	const node3 = createNode({
		id: "id3",
		name: "project-3"
	});
	node3.configuration.metadata.deprecated = true;
	node3.configuration.metadata.sapInternal = true;
	getDependencies.onSecondCall().resolves([node3]);
	const graph = await projectGraphBuilder(provider);

	await traverseBreadthFirst(t, graph, [
		"project-1",
		"project-2",
		"project-3"
	]);

	t.is(logWarnStub.callCount, 2, "Two warnings logged");
	t.is(logWarnStub.getCall(0).args[0], "Dependency project-2 is deprecated and should not be used for new projects!",
		"Correct deprecation warning logged");
	t.is(logWarnStub.getCall(1).args[0],
		`Dependency project-2 is restricted for use by SAP internal projects only! If the project project-1 is an ` +
		`SAP internal project, add the attribute "allowSapInternal: true" to its metadata configuration`,
		"Correct SAP-internal project warning logged");
});

test.serial("No warnings logged", async (t) => {
	const {sinon, getRootNode, getDependencies} = t.context;
	const logWarnStub = sinon.stub();

	const projectGraphBuilder = await esmock("../../../lib/graph/projectGraphBuilder.js", {
		"@ui5/logger": {
			getLogger: sinon.stub()
				.withArgs("graph:projectGraphBuilder").returns({
					warn: logWarnStub,
					verbose: () => "",
					silly: () => "",
				})
		}
	});

	const node1 = createNode({
		id: "id1",
		name: "testsuite" // "testsuite" name should suppress deprecation warnings
	});
	node1.configuration.metadata.allowSapInternal = true;
	getRootNode.resolves(node1);
	const node2 = createNode({
		id: "id2",
		name: "project-2"
	});
	node2.configuration.metadata.deprecated = true;
	node2.configuration.metadata.sapInternal = true;
	getDependencies.onFirstCall().resolves([node2]);
	const node3 = createNode({
		id: "id3",
		name: "project-3"
	});
	node3.configuration.metadata.deprecated = true;
	node3.configuration.metadata.sapInternal = true;
	getDependencies.onSecondCall().resolves([node3]);
	const graph = await projectGraphBuilder(t.context.provider);

	await traverseBreadthFirst(t, graph, [
		"testsuite",
		"project-2",
		"project-3"
	]);

	t.is(logWarnStub.callCount, 0, "No warnings logged");
});

test("Legacy node with specVersion attribute as root", async (t) => {
	const node = createNode({
		id: "id1"
	});
	node.specVersion = "1.0";
	t.context.getRootNode.resolves(node);
	const err = await t.throwsAsync(projectGraphBuilder(t.context.provider));

	t.is(err.message,
		"Provided node with ID id1 contains a top-level 'specVersion' property. With UI5 CLI 3.0, " +
		"project configuration needs to be provided in a dedicated 'configuration' object",
		"Threw with expected error message");
});

test("Legacy node with metadata attribute in dependencies", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1"
	}));
	const node = createNode({
		id: "id2"
	});
	node.metadata = {name: "id2"};
	t.context.getDependencies.resolves([node]);
	const err = await t.throwsAsync(projectGraphBuilder(t.context.provider));

	t.is(err.message,
		"Provided node with ID id2 contains a top-level 'metadata' property. With UI5 CLI 3.0, " +
		"project configuration needs to be provided in a dedicated 'configuration' object",
		"Threw with expected error message");
});

test("Node depends on itself", async (t) => {
	const node = createNode({
		id: "id1",
		name: "project-1"
	});
	t.context.getRootNode.resolves(node);
	t.context.getDependencies.resolves([node]);
	const err = await t.throwsAsync(projectGraphBuilder(t.context.provider));

	t.is(err.message,
		"Failed to declare dependency from project project-1 to project-1: A project can't depend on itself",
		"Threw with expected error message");
});

test("Cyclic dependencies", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	t.context.getDependencies
		.onFirstCall().resolves([
			createNode({
				id: "id2",
				name: "project-2"
			}),
		])
		.onSecondCall().resolves([
			createNode({
				id: "id1",
				name: "project-1"
			}),
		]);
	const graph = await projectGraphBuilder(t.context.provider);
	t.deepEqual(graph.getDependencies("project-1"), ["project-2"], "Cyclic dependency has been added");
	t.deepEqual(graph.getDependencies("project-2"), ["project-1"], "Cyclic dependency has been added");
});

test("Nested node with same id is processed correctly", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	t.context.getDependencies.onFirstCall().resolves([
		createNode({
			id: "id2",
			name: "project-2"
		}),
	]);
	t.context.getDependencies.onSecondCall().resolves([
		createNode({
			id: "id1",
			name: "project-3" // name will be ignored, since the first "id1" node is being used
		}),
	]);
	const graph = await projectGraphBuilder(t.context.provider);
	const p = graph.getProject("project-1");
	t.is(p.getRootPath(), libraryEPath, "Project returned correct path");
	t.falsy(graph.getProject("project-3"), "Configuration of project with same ID has been ignored");
	t.deepEqual(graph.getDependencies("project-2"), ["project-1"], "Cyclic dependency has been added");
});

test("Nested node with different id but same project is processed correctly", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	t.context.getDependencies.onFirstCall().resolves([
		createNode({
			id: "id2",
			name: "project-2",
			modulePath: libraryFPath
		}),
	]);
	t.context.getDependencies.onSecondCall().resolves([
		createNode({
			id: "id3",
			name: "project-1", // Project is already in the graph and won't be added again
			modulePath: libraryGPath
		}),
	]);
	const graph = await projectGraphBuilder(t.context.provider);
	const p = graph.getProject("project-1");
	t.is(p.getRootPath(), libraryEPath, "Project returned correct path");
	t.deepEqual(graph.getDependencies("project-2"), ["project-1"], "Cyclic dependency has been added");
});

test("Unresolved optional dependency", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	t.context.getDependencies.onFirstCall().resolves([
		// Deps of id1
		createNode({
			id: "id2",
			name: "project-2",
			optional: true
		}),
		createNode({
			id: "id3",
			name: "project-3"
		}),
	]);
	t.context.getDependencies.onSecondCall().resolves([
		// Deps of id2
		createNode({
			id: "id4",
			name: "project-4"
		}),
	]);
	t.context.getDependencies.onThirdCall().resolves([
		// Deps of id3
		createNode({
			id: "id2",
			name: "project-2",
			optional: true
		}),
	]);
	const graph = await projectGraphBuilder(t.context.provider);
	const p = graph.getProject("project-1");
	t.is(p.getRootPath(), libraryEPath, "Project returned correct path");
	t.deepEqual(graph.getDependencies("project-1"), ["project-3"], "Correct dependencies for project-1");
	t.deepEqual(graph.getDependencies("project-2"), ["project-4"], "Correct dependencies for project-2");
	t.deepEqual(graph.getDependencies("project-3"), [], "Correct dependencies for project-3");
});

test("Nested node with same project resolves optional dependency", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	t.context.getDependencies.onFirstCall().resolves([
		// Deps of id1
		createNode({
			id: "id2",
			name: "project-2",
			optional: true
		}),
		createNode({
			id: "id3",
			name: "project-3"
		}),
	]);
	t.context.getDependencies.onSecondCall().resolves([
		// Deps of id2
		createNode({
			id: "id4",
			name: "project-4"
		}),
	]);
	t.context.getDependencies.onThirdCall().resolves([
		// Deps of id3
		createNode({
			// non-optional dependency to id2/project-2
			id: "id2",
			name: "project-2",
			modulePath: libraryGPath // Different path but same module id should be ignored (first module is reused)
		}),
	]);
	const graph = await projectGraphBuilder(t.context.provider);
	const p = graph.getProject("project-1");
	t.is(p.getRootPath(), libraryEPath, "Project returned correct path");
	t.deepEqual(graph.getDependencies("project-1"), ["project-3", "project-2"], "Correct dependencies for project-1");
	t.deepEqual(graph.getDependencies("project-2"), ["project-4"], "Correct dependencies for project-2");
	t.deepEqual(graph.getDependencies("project-3"), ["project-2"], "Correct dependencies for project-3");
});

test("Nested node with different id but same project resolves optional dependency", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	t.context.getDependencies.onFirstCall().resolves([
		// Deps of id1
		createNode({
			id: "id2",
			name: "project-2",
			optional: true
		}),
		createNode({
			id: "id3",
			name: "project-3"
		}),
	]);
	t.context.getDependencies.onSecondCall().resolves([
		// Deps of id2
		createNode({
			id: "id4",
			name: "project-4"
		}),
	]);
	t.context.getDependencies.onThirdCall().resolves([
		// Deps of id3
		createNode({
			// non-optional dependency to project-2
			id: "id5", // Different module but same project should still resolve the optional dependency
			name: "project-2",
			modulePath: libraryGPath
		}),
	]);
	const graph = await projectGraphBuilder(t.context.provider);
	const p = graph.getProject("project-1");
	t.is(p.getRootPath(), libraryEPath, "Project returned correct path");
	t.deepEqual(graph.getDependencies("project-1"), ["project-3", "project-2"], "Correct dependencies for project-1");
	t.deepEqual(graph.getDependencies("project-2"), ["project-4"], "Correct dependencies for project-2");
	t.deepEqual(graph.getDependencies("project-3"), ["project-2"], "Correct dependencies for project-3");
});

test("Root node must provide a project", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1",
		modulePath: collectionPath,
		configuration: {
			kind: "extension",
			type: "project-shim",
			shims: {
				collections: {
					"id1": {
						modules: {
							"library.a": "./library.a",
							"library.b": "./library.b",
							"library.c": "./library.c",
						}
					}
				}
			}
		}
	}));
	const err = await t.throwsAsync(projectGraphBuilder(t.context.provider));
	t.is(err.message,
		`Failed to create a UI5 project from module id1 at ${collectionPath}. ` +
		`Make sure the path is correct and a project configuration is present or supplied.`,
		"Threw with expected error message");
});

test("Dependency is a collection", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	t.context.getDependencies.onFirstCall().resolves([
		createNode({
			id: "id2",
			name: "shim-1",
			modulePath: collectionPath,
			configuration: {
				kind: "extension",
				type: "project-shim",
				shims: {
					collections: {
						"id2": {
							modules: {
								"lib.a": "./library.a",
								"lib.b": "./library.b",
								"lib.c": "./library.c",
							}
						}
					},
					dependencies: {
						"lib.a": ["lib.b"],
					}
				}
			}
		}),
	]);
	const graph = await projectGraphBuilder(t.context.provider);
	await traverseBreadthFirst(t, graph, [
		"project-1",
		"library.a",
		"library.b",
		"library.c"
	]);
	const p = graph.getProject("project-1");
	t.is(p.getRootPath(), libraryEPath, "Project returned correct path");
	t.deepEqual(graph.getDependencies("project-1"), [
		"library.a", "library.b", "library.c"
	], "Correct dependencies for root node maintained");
	t.deepEqual(graph.getDependencies("library.a"), [
		"library.b"
	], "Correct dependencies for library.a maintained");
});

test("Shim in root defines collection", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		configuration: [{
			specVersion: "2.6",
			type: "library",
			metadata: {
				name: "project-1"
			}
		}, {
			specVersion: "2.6",
			kind: "extension",
			type: "project-shim",
			metadata: {
				name: "shim"
			},
			shims: {
				collections: {
					"id2": {
						modules: {
							"lib.a": "./library.a",
							"lib.b": "./library.b",
							"lib.c": "./library.c",
						}
					}
				},
				dependencies: {
					"lib.a": ["lib.b"],
				},
				configurations: {
					"lib.a": {
						customConfiguration: {
							someConfig: true
						}
					}
				}
			}
		}]
	}));
	t.context.getDependencies.onFirstCall().resolves([
		createNode({
			id: "id2",
			name: "shim-1",
			modulePath: collectionPath,
			configuration: []
		}),
	]);
	const graph = await projectGraphBuilder(t.context.provider);
	await traverseBreadthFirst(t, graph, [
		"project-1",
		"library.a",
		"library.b",
		"library.c"
	]);
	const p = graph.getProject("library.a");
	t.deepEqual(p.getCustomConfiguration(), {
		someConfig: true
	}, "Custom configuration from shim has been applied");
});

test("Project defining a collection shim for itself should be ignored", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1",
	}));
	t.context.getDependencies.onFirstCall().resolves([
		createNode({
			id: "id2",
			name: "shim-1",
			modulePath: collectionPath,
			configuration: [{
				specVersion: "2.6",
				type: "library",
				metadata: {
					name: "collection-library" // will be ignored
				},
				customConfiguration: {
					someConfig: true
				}
			}, {
				specVersion: "2.6",
				kind: "extension",
				type: "project-shim",
				metadata: {
					name: "shim"
				},
				shims: {
					collections: {
						"id2": {
							modules: {
								"lib.a": "./library.a",
								"lib.b": "./library.b",
								"lib.c": "./library.c",
							}
						}
					},
					dependencies: {
						"lib.a": ["lib.b"],
					}
				}
			}]
		}),
	]);
	const graph = await projectGraphBuilder(t.context.provider);
	await traverseBreadthFirst(t, graph, [
		"project-1",
		"library.a",
		"library.b",
		"library.c"
	]);
	const p = graph.getProject("library.a");
	t.is(p.getCustomConfiguration(), undefined,
		"No configuration from collection project has been applied");
});

test("Dependencies defined through shim", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	t.context.getDependencies.onFirstCall().resolves([
		createNode({
			id: "ext1",
			configuration: {
				kind: "extension",
				type: "project-shim",
				shims: {
					dependencies: {
						"id3": ["id2"],
					}
				}
			}
		}),
	]);
	t.context.getDependencies.onSecondCall().resolves([
		createNode({
			id: "id2",
			name: "project-2"
		}),
	]);
	t.context.getDependencies.onThirdCall().resolves([
		createNode({
			id: "id3",
			name: "project-3"
		}),
	]);
	const graph = await projectGraphBuilder(t.context.provider);
	t.deepEqual(graph.getDependencies("project-3"), ["project-2"], "Shimmed dependency has been defined");
});

test("Define external dependency as shims in sub-module", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "app",
		version: "1.0.0",
		path: "/app"
	}));

	t.context.getDependencies.onCall(0).resolves([
		createNode({
			id: "lib",
			version: "1.0.0",
			path: "/lib"
		}),
		{
			id: "external-thirdparty",
			version: "1.0.0",
			path: "/app/node_modules/external-thirdparty"
		},
		createNode({
			id: "external-thirdparty-shim",
			configuration: {
				kind: "extension",
				type: "project-shim",
				shims: {
					configurations: {
						"external-thirdparty": {
							specVersion: "3.1",
							type: "module",
							metadata: {name: "external-thirdparty"},
							resources: {
								configuration: {
									paths: {"/resources/": ""},
								},
							},
						},
					},
				},
			}
		})
	]);

	t.context.getDependencies.onCall(1).resolves([
		createNode({
			id: "external-thirdparty",
			version: "1.0.0",
			path: "/app/node_modules/external-thirdparty",
			optional: false
		})
	]);

	const graph = await projectGraphBuilder(t.context.provider);

	t.deepEqual(graph.getDependencies("app"), ["lib"], "'app' depends on 'lib'");
	t.deepEqual(graph.getDependencies("lib"), ["external-thirdparty"], "'lib' depends on 'external-thirdparty'");
});

test("Extension in dependencies", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	t.context.getDependencies.onFirstCall().resolves([
		createNode({
			id: "id2",
			modulePath: libraryEPath,
			configuration: {
				kind: "extension",
				type: "task",
				metadata: {
					name: "task-a"
				},
				task: {
					path: "task-a.js"
				}
			}
		}),
	]);
	const graph = await projectGraphBuilder(t.context.provider);
	t.truthy(graph.getExtension("task-a"), "Extension has been added to the graph");
});

test("Extension is an optional dependency of the root project", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	t.context.getDependencies.onFirstCall().resolves([
		createNode({
			id: "id2",
			modulePath: libraryEPath,
			optional: true,
			configuration: {
				kind: "extension",
				type: "task",
				metadata: {
					name: "task-a"
				},
				task: {
					path: "task-a.js"
				}
			}
		}),
	]);
	const graph = await projectGraphBuilder(t.context.provider);
	t.truthy(graph.getExtension("task-a"), "Extension has been added to the graph");
});

test("Extension is an optional dependency of a non-root project", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	t.context.getDependencies.onFirstCall().resolves([createNode({
		id: "id2",
		name: "project-2"
	})]);
	t.context.getDependencies.onSecondCall().resolves([
		createNode({
			id: "id3",
			modulePath: libraryEPath,
			optional: true,
			configuration: {
				kind: "extension",
				type: "task",
				metadata: {
					name: "task-a"
				},
				task: {
					path: "task-a.js"
				}
			}
		}),
	]);
	const graph = await projectGraphBuilder(t.context.provider);
	t.falsy(graph.getExtension("task-a"), "Extension has not been added to the graph");
});

test("Extension is an optional dependency of a non-root project and is not available", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	t.context.getDependencies.onFirstCall().resolves([createNode({
		id: "id2",
		name: "project-2"
	})]);
	t.context.getDependencies.onSecondCall().resolves([
		createNode({
			id: "id3",
			modulePath: nonExistingPath, // Module is not installed (transitive devDependency)
			optional: true,
			configuration: []
		}),
	]);
	const graph = await projectGraphBuilder(t.context.provider);
	t.falsy(graph.getExtension("task-a"), "Extension has not been added to the graph");
});

test("Extension is a partially optional dependency of a non-root project", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	t.context.getDependencies.onFirstCall().resolves([createNode({
		id: "id2",
		name: "project-2"
	}), createNode({
		id: "id3",
		name: "project-3"
	})]);
	t.context.getDependencies.onSecondCall().resolves([
		// Deps of id2
		createNode({
			id: "id4",
			modulePath: libraryEPath,
			optional: true,
			configuration: {
				kind: "extension",
				type: "task",
				metadata: {
					name: "task-a"
				},
				task: {
					path: "task-a.js"
				}
			}
		}),
	]);
	t.context.getDependencies.onThirdCall().resolves([
		// Deps of id3
		createNode({
			id: "id4", // Will reuse the already visited id4 module
			optional: false, // Will cause the extension to be added
			modulePath: libraryEPath
		}),
	]);
	const graph = await projectGraphBuilder(t.context.provider);
	t.truthy(graph.getExtension("task-a"), "Extension has been added to the graph");
});

test("Multiple dependencies to same module containing an extension", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	t.context.getDependencies.onFirstCall().resolves([createNode({
		id: "id2",
		name: "project-2"
	}), createNode({
		id: "id3",
		name: "project-3"
	})]);
	t.context.getDependencies.onSecondCall().resolves([
		// Deps of id2
		createNode({
			id: "id4",
			modulePath: libraryEPath,
			configuration: {
				kind: "extension",
				type: "task",
				metadata: {
					name: "task-a"
				},
				task: {
					path: "task-a.js"
				}
			}
		}),
	]);
	t.context.getDependencies.onThirdCall().resolves([
		// Deps of id3
		createNode({
			id: "id4", // Will reuse the already visited id4 module
			modulePath: libraryEPath
		}),
	]);
	const graph = await projectGraphBuilder(t.context.provider);
	t.truthy(graph.getExtension("task-a"), "Extension has been added to the graph");
});

test("Multiple dependencies to different module containing the same extension", async (t) => {
	t.context.getRootNode.resolves(createNode({
		id: "id1",
		name: "project-1"
	}));
	t.context.getDependencies.onFirstCall().resolves([createNode({
		id: "id2",
		name: "project-2"
	}), createNode({
		id: "id3",
		name: "project-3"
	})]);
	t.context.getDependencies.onSecondCall().resolves([
		// Deps of id2
		createNode({
			id: "id4",
			modulePath: libraryEPath,
			configuration: {
				kind: "extension",
				type: "task",
				metadata: {
					name: "task-a"
				},
				task: {
					path: "task-a.js"
				}
			}
		}),
	]);
	t.context.getDependencies.onThirdCall().resolves([
		// Deps of id3
		createNode({
			id: "id5",
			modulePath: libraryEPath,
			configuration: {
				kind: "extension",
				type: "task",
				metadata: {
					name: "task-a"
				},
				task: {
					path: "task-a.js"
				}
			}
		}),
	]);
	await t.throwsAsync(projectGraphBuilder(t.context.provider), {
		message:
			"Failed to add extension task-a to graph: An extension with that name has already been added. " +
			"This might be caused by multiple modules containing extensions with the same name"
	});
});
