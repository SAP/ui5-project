import path from "node:path";
import test from "ava";
import sinonGlobal from "sinon";
import esmock from "esmock";
import DependencyTreeProvider from "../../../../lib/graph/providers/DependencyTree.js";
import projectGraphBuilder from "../../../../lib/graph/projectGraphBuilder.js";
import Specification from "../../../../lib/specifications/Specification.js";
import CacheMode from "../../../../lib/ui5Framework/maven/CacheMode.js";

const __dirname = import.meta.dirname;

const applicationAPath = path.join(__dirname, "..", "..", "..", "fixtures", "application.a");
const libraryDPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.d");
const libraryEPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.e");
const libraryFPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.f");

test.beforeEach(async (t) => {
	// Tests either rely on not having UI5_DATA_DIR defined, or explicitly define it
	t.context.originalUi5DataDirEnv = process.env.UI5_DATA_DIR;
	delete process.env.UI5_DATA_DIR;

	const sinon = t.context.sinon = sinonGlobal.createSandbox();

	t.context.log = {
		info: sinon.stub(),
		warn: sinon.stub(),
		verbose: sinon.stub(),
		isLevelEnabled: sinon.stub().returns(false),
		_getLogger: sinon.stub()
	};
	const ui5Logger = {
		getLogger: sinon.stub().returns(t.context.log)
	};

	t.context.Openui5ResolverStub = sinon.stub();

	t.context.Sapui5ResolverStub = sinon.stub();
	t.context.Sapui5ResolverInstallStub = sinon.stub();
	t.context.Sapui5ResolverStub.callsFake(() => {
		return {
			install: t.context.Sapui5ResolverInstallStub
		};
	});
	t.context.Sapui5ResolverResolveVersionStub = sinon.stub();
	t.context.Sapui5ResolverStub.resolveVersion = t.context.Sapui5ResolverResolveVersionStub;

	t.context.Sapui5MavenSnapshotResolverInstallStub = sinon.stub();
	t.context.Sapui5MavenSnapshotResolverStub = sinon.stub()
		.callsFake(() => {
			return {
				install: t.context.Sapui5MavenSnapshotResolverInstallStub
			};
		});
	t.context.Sapui5MavenSnapshotResolverResolveVersionStub = sinon.stub();
	t.context.Sapui5MavenSnapshotResolverStub.resolveVersion = t.context.Sapui5MavenSnapshotResolverResolveVersionStub;

	t.context.getUi5DataDirStub = sinon.stub().returns(undefined);

	t.context.ConfigurationStub = {
		fromFile: sinon.stub().resolves({
			getUi5DataDir: t.context.getUi5DataDirStub
		})
	};

	t.context.ui5Framework = await esmock.p("../../../../lib/graph/helpers/ui5Framework.js", {
		"@ui5/logger": ui5Logger,
		"../../../../lib/ui5Framework/Sapui5Resolver.js": t.context.Sapui5ResolverStub,
		"../../../../lib/ui5Framework/Sapui5MavenSnapshotResolver.js": t.context.Sapui5MavenSnapshotResolverStub,
		"../../../../lib/config/Configuration.js": t.context.ConfigurationStub,
	});
	t.context.utils = t.context.ui5Framework._utils;
});

test.afterEach.always((t) => {
	// Reset UI5_DATA_DIR env
	if (typeof t.context.originalUi5DataDirEnv === "undefined") {
		delete process.env.UI5_DATA_DIR;
	} else {
		process.env.UI5_DATA_DIR = t.context.originalUi5DataDirEnv;
	}
	t.context.sinon.restore();
	esmock.purge(t.context.ui5Framework);
});

test.serial("enrichProjectGraph", async (t) => {
	const {sinon, ui5Framework, utils, Sapui5ResolverInstallStub} = t.context;

	const dependencyTree = {
		id: "test1",
		version: "1.0.0",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				version: "1.75.0"
			}
		}
	};

	const referencedLibraries = ["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib3"];
	const libraryMetadata = {fake: "metadata"};

	const getFrameworkLibrariesFromGraphStub = sinon.stub(utils, "getFrameworkLibrariesFromGraph")
		.resolves(referencedLibraries);

	Sapui5ResolverInstallStub.resolves({libraryMetadata});


	const addProjectToGraphStub = sinon.stub();
	const ProjectProcessorStub = sinon.stub(utils, "ProjectProcessor")
		.callsFake(() => {
			return {
				addProjectToGraph: addProjectToGraphStub
			};
		});

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	await ui5Framework.enrichProjectGraph(projectGraph);

	t.is(getFrameworkLibrariesFromGraphStub.callCount, 1, "getFrameworkLibrariesFromGraph should be called once");

	t.is(t.context.Sapui5ResolverStub.callCount, 1, "Sapui5Resolver#constructor should be called once");
	t.deepEqual(t.context.Sapui5ResolverStub.getCall(0).args, [{
		cacheMode: undefined,
		cwd: dependencyTree.path,
		version: dependencyTree.configuration.framework.version,
		ui5DataDir: undefined,
		providedLibraryMetadata: undefined
	}], "Sapui5Resolver#constructor should be called with expected args");

	t.is(t.context.Sapui5ResolverInstallStub.callCount, 1, "Sapui5Resolver#install should be called once");
	t.deepEqual(t.context.Sapui5ResolverInstallStub.getCall(0).args, [
		referencedLibraries
	], "Sapui5Resolver#install should be called with expected args");

	t.is(ProjectProcessorStub.callCount, 1, "ProjectProcessor#constructor should be called once");
	const projectProcessorConstructorArgs = ProjectProcessorStub.getCall(0).args[0];
	t.deepEqual(projectProcessorConstructorArgs.libraryMetadata, libraryMetadata,
		"Correct libraryMetadata provided to ProjectProcessor");
	t.is(projectProcessorConstructorArgs.graph._rootProjectName,
		"fake-root-of-application.a-framework-dependency-graph",
		"Correct graph provided to ProjectProcessor");
	t.falsy(projectProcessorConstructorArgs.workspace,
		"No workspace provided to ProjectProcessor");

	t.is(addProjectToGraphStub.callCount, 3, "ProjectProcessor#getProject should be called 3 times");
	t.deepEqual(addProjectToGraphStub.getCall(0).args[0], referencedLibraries[0],
		"ProjectProcessor#addProjectToGraph should be called with expected first arg (call 1)");
	t.deepEqual(addProjectToGraphStub.getCall(1).args[0], referencedLibraries[1],
		"ProjectProcessor#addProjectToGraph should be called with expected first arg (call 2)");
	t.deepEqual(addProjectToGraphStub.getCall(2).args[0], referencedLibraries[2],
		"ProjectProcessor#addProjectToGraph should be called with expected first arg (call 3)");


	const callbackStub = sinon.stub().resolves();
	await projectGraph.traverseDepthFirst(callbackStub);

	t.is(callbackStub.callCount, 1, "Correct number of projects have been visited");

	const callbackCalls = callbackStub.getCalls().map((call) => call.args[0].project.getName());
	t.deepEqual(callbackCalls, [
		"application.a"
	], "Traversed graph in correct order");
});

test.serial("enrichProjectGraph: without framework configuration", async (t) => {
	const {ui5Framework, log} = t.context;
	const dependencyTree = {
		id: "application.a",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			}
		}
	};

	t.is(log.verbose.callCount, 0);

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	await ui5Framework.enrichProjectGraph(projectGraph);
	t.is(projectGraph.getSize(), 1, "Project graph should remain unchanged");
	t.is(log.verbose.callCount, 1);
	t.deepEqual(log.verbose.getCall(0).args, [
		"Root project application.a has no framework configuration. Nothing to do here"
	]);
});

test.serial("enrichProjectGraph SNAPSHOT", async (t) => {
	const {sinon, ui5Framework, utils, Sapui5MavenSnapshotResolverInstallStub} = t.context;

	const dependencyTree = {
		id: "test1",
		version: "1.0.0",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				version: "1.75.0-SNAPSHOT"
			}
		}
	};

	const referencedLibraries = ["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib3"];
	const libraryMetadata = {libraryMetadata: {fake: "metadata"}};

	const getFrameworkLibrariesFromGraphStub = sinon.stub(utils, "getFrameworkLibrariesFromGraph")
		.resolves(referencedLibraries);

	Sapui5MavenSnapshotResolverInstallStub.resolves(libraryMetadata);

	const addProjectToGraphStub = sinon.stub();
	const ProjectProcessorStub = sinon.stub(utils, "ProjectProcessor")
		.callsFake(() => {
			return {
				addProjectToGraph: addProjectToGraphStub
			};
		});


	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	await ui5Framework.enrichProjectGraph(projectGraph, {
		cacheMode: CacheMode.Force
	});

	t.is(getFrameworkLibrariesFromGraphStub.callCount, 1, "getFrameworkLibrariesFromGraph should be called once");

	t.is(t.context.Sapui5MavenSnapshotResolverInstallStub.callCount,
		1, "Sapui5MavenSnapshotResolverInstallStub#constructor should be called once");
	t.deepEqual(
		t.context.Sapui5MavenSnapshotResolverInstallStub.getCall(0).args,
		[["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib3"]],
		"Sapui5MavenSnapshotResolverInstallStub#constructor should be called with expected args"
	);

	t.is(t.context.Sapui5MavenSnapshotResolverInstallStub.callCount, 1,
		"Sapui5MavenSnapshotResolverInstallStub#install should be called once");
	t.deepEqual(t.context.Sapui5MavenSnapshotResolverInstallStub.getCall(0).args, [
		referencedLibraries
	], "Sapui5MavenSnapshotResolverInstallStub#install should be called with expected args");

	t.is(ProjectProcessorStub.callCount, 1, "ProjectProcessor#constructor should be called once");
	const projectProcessorConstructorArgs = ProjectProcessorStub.getCall(0).args[0];
	t.deepEqual(projectProcessorConstructorArgs.libraryMetadata, libraryMetadata.libraryMetadata,
		"Correct libraryMetadata provided to ProjectProcessor");
	t.is(projectProcessorConstructorArgs.graph._rootProjectName,
		"fake-root-of-application.a-framework-dependency-graph",
		"Correct graph provided to ProjectProcessor");
	t.falsy(projectProcessorConstructorArgs.workspace,
		"No workspace provided to ProjectProcessor");

	t.is(addProjectToGraphStub.callCount, 3, "ProjectProcessor#getProject should be called 3 times");
	t.deepEqual(addProjectToGraphStub.getCall(0).args[0], referencedLibraries[0],
		"ProjectProcessor#addProjectToGraph should be called with expected first arg (call 1)");
	t.deepEqual(addProjectToGraphStub.getCall(1).args[0], referencedLibraries[1],
		"ProjectProcessor#addProjectToGraph should be called with expected first arg (call 2)");
	t.deepEqual(addProjectToGraphStub.getCall(2).args[0], referencedLibraries[2],
		"ProjectProcessor#addProjectToGraph should be called with expected first arg (call 3)");


	const callbackStub = sinon.stub().resolves();
	await projectGraph.traverseDepthFirst(callbackStub);

	t.is(callbackStub.callCount, 1, "Correct number of projects have been visited");

	const callbackCalls = callbackStub.getCalls().map((call) => call.args[0].project.getName());
	t.deepEqual(callbackCalls, [
		"application.a"
	], "Traversed graph in correct order");
});

test.serial("enrichProjectGraph: With versionOverride", async (t) => {
	const {
		sinon, ui5Framework, utils,
		Sapui5ResolverStub, Sapui5ResolverResolveVersionStub, Sapui5ResolverInstallStub
	} = t.context;

	const dependencyTree = {
		id: "test1",
		version: "1.0.0",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				version: "1.75.0"
			}
		}
	};

	const referencedLibraries = ["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib3"];
	const libraryMetadata = {fake: "metadata"};

	sinon.stub(utils, "getFrameworkLibrariesFromGraph").resolves(referencedLibraries);

	Sapui5ResolverInstallStub.resolves({libraryMetadata});

	Sapui5ResolverResolveVersionStub.resolves("1.99.9");

	const addProjectToGraphStub = sinon.stub();
	sinon.stub(utils, "ProjectProcessor")
		.callsFake(() => {
			return {
				addProjectToGraph: addProjectToGraphStub
			};
		});

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	await ui5Framework.enrichProjectGraph(projectGraph, {versionOverride: "1.99"});

	t.is(Sapui5ResolverResolveVersionStub.callCount, 1);
	t.deepEqual(Sapui5ResolverResolveVersionStub.getCall(0).args, ["1.99", {
		cwd: dependencyTree.path,
		ui5DataDir: undefined,
	}]);

	t.is(Sapui5ResolverStub.callCount, 1, "Sapui5Resolver#constructor should be called once");
	t.deepEqual(Sapui5ResolverStub.getCall(0).args, [{
		cacheMode: undefined,
		cwd: dependencyTree.path,
		version: "1.99.9",
		ui5DataDir: undefined,
		providedLibraryMetadata: undefined
	}], "Sapui5Resolver#constructor should be called with expected args");
});

test.serial("enrichProjectGraph: With versionOverride containing snapshot version", async (t) => {
	const {
		sinon, ui5Framework, utils,
		Sapui5MavenSnapshotResolverStub, Sapui5MavenSnapshotResolverResolveVersionStub,
		Sapui5MavenSnapshotResolverInstallStub
	} = t.context;

	const dependencyTree = {
		id: "test1",
		version: "1.0.0",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				version: "1.75.0"
			}
		}
	};

	const referencedLibraries = ["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib3"];
	const libraryMetadata = {fake: "metadata"};

	sinon.stub(utils, "getFrameworkLibrariesFromGraph").resolves(referencedLibraries);

	Sapui5MavenSnapshotResolverInstallStub.resolves({libraryMetadata});

	Sapui5MavenSnapshotResolverResolveVersionStub.resolves("1.99.9-SNAPSHOT");

	const addProjectToGraphStub = sinon.stub();
	sinon.stub(utils, "ProjectProcessor")
		.callsFake(() => {
			return {
				addProjectToGraph: addProjectToGraphStub
			};
		});

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	await ui5Framework.enrichProjectGraph(projectGraph, {versionOverride: "1.99-SNAPSHOT"});

	t.is(Sapui5MavenSnapshotResolverResolveVersionStub.callCount, 1);
	t.deepEqual(Sapui5MavenSnapshotResolverResolveVersionStub.getCall(0).args, ["1.99-SNAPSHOT", {
		cwd: dependencyTree.path,
		ui5DataDir: undefined,
	}]);

	t.is(Sapui5MavenSnapshotResolverStub.callCount, 1,
		"Sapui5MavenSnapshotResolverStub#constructor should be called once");
	t.deepEqual(Sapui5MavenSnapshotResolverStub.getCall(0).args, [{
		cacheMode: undefined,
		cwd: dependencyTree.path,
		version: "1.99.9-SNAPSHOT",
		ui5DataDir: undefined,
		providedLibraryMetadata: undefined
	}], "Sapui5Resolver#constructor should be called with expected args");
});

test.serial("enrichProjectGraph: With versionOverride containing latest-snapshot", async (t) => {
	const {
		sinon, ui5Framework, utils,
		Sapui5MavenSnapshotResolverStub, Sapui5MavenSnapshotResolverResolveVersionStub,
		Sapui5MavenSnapshotResolverInstallStub
	} = t.context;

	const dependencyTree = {
		id: "test1",
		version: "1.0.0",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				version: "1.75.0"
			}
		}
	};

	const referencedLibraries = ["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib3"];
	const libraryMetadata = {fake: "metadata"};

	sinon.stub(utils, "getFrameworkLibrariesFromGraph").resolves(referencedLibraries);

	Sapui5MavenSnapshotResolverInstallStub.resolves({libraryMetadata});

	Sapui5MavenSnapshotResolverResolveVersionStub.resolves("1.99.9-SNAPSHOT");

	const addProjectToGraphStub = sinon.stub();
	sinon.stub(utils, "ProjectProcessor")
		.callsFake(() => {
			return {
				addProjectToGraph: addProjectToGraphStub
			};
		});

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	await ui5Framework.enrichProjectGraph(projectGraph, {versionOverride: "latest-snapshot"});

	t.is(Sapui5MavenSnapshotResolverResolveVersionStub.callCount, 1);
	t.deepEqual(Sapui5MavenSnapshotResolverResolveVersionStub.getCall(0).args, ["latest-snapshot", {
		cwd: dependencyTree.path,
		ui5DataDir: undefined,
	}]);

	t.is(Sapui5MavenSnapshotResolverStub.callCount, 1,
		"Sapui5MavenSnapshotResolverStub#constructor should be called once");
	t.deepEqual(Sapui5MavenSnapshotResolverStub.getCall(0).args, [{
		cacheMode: undefined,
		cwd: dependencyTree.path,
		version: "1.99.9-SNAPSHOT",
		ui5DataDir: undefined,
		providedLibraryMetadata: undefined
	}], "Sapui5Resolver#constructor should be called with expected args");
});

test.serial("enrichProjectGraph shouldn't throw when no framework version and no libraries are provided", async (t) => {
	const {ui5Framework, log, Sapui5ResolverResolveVersionStub} = t.context;
	const dependencyTree = {
		id: "test-id",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5"
			}
		}
	};

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	// Framework override is fine, even if no framework version is configured
	await ui5Framework.enrichProjectGraph(projectGraph, {
		versionOverride: "1.75.0"
	});

	t.is(Sapui5ResolverResolveVersionStub.callCount, 0,
		"resolveVersion should not be called when no libraries are provided");

	t.is(log.verbose.callCount, 2);
	t.deepEqual(log.verbose.getCall(0).args, [
		"Project application.a has no framework dependencies"
	]);
	t.deepEqual(log.verbose.getCall(1).args, [
		"No SAPUI5 libraries referenced in project application.a or in any of its dependencies"
	]);
});

test.serial("enrichProjectGraph should skip framework project without version", async (t) => {
	const {ui5Framework} = t.context;
	const dependencyTree = {
		id: "@sapui5/project",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5"
			}
		}
	};
	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	await ui5Framework.enrichProjectGraph(projectGraph);
	t.is(projectGraph.getSize(), 1, "Project graph should remain unchanged");
});

test.serial("enrichProjectGraph should resolve framework project with version and framework config", async (t) => {
	// Framework projects should not specify framework versions, but they might do so in dedicated configuration files
	// In this case the graph is generated the usual way for the root-project. However, framework projects on
	// other levels of the graph are ignored
	const {
		sinon, ui5Framework, utils,
		Sapui5ResolverStub, Sapui5ResolverInstallStub
	} = t.context;
	const dependencyTree = {
		id: "@sapui5/project",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				version: "1.2.3",
				libraries: [
					{
						name: "lib1",
						optional: true
					}
				]
			}
		},
		dependencies: [{
			id: "@openui5/test1", // Will not be scanned
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "library.d"
				},
				framework: {
					name: "OpenUI5",
					libraries: [{
						name: "lib2"
					}]
				}
			}
		}, {
			id: "@openui5/lib1",
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "lib1"
				},
				framework: {
					name: "OpenUI5",
					libraries: [{
						name: "lib3"
					}]
				}
			}
		}]
	};
	const referencedLibraries = ["lib1"];
	const libraryMetadata = {fake: "metadata"};

	const getFrameworkLibrariesFromGraphStub =
		sinon.stub(utils, "getFrameworkLibrariesFromGraph").resolves(referencedLibraries);

	Sapui5ResolverInstallStub.resolves({libraryMetadata});

	const addProjectToGraphStub = sinon.stub();
	sinon.stub(utils, "ProjectProcessor")
		.callsFake(() => {
			return {
				addProjectToGraph: addProjectToGraphStub
			};
		});

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	await ui5Framework.enrichProjectGraph(projectGraph);
	t.is(projectGraph.getSize(), 3, "Project graph should remain unchanged");

	t.is(getFrameworkLibrariesFromGraphStub.callCount, 1, "getFrameworkLibrariesFromGrap should be called once");
	t.is(Sapui5ResolverStub.callCount, 1, "Sapui5Resolver#constructor should be called once");
	t.deepEqual(Sapui5ResolverStub.getCall(0).args, [{
		cacheMode: undefined,
		cwd: dependencyTree.path,
		version: "1.2.3",
		ui5DataDir: undefined,
		providedLibraryMetadata: undefined
	}], "Sapui5Resolver#constructor should be called with expected args");
});

test.serial("enrichProjectGraph should resolve framework project " +
	"with framework config and version override", async (t) => {
	// Framework projects should not specify framework versions, but they might do so in dedicated configuration files
	// In this case the graph is generated the usual way for the root-project. However, framework projects on
	// other levels of the graph are ignored
	const {
		sinon, ui5Framework, utils,
		Sapui5ResolverStub, Sapui5ResolverResolveVersionStub, Sapui5ResolverInstallStub
	} = t.context;
	const dependencyTree = {
		id: "@sapui5/project",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				libraries: [
					{
						name: "lib1",
						optional: true
					}
				]
			}
		},
		dependencies: [{
			id: "@openui5/test1", // Will not be scanned
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "library.d"
				},
				framework: {
					name: "OpenUI5",
					libraries: [{
						name: "lib2"
					}]
				}
			}
		}, {
			id: "@openui5/lib1",
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "lib1"
				},
				framework: {
					name: "OpenUI5",
					libraries: [{
						name: "lib3"
					}]
				}
			}
		}]
	};
	const referencedLibraries = ["lib1"];
	const libraryMetadata = {fake: "metadata"};

	const getFrameworkLibrariesFromGraphStub =
		sinon.stub(utils, "getFrameworkLibrariesFromGraph").resolves(referencedLibraries);

	Sapui5ResolverInstallStub.resolves({libraryMetadata});
	Sapui5ResolverResolveVersionStub.resolves("1.99.9");

	const addProjectToGraphStub = sinon.stub();
	sinon.stub(utils, "ProjectProcessor")
		.callsFake(() => {
			return {
				addProjectToGraph: addProjectToGraphStub
			};
		});

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	await ui5Framework.enrichProjectGraph(projectGraph, {versionOverride: "3.4.5"});
	t.is(projectGraph.getSize(), 3, "Project graph should remain unchanged");

	t.is(Sapui5ResolverResolveVersionStub.callCount, 1);
	t.deepEqual(Sapui5ResolverResolveVersionStub.getCall(0).args, ["3.4.5", {
		cwd: dependencyTree.path,
		ui5DataDir: undefined,
	}]);

	t.is(Sapui5ResolverStub.callCount, 1, "Sapui5Resolver#constructor should be called once");
	t.is(getFrameworkLibrariesFromGraphStub.callCount, 1, "getFrameworkLibrariesFromGraph should be called once");
	t.deepEqual(Sapui5ResolverStub.getCall(0).args, [{
		cacheMode: undefined,
		cwd: dependencyTree.path,
		version: "1.99.9",
		ui5DataDir: undefined,
		providedLibraryMetadata: undefined
	}], "Sapui5Resolver#constructor should be called with expected args");
});

test.serial("enrichProjectGraph should skip framework project when all dependencies are in graph", async (t) => {
	const {ui5Framework} = t.context;
	const dependencyTree = {
		id: "@sapui5/project",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				libraries: [
					{name: "lib1"}
				]
			}
		},
		dependencies: [{
			id: "@openui5/lib1",
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "lib1"
				}
			}
		}]
	};

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	await ui5Framework.enrichProjectGraph(projectGraph);
	t.is(projectGraph.getSize(), 2, "Project graph should remain unchanged");
});

test.serial("enrichProjectGraph should throw for framework project with dependency missing in graph", async (t) => {
	const {ui5Framework, Sapui5ResolverInstallStub} = t.context;
	const dependencyTree = {
		id: "@sapui5/project",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				libraries: [
					{
						name: "lib1"
					}
				]
			}
		}
	};

	const installError = new Error("Resolution of framework libraries failed with errors: TEST ERROR");

	Sapui5ResolverInstallStub.rejects(installError);

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	const err = await t.throwsAsync(ui5Framework.enrichProjectGraph(projectGraph));
	t.is(err.message, installError.message);
});

test.serial("enrichProjectGraph should throw for incorrect framework name", async (t) => {
	const {ui5Framework, sinon} = t.context;
	const dependencyTree = {
		id: "project",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				version: "1.2.3",
				libraries: [
					{
						name: "lib1",
						optional: true
					}
				]
			}
		}
	};

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	sinon.stub(projectGraph.getRoot(), "getFrameworkName").returns("Pony5");
	const err = await t.throwsAsync(ui5Framework.enrichProjectGraph(projectGraph));
	t.is(err.message, `Unknown framework.name "Pony5" for project application.a. Must be "OpenUI5" or "SAPUI5"`,
		"Threw with expected error message");
});

test.serial("enrichProjectGraph should ignore root project without framework configuration", async (t) => {
	const {ui5Framework} = t.context;
	const dependencyTree = {
		id: "@sapui5/project",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			}
		}
	};
	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	await ui5Framework.enrichProjectGraph(projectGraph);
	t.is(projectGraph.getSize(), 1, "Project graph should remain unchanged");
});

test.serial("enrichProjectGraph should throw error when projectGraph contains a framework library project " +
"that is also defined in framework configuration", async (t) => {
	const {
		sinon, ui5Framework, utils,
		Sapui5ResolverResolveVersionStub, Sapui5ResolverInstallStub
	} = t.context;
	const dependencyTree = {
		id: "application.a",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				version: "1.100.0",
				libraries: [{
					name: "sap.ui.core"
				}]
			}
		},
		dependencies: [{
			id: "@openui5/sap.ui.core",
			version: "1.99.0",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "sap.ui.core"
				}
			}
		}]
	};

	const referencedLibraries = ["sap.ui.core"];
	const libraryMetadata = {fake: "metadata"};

	sinon.stub(utils, "getFrameworkLibrariesFromGraph").resolves(referencedLibraries);

	Sapui5ResolverInstallStub.resolves({libraryMetadata});
	Sapui5ResolverResolveVersionStub.resolves("1.100.0");

	sinon.stub(utils, "ProjectProcessor")
		.callsFake(({graph}) => {
			return {
				async addProjectToGraph() {
					const fakeCoreProject = await Specification.create({
						id: "@openui5/sap.ui.core",
						version: "1.100.0",
						modulePath: libraryEPath,
						configuration: {
							specVersion: "3.1",
							kind: "project",
							type: "library",
							metadata: {
								name: "sap.ui.core"
							}
						}
					});
					graph.addProject(fakeCoreProject);
				}
			};
		});

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	await t.throwsAsync(ui5Framework.enrichProjectGraph(projectGraph), {
		message: `Duplicate framework dependency definition(s) found for project application.a: sap.ui.core.\n` +
			`Framework libraries should only be referenced via ui5.yaml configuration. Neither the root project, ` +
			`nor any of its dependencies should include them as direct dependencies (e.g. via package.json).`
	});
});

test.serial("enrichProjectGraph should use framework library metadata from workspace", async (t) => {
	const {ui5Framework, utils, Sapui5ResolverStub, Sapui5ResolverInstallStub, sinon} = t.context;
	const dependencyTree = {
		id: "@sapui5/project",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				version: "1.111.1",
				libraries: [
					{name: "lib1"},
					{name: "lib2"}
				]
			}
		}
	};

	const workspace = {
		getName: sinon.stub().resolves("default")
	};

	const workspaceFrameworkLibraryMetadata = {};
	const libraryMetadata = {};

	sinon.stub(utils, "getWorkspaceFrameworkLibraryMetadata").resolves(workspaceFrameworkLibraryMetadata);
	Sapui5ResolverInstallStub.resolves({libraryMetadata});

	const addProjectToGraphStub = sinon.stub();
	sinon.stub(utils, "ProjectProcessor")
		.callsFake(() => {
			return {
				addProjectToGraph: addProjectToGraphStub
			};
		});

	sinon.stub(utils, "declareFrameworkDependenciesInGraph").resolves();

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider, {workspace});

	await ui5Framework.enrichProjectGraph(projectGraph, {workspace});

	t.is(Sapui5ResolverStub.callCount, 1, "Sapui5Resolver#constructor should be called once");
	t.deepEqual(Sapui5ResolverStub.getCall(0).args, [{
		cacheMode: undefined,
		cwd: dependencyTree.path,
		version: "1.111.1",
		ui5DataDir: undefined,
		providedLibraryMetadata: workspaceFrameworkLibraryMetadata
	}], "Sapui5Resolver#constructor should be called with expected args");
	t.is(Sapui5ResolverStub.getCall(0).args[0].providedLibraryMetadata, workspaceFrameworkLibraryMetadata);
});

test.serial("enrichProjectGraph should allow omitting framework version in case " +
	"all framework libraries come from the workspace", async (t) => {
	const {ui5Framework, utils, Sapui5ResolverStub, Sapui5ResolverInstallStub, sinon} = t.context;
	const dependencyTree = {
		id: "@sapui5/project",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				libraries: [
					{name: "lib1"},
					{name: "lib2"}
				]
			}
		}
	};

	const workspace = {
		getName: sinon.stub().resolves("default")
	};

	const workspaceFrameworkLibraryMetadata = {};
	const libraryMetadata = {};

	sinon.stub(utils, "getWorkspaceFrameworkLibraryMetadata").resolves(workspaceFrameworkLibraryMetadata);
	Sapui5ResolverInstallStub.resolves({libraryMetadata});

	const addProjectToGraphStub = sinon.stub();
	sinon.stub(utils, "ProjectProcessor")
		.callsFake(() => {
			return {
				addProjectToGraph: addProjectToGraphStub
			};
		});

	sinon.stub(utils, "declareFrameworkDependenciesInGraph").resolves();

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider, {workspace});

	await ui5Framework.enrichProjectGraph(projectGraph, {workspace});

	t.is(Sapui5ResolverStub.callCount, 1, "Sapui5Resolver#constructor should be called once");
	t.deepEqual(Sapui5ResolverStub.getCall(0).args, [{
		cacheMode: undefined,
		cwd: dependencyTree.path,
		ui5DataDir: undefined,
		version: undefined,
		providedLibraryMetadata: workspaceFrameworkLibraryMetadata
	}], "Sapui5Resolver#constructor should be called with expected args");
	t.is(Sapui5ResolverStub.getCall(0).args[0].providedLibraryMetadata, workspaceFrameworkLibraryMetadata);
});

test.serial("enrichProjectGraph should use UI5 data dir from env var", async (t) => {
	const {sinon, ui5Framework, utils, Sapui5ResolverInstallStub} = t.context;

	const dependencyTree = {
		id: "test1",
		version: "1.0.0",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				version: "1.75.0"
			}
		}
	};

	const referencedLibraries = ["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib3"];
	const libraryMetadata = {fake: "metadata"};

	sinon.stub(utils, "getFrameworkLibrariesFromGraph")
		.resolves(referencedLibraries);

	Sapui5ResolverInstallStub.resolves({libraryMetadata});


	const addProjectToGraphStub = sinon.stub();
	sinon.stub(utils, "ProjectProcessor")
		.callsFake(() => {
			return {
				addProjectToGraph: addProjectToGraphStub
			};
		});

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	process.env.UI5_DATA_DIR = "./ui5-data-dir-from-env-var";

	const expectedUi5DataDir = path.resolve(dependencyTree.path, "./ui5-data-dir-from-env-var");

	await ui5Framework.enrichProjectGraph(projectGraph);

	t.is(t.context.Sapui5ResolverStub.callCount, 1, "Sapui5Resolver#constructor should be called once");
	t.deepEqual(t.context.Sapui5ResolverStub.getCall(0).args, [{
		cacheMode: undefined,
		cwd: dependencyTree.path,
		version: dependencyTree.configuration.framework.version,
		ui5DataDir: expectedUi5DataDir,
		providedLibraryMetadata: undefined
	}], "Sapui5Resolver#constructor should be called with expected args");
});

test.serial("enrichProjectGraph should use UI5 data dir from configuration", async (t) => {
	const {sinon, ui5Framework, utils, Sapui5ResolverInstallStub, getUi5DataDirStub} = t.context;

	const dependencyTree = {
		id: "test1",
		version: "1.0.0",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				version: "1.75.0"
			}
		}
	};

	const referencedLibraries = ["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib3"];
	const libraryMetadata = {fake: "metadata"};

	sinon.stub(utils, "getFrameworkLibrariesFromGraph")
		.resolves(referencedLibraries);

	Sapui5ResolverInstallStub.resolves({libraryMetadata});


	const addProjectToGraphStub = sinon.stub();
	sinon.stub(utils, "ProjectProcessor")
		.callsFake(() => {
			return {
				addProjectToGraph: addProjectToGraphStub
			};
		});

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	getUi5DataDirStub.returns("./ui5-data-dir-from-config");

	const expectedUi5DataDir = path.resolve(dependencyTree.path, "./ui5-data-dir-from-config");

	await ui5Framework.enrichProjectGraph(projectGraph);

	t.is(t.context.Sapui5ResolverStub.callCount, 1, "Sapui5Resolver#constructor should be called once");
	t.deepEqual(t.context.Sapui5ResolverStub.getCall(0).args, [{
		cacheMode: undefined,
		cwd: dependencyTree.path,
		version: dependencyTree.configuration.framework.version,
		ui5DataDir: expectedUi5DataDir,
		providedLibraryMetadata: undefined
	}], "Sapui5Resolver#constructor should be called with expected args");
});

test.serial("enrichProjectGraph should use absolute UI5 data dir from configuration", async (t) => {
	const {sinon, ui5Framework, utils, Sapui5ResolverInstallStub, getUi5DataDirStub} = t.context;

	const dependencyTree = {
		id: "test1",
		version: "1.0.0",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				version: "1.75.0"
			}
		}
	};

	const referencedLibraries = ["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib3"];
	const libraryMetadata = {fake: "metadata"};

	sinon.stub(utils, "getFrameworkLibrariesFromGraph")
		.resolves(referencedLibraries);

	Sapui5ResolverInstallStub.resolves({libraryMetadata});


	const addProjectToGraphStub = sinon.stub();
	sinon.stub(utils, "ProjectProcessor")
		.callsFake(() => {
			return {
				addProjectToGraph: addProjectToGraphStub
			};
		});

	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	getUi5DataDirStub.returns("/absolute-ui5-data-dir-from-config");

	const expectedUi5DataDir = path.resolve("/absolute-ui5-data-dir-from-config");

	await ui5Framework.enrichProjectGraph(projectGraph);

	t.is(t.context.Sapui5ResolverStub.callCount, 1, "Sapui5Resolver#constructor should be called once");
	t.deepEqual(t.context.Sapui5ResolverStub.getCall(0).args, [{
		cacheMode: undefined,
		cwd: dependencyTree.path,
		version: dependencyTree.configuration.framework.version,
		ui5DataDir: expectedUi5DataDir,
		providedLibraryMetadata: undefined
	}], "Sapui5Resolver#constructor should be called with expected args");
});

test.serial("utils.shouldIncludeDependency", (t) => {
	const {utils} = t.context;
	// root project dependency should always be included
	t.true(utils.shouldIncludeDependency({}, true));
	t.true(utils.shouldIncludeDependency({optional: true}, true));
	t.true(utils.shouldIncludeDependency({optional: false}, true));
	t.true(utils.shouldIncludeDependency({optional: null}, true));
	t.true(utils.shouldIncludeDependency({optional: "abc"}, true));
	t.true(utils.shouldIncludeDependency({development: true}, true));
	t.true(utils.shouldIncludeDependency({development: false}, true));
	t.true(utils.shouldIncludeDependency({development: null}, true));
	t.true(utils.shouldIncludeDependency({development: "abc"}, true));
	t.true(utils.shouldIncludeDependency({foo: true}, true));

	t.true(utils.shouldIncludeDependency({}, false));
	t.false(utils.shouldIncludeDependency({optional: true}, false));
	t.true(utils.shouldIncludeDependency({optional: false}, false));
	t.true(utils.shouldIncludeDependency({optional: null}, false));
	t.true(utils.shouldIncludeDependency({optional: "abc"}, false));
	t.false(utils.shouldIncludeDependency({development: true}, false));
	t.true(utils.shouldIncludeDependency({development: false}, false));
	t.true(utils.shouldIncludeDependency({development: null}, false));
	t.true(utils.shouldIncludeDependency({development: "abc"}, false));
	t.true(utils.shouldIncludeDependency({foo: true}, false));

	// Having both optional and development should not be the case, but that should be validated beforehand
	t.true(utils.shouldIncludeDependency({optional: true, development: true}, true));
	t.false(utils.shouldIncludeDependency({optional: true, development: true}, false));
});

test.serial("utils.getFrameworkLibrariesFromTree: Project without dependencies", async (t) => {
	const {utils} = t.context;
	const dependencyTree = {
		id: "test-id",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				version: "1.100.0",
				libraries: []
			}
		}
	};
	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	const ui5Dependencies = await utils.getFrameworkLibrariesFromGraph(projectGraph);
	t.deepEqual(ui5Dependencies, []);
});

test.serial("utils.getFrameworkLibrariesFromTree: Framework project with framework dependency", async (t) => {
	// Only root-level framework projects are scanned
	const {utils} = t.context;
	const dependencyTree = {
		id: "@sapui5/project",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				version: "1.100.0",
				libraries: [
					{
						name: "lib1"
					}
				]
			}
		},
		dependencies: [{
			id: "@openui5/test1", // Will not be scanned
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "library.d"
				},
				framework: {
					name: "OpenUI5",
					libraries: [{
						name: "lib2"
					}]
				}
			}
		}]
	};
	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	const ui5Dependencies = await utils.getFrameworkLibrariesFromGraph(projectGraph);
	t.deepEqual(ui5Dependencies, ["lib1"]);
});

test.serial("utils.getFrameworkLibrariesFromTree: Project with libraries and dependency with libraries", async (t) => {
	const {utils} = t.context;
	const dependencyTree = {
		id: "test-project",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				version: "1.100.0",
				libraries: [{
					name: "lib1"
				}, {
					name: "lib2",
					optional: true
				}, {
					name: "lib6",
					development: true
				}]
			}
		},
		dependencies: [{
			id: "test2",
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "test2"
				},
				framework: {
					name: "OpenUI5",
					libraries: [{
						name: "lib3"
					}, {
						name: "lib4",
						optional: true
					}]
				}
			},
			dependencies: [{
				id: "test3",
				version: "1.2.3",
				path: libraryEPath,
				configuration: {
					specVersion: "2.0",
					type: "library",
					metadata: {
						name: "test3"
					},
					framework: {
						name: "OpenUI5",
						libraries: [{
							name: "lib5"
						}, {
							name: "lib7",
							optional: true
						}]
					}
				}
			}]
		}, {
			id: "@openui5/lib8",
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "lib8"
				},
				framework: {
					name: "OpenUI5",
					libraries: [{
						name: "should.be.ignored"
					}]
				}
			}
		}, {
			id: "@openui5/lib9",
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "lib9"
				}
			}
		}]
	};
	const provider = new DependencyTreeProvider({dependencyTree});
	const projectGraph = await projectGraphBuilder(provider);

	const ui5Dependencies = await utils.getFrameworkLibrariesFromGraph(projectGraph);
	t.deepEqual(ui5Dependencies, ["lib1", "lib2", "lib6", "lib3", "lib5"]);
});

test.serial("utils.declareFrameworkDependenciesInGraph", async (t) => {
	const {utils, sinon, log} = t.context;
	const projectTree = {
		id: "test-project",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "application.a"
			},
			framework: {
				name: "SAPUI5",
				version: "1.100.0",
				libraries: [{
					name: "lib1"
				}, {
					name: "lib2",
					optional: true
				}, {
					name: "lib3",
					development: true
				}, {
					name: "lib5",
					optional: true
				}]
			}
		},
		dependencies: [{
			id: "library.a",
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "library.a"
				},
				framework: {
					name: "OpenUI5",
					libraries: [{
						name: "lib2"
					}, {
						name: "lib3",
						optional: true
					}, {
						name: "lib4",
						development: true
					}, {
						name: "lib5",
						optional: true
					}, {
						name: "lib6",
						optional: true
					}]
				}
			},
			dependencies: []
		}]
	};
	const frameworkTree = {
		id: "dummy-framework-tree-root",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "dummy-framework-tree-root"
			}
		},
		dependencies: [{
			id: "@openui5/lib1",
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "lib1",
					deprecated: true
				},
				framework: {
					name: "OpenUI5",
					libraries: [{
						name: "should.be.ignored"
					}]
				}
			}
		}, {
			id: "@openui5/lib2",
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "lib2",
					sapInternal: true
				}
			}
		}, {
			id: "@openui5/lib3",
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "lib3",
					deprecated: true
				}
			}
		}, {
			id: "@openui5/lib5",
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "lib5"
				}
			}
		}]
	};
	const projectGraph = await projectGraphBuilder(new DependencyTreeProvider({
		dependencyTree: projectTree
	}));
	const frameworkGraph = await projectGraphBuilder(new DependencyTreeProvider({
		dependencyTree: frameworkTree
	}));
	projectGraph.join(frameworkGraph);

	const declareDependencySpy = sinon.spy(projectGraph, "declareDependency");
	const declareOptionalDependencySpy = sinon.spy(projectGraph, "declareOptionalDependency");
	const resolveOptionalDependenciesSpy = sinon.spy(projectGraph, "resolveOptionalDependencies");
	await utils.declareFrameworkDependenciesInGraph(projectGraph);

	t.is(declareDependencySpy.callCount, 7, "declareDependency got called seven times");
	t.deepEqual(declareDependencySpy.getCall(0).args, ["application.a", "lib1"],
		"declareDependency got called with correct arguments on first call");
	t.deepEqual(declareDependencySpy.getCall(1).args, ["application.a", "lib2"],
		"declareDependency got called with correct arguments on second call");
	t.deepEqual(declareDependencySpy.getCall(2).args, ["application.a", "lib3"],
		"declareDependency got called with correct arguments on third call");
	t.deepEqual(declareDependencySpy.getCall(3).args, ["application.a", "lib5"],
		"declareDependency got called with correct arguments on fourth call");
	t.deepEqual(declareDependencySpy.getCall(4).args, ["library.a", "lib2"],
		"declareDependency got called with correct arguments on fifth call");
	t.deepEqual(declareDependencySpy.getCall(5).args, ["library.a", "lib3"],
		"declareDependency got called with correct arguments on sixth call");
	t.deepEqual(declareDependencySpy.getCall(6).args, ["library.a", "lib5"],
		"declareDependency got called with correct arguments on seventh call");
	t.is(declareOptionalDependencySpy.callCount, 2, "declareOptionalDependency got called ");
	t.deepEqual(declareOptionalDependencySpy.getCall(0).args, ["library.a", "lib3"],
		"declareOptionalDependency got called with correct arguments on first call");
	t.deepEqual(declareOptionalDependencySpy.getCall(1).args, ["library.a", "lib5"],
		"declareOptionalDependency got called with correct arguments on second call");
	t.is(resolveOptionalDependenciesSpy.callCount, 1,
		"resolveOptionalDependenciesSpy got called once");

	t.is(log.warn.callCount, 3,
		"Three warnings got logged");
	t.is(log.warn.getCall(0).args[0], "Dependency lib1 is deprecated and should not be used for new projects!",
		"Expected first warning logged");
	t.is(log.warn.getCall(1).args[0],
		`Dependency lib2 is restricted for use by SAP internal projects only! If the project application.a is ` +
		`an SAP internal project, add the attribute "allowSapInternal: true" to its metadata configuration`,
		"Expected first warning logged");
	t.is(log.warn.getCall(2).args[0], "Dependency lib3 is deprecated and should not be used for new projects!",
		"Expected first warning logged");

	t.deepEqual(projectGraph.getDependencies("application.a"), [
		"library.a",
		"lib1",
		"lib2",
		"lib3",
		"lib5"
	], `Root project has correct dependencies`);

	t.deepEqual(projectGraph.getDependencies("library.a"), [
		"lib2",
		"lib3",
		"lib5"
	], `Non-framework dependency has correct dependencies`);
});

test.serial("utils.declareFrameworkDependenciesInGraph: No deprecation warnings for testsuite projects", async (t) => {
	const {utils, log} = t.context;

	const projectTree = {
		id: "test-project",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "testsuite"
			},
			framework: {
				name: "SAPUI5",
				version: "1.100.0",
				libraries: [{
					name: "lib1"
				}, {
					name: "lib2",
					optional: true
				}, {
					name: "lib3",
					development: true
				}]
			}
		},
		dependencies: []
	};
	const frameworkTree = {
		id: "dummy-framework-tree-root",
		version: "1.2.3",
		path: applicationAPath,
		configuration: {
			specVersion: "2.0",
			type: "application",
			metadata: {
				name: "dummy-framework-tree-root"
			}
		},
		dependencies: [{
			id: "@openui5/lib1",
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "lib1",
					deprecated: true
				},
				framework: {
					name: "OpenUI5",
					libraries: [{
						name: "should.be.ignored"
					}]
				}
			}
		}, {
			id: "@openui5/lib2",
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "lib2",
					sapInternal: true
				}
			}
		}, {
			id: "@openui5/lib3",
			version: "1.2.3",
			path: libraryEPath,
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "lib3",
					deprecated: true
				}
			}
		}]
	};
	const projectGraph = await projectGraphBuilder(new DependencyTreeProvider({
		dependencyTree: projectTree
	}));
	const frameworkGraph = await projectGraphBuilder(new DependencyTreeProvider({
		dependencyTree: frameworkTree
	}));
	projectGraph.join(frameworkGraph);

	await utils.declareFrameworkDependenciesInGraph(projectGraph);

	t.is(log.warn.callCount, 1,
		"One warning got logged");

	t.is(log.warn.getCall(0).args[0],
		`Dependency lib2 is restricted for use by SAP internal projects only! If the project testsuite is ` +
		`an SAP internal project, add the attribute "allowSapInternal: true" to its metadata configuration`,
		"Expected first warning logged");

	t.deepEqual(projectGraph.getDependencies("testsuite"), [
		"lib1",
		"lib2",
		"lib3"
	], `Root project has correct dependencies`);
});

test("utils.checkForDuplicateFrameworkProjects: No duplicates", (t) => {
	const {utils, sinon} = t.context;

	const projectGraph = {
		getRoot: sinon.stub().returns({
			getName: sinon.stub().returns("root-project")
		}),
		getProjectNames: sinon.stub().returns(["lib1", "lib2", "lib3"])
	};
	const frameworkGraph = {
		getProjectNames: sinon.stub().returns(["sap.ui.core"])
	};

	t.notThrows(() => utils.checkForDuplicateFrameworkProjects(projectGraph, frameworkGraph));
});

test("utils.checkForDuplicateFrameworkProjects: One duplicate", (t) => {
	const {utils, sinon} = t.context;

	const projectGraph = {
		getRoot: sinon.stub().returns({
			getName: sinon.stub().returns("root-project")
		}),
		getProjectNames: sinon.stub().returns(["lib1", "sap.ui.core", "lib2", "lib3"])
	};
	const frameworkGraph = {
		getProjectNames: sinon.stub().returns(["sap.ui.core"])
	};

	t.throws(() => utils.checkForDuplicateFrameworkProjects(projectGraph, frameworkGraph), {
		message: "Duplicate framework dependency definition(s) found for project root-project: " +
			"sap.ui.core.\n" +
			"Framework libraries should only be referenced via ui5.yaml configuration. Neither the root project, " +
			"nor any of its dependencies should include them as direct dependencies (e.g. via package.json)."
	});
});

test("utils.checkForDuplicateFrameworkProjects: Two duplicates", (t) => {
	const {utils, sinon} = t.context;

	const projectGraph = {
		getRoot: sinon.stub().returns({
			getName: sinon.stub().returns("root-project")
		}),
		getProjectNames: sinon.stub().returns(["lib1", "sap.ui.core", "lib2", "sap.ui.layout", "lib3"])
	};
	const frameworkGraph = {
		getProjectNames: sinon.stub().returns(["sap.ui.core", "sap.ui.layout", "sap.m"])
	};

	t.throws(() => utils.checkForDuplicateFrameworkProjects(projectGraph, frameworkGraph), {
		message: "Duplicate framework dependency definition(s) found for project root-project: " +
			"sap.ui.core, sap.ui.layout.\n" +
			"Framework libraries should only be referenced via ui5.yaml configuration. Neither the root project, " +
			"nor any of its dependencies should include them as direct dependencies (e.g. via package.json)."
	});
});

test("utils.getFrameworkLibraryDependencies: OpenUI5 library", async (t) => {
	const {utils, sinon} = t.context;

	const project = {
		getId: sinon.stub().returns("@openui5/sap.ui.lib1"),
		getRootReader: sinon.stub().returns({
			byPath: sinon.stub().withArgs("/package.json").resolves({
				getString: sinon.stub().resolves(JSON.stringify({
					dependencies: {
						"@openui5/sap.ui.lib2": "*"
					},
					devDependencies: {
						"@openui5/themelib_fancy": "*"
					}
				}))
			})
		}),
	};

	const result = await utils.getFrameworkLibraryDependencies(project);
	t.deepEqual(result, {
		dependencies: ["sap.ui.lib2"],
		optionalDependencies: ["themelib_fancy"]
	});
});

test("utils.getFrameworkLibraryDependencies: SAPUI5 library", async (t) => {
	const {utils, sinon} = t.context;

	const project = {
		getId: sinon.stub().returns("@sapui5/sap.ui.lib1"),
		getFrameworkDependencies: sinon.stub().returns([
			{
				name: "sap.ui.lib2"
			},
			{
				name: "themelib_fancy",
				optional: true
			},
			{
				name: "sap.ui.lib3",
				development: true
			}
		])
	};

	const result = await utils.getFrameworkLibraryDependencies(project);
	t.deepEqual(result, {
		dependencies: ["sap.ui.lib2"],
		optionalDependencies: ["themelib_fancy"]
	});
});

test("utils.getFrameworkLibraryDependencies: OpenUI5 library - no dependencies", async (t) => {
	const {utils, sinon} = t.context;

	const project = {
		getId: sinon.stub().returns("@openui5/sap.ui.lib1"),
		getRootReader: sinon.stub().returns({
			byPath: sinon.stub().withArgs("/package.json").resolves({
				getString: sinon.stub().resolves(JSON.stringify({}))
			})
		}),
	};

	const result = await utils.getFrameworkLibraryDependencies(project);
	t.deepEqual(result, {
		dependencies: [],
		optionalDependencies: []
	});
});

test("utils.getFrameworkLibraryDependencies: No framework library", async (t) => {
	const {utils, sinon} = t.context;

	const project = {
		getId: sinon.stub().returns("foo")
	};

	const result = await utils.getFrameworkLibraryDependencies(project);
	t.deepEqual(result, {
		dependencies: [],
		optionalDependencies: []
	});
});

test("utils.getWorkspaceFrameworkLibraryMetadata: No workspace modules", async (t) => {
	const {utils, sinon} = t.context;

	const workspace = {
		getModules: sinon.stub().resolves([])
	};

	const libraryMetadata = await utils.getWorkspaceFrameworkLibraryMetadata({workspace, projectGraph: {}});

	t.deepEqual(libraryMetadata, {});
});

test("utils.getWorkspaceFrameworkLibraryMetadata: With workspace modules", async (t) => {
	const {utils, sinon} = t.context;

	const workspace = {
		getModules: sinon.stub().resolves([
			{
				// Extensions don't have projects, should be ignored
				getSpecifications: sinon.stub().resolves({
					project: null
				})
			},
			{
				getSpecifications: sinon.stub().resolves({
					project: {
						// some types don't have a "isFrameworkProject" method
					}
				})
			},
			{
				getSpecifications: sinon.stub().resolves({
					project: {
						isFrameworkProject: sinon.stub().returns(false)
					}
				})
			},
			{
				getSpecifications: sinon.stub().resolves({
					project: {
						isFrameworkProject: sinon.stub().returns(true),
						getName: sinon.stub().returns("sap.ui.lib1"),
						getId: sinon.stub().returns("@openui5/sap.ui.lib1"),
						getRootPath: sinon.stub().returns("/rootPath"),
						getRootReader: sinon.stub().returns({
							byPath: sinon.stub().withArgs("/package.json").resolves({
								getString: sinon.stub().resolves(JSON.stringify({
									dependencies: {
										"@openui5/sap.ui.lib2": "*"
									},
									devDependencies: {
										"@openui5/themelib_fancy": "*"
									}
								}))
							})
						}),
						getVersion: sinon.stub().returns("1.0.0"),
					}
				})
			},
			{
				getSpecifications: sinon.stub().resolves({
					project: {
						isFrameworkProject: sinon.stub().returns(true),
						getName: sinon.stub().returns("sap.ui.lib3"),
						getId: sinon.stub().returns("@sapui5/sap.ui.lib3"),
						getRootPath: sinon.stub().returns("/rootPath"),
						getVersion: sinon.stub().returns("1.0.0"),
						getFrameworkDependencies: sinon.stub().returns([
							{
								name: "sap.ui.lib4"
							},
							{
								name: "sap.ui.lib5",
								optional: true
							},
							{
								name: "sap.ui.lib6",
								development: true
							}
						])
					}
				})
			}
		])
	};

	const getProject = sinon.stub();
	getProject.withArgs("sap.ui.lib1").returns(undefined);
	const projectGraph = {
		getProject
	};

	const libraryMetadata = await utils.getWorkspaceFrameworkLibraryMetadata({workspace, projectGraph});

	t.deepEqual(libraryMetadata, {
		"sap.ui.lib1": {
			dependencies: [
				"sap.ui.lib2"
			],
			id: "@openui5/sap.ui.lib1",
			optionalDependencies: [
				"themelib_fancy"
			],
			path: "/rootPath",
			version: "1.0.0"
		},
		"sap.ui.lib3": {
			dependencies: [
				"sap.ui.lib4"
			],
			id: "@sapui5/sap.ui.lib3",
			optionalDependencies: [
				"sap.ui.lib5"
			],
			path: "/rootPath",
			version: "1.0.0"
		},
	});
});

test("utils.getWorkspaceFrameworkLibraryMetadata: With workspace module within projectGraph", async (t) => {
	const {utils, sinon} = t.context;

	const workspace = {
		getModules: sinon.stub().resolves([
			{
				getSpecifications: sinon.stub().resolves({
					project: {
						isFrameworkProject: sinon.stub().returns(true),
						getName: sinon.stub().returns("sap.ui.lib1")
					}
				})
			}
		])
	};

	const getProject = sinon.stub();
	getProject.withArgs("sap.ui.lib1").returns({});
	const projectGraph = {
		getProject
	};

	const libraryMetadata = await utils.getWorkspaceFrameworkLibraryMetadata({workspace, projectGraph});

	t.deepEqual(libraryMetadata, {});
});

test.serial("ProjectProcessor: Add project to graph", async (t) => {
	const {sinon} = t.context;
	const {ProjectProcessor} = t.context.utils;
	const graphMock = {
		getProject: sinon.stub().returns(),
		addProject: sinon.stub()
	};
	const projectProcessor = new ProjectProcessor({
		libraryMetadata: {
			"library.e": {
				id: "lib.e.id",
				version: "1000.0.0",
				path: libraryEPath,
				dependencies: [],
				optionalDependencies: []
			}
		},
		graph: graphMock
	});

	await projectProcessor.addProjectToGraph("library.e");
	t.is(graphMock.getProject.callCount, 1, "graph#getProject got called once");
	t.is(graphMock.getProject.getCall(0).args[0], "library.e", "graph#getProject got called with the correct argument");
	t.is(graphMock.addProject.callCount, 1, "graph#addProject got called once");
	t.is(graphMock.addProject.getCall(0).args[0].getName(), "library.e",
		"graph#addProject got called with the correct project");
});

test.serial("ProjectProcessor: Add same project twice", async (t) => {
	const {sinon} = t.context;
	const {ProjectProcessor} = t.context.utils;
	const graphMock = {
		getProject: sinon.stub().returns(),
		addProject: sinon.stub()
	};
	const projectProcessor = new ProjectProcessor({
		libraryMetadata: {
			"library.e": {
				id: "lib.e.id",
				version: "1000.0.0",
				path: libraryEPath,
				dependencies: [],
				optionalDependencies: []
			}
		},
		graph: graphMock
	});

	await projectProcessor.addProjectToGraph("library.e");
	await projectProcessor.addProjectToGraph("library.e");
	t.is(graphMock.getProject.callCount, 1, "graph#getProject got called once");
	t.is(graphMock.getProject.getCall(0).args[0], "library.e", "graph#getProject got called with the correct argument");
	t.is(graphMock.addProject.callCount, 1, "graph#addProject got called once");
	t.is(graphMock.addProject.getCall(0).args[0].getName(), "library.e",
		"graph#addProject got called with the correct project");
});

test.serial("ProjectProcessor: Project already in graph", async (t) => {
	const {sinon} = t.context;
	const {ProjectProcessor} = t.context.utils;
	const graphMock = {
		getProject: sinon.stub().returns("project"),
		addProject: sinon.stub()
	};
	const projectProcessor = new ProjectProcessor({
		libraryMetadata: {
			"library.e": {
				id: "lib.e.id",
				version: "1000.0.0",
				path: libraryEPath,
				dependencies: [],
				optionalDependencies: []
			}
		},
		graph: graphMock
	});

	await projectProcessor.addProjectToGraph("library.e");
	t.is(graphMock.getProject.callCount, 1, "graph#getProject got called once");
	t.is(graphMock.getProject.getCall(0).args[0], "library.e", "graph#getProject got called with the correct argument");
	t.is(graphMock.addProject.callCount, 0, "graph#addProject never got called");
});

test.serial("ProjectProcessor: Add project with dependencies to graph", async (t) => {
	const {sinon} = t.context;
	const {ProjectProcessor} = t.context.utils;
	const graphMock = {
		getProject: sinon.stub().returns(),
		addProject: sinon.stub(),
		declareDependency: sinon.stub()
	};
	const projectProcessor = new ProjectProcessor({
		libraryMetadata: {
			"library.e": {
				id: "lib.e.id",
				version: "1000.0.0",
				path: libraryEPath,
				dependencies: ["library.d"],
				optionalDependencies: []
			},
			"library.d": {
				id: "lib.d.id",
				version: "120000.0.0",
				path: libraryDPath,
				dependencies: [],
				optionalDependencies: []
			}
		},
		graph: graphMock
	});

	await projectProcessor.addProjectToGraph("library.e");
	t.is(graphMock.getProject.callCount, 2, "graph#getProject got called twice");
	t.is(graphMock.getProject.getCall(0).args[0], "library.e", "graph#getProject got called with the correct argument");
	t.is(graphMock.getProject.getCall(1).args[0], "library.d", "graph#getProject got called with the correct argument");
	t.is(graphMock.addProject.callCount, 2, "graph#addProject got called twice");
	t.is(graphMock.addProject.getCall(0).args[0].getName(), "library.d",
		"graph#addProject got called with the correct project");
	t.is(graphMock.addProject.getCall(1).args[0].getName(), "library.e",
		"graph#addProject got called with the correct project");
	t.is(graphMock.declareDependency.callCount, 1, "graph#declareDependency got called once");
	t.deepEqual(graphMock.declareDependency.getCall(0).args, ["library.e", "library.d"],
		"graph#declareDependency got called with the correct arguments");
});

test.serial("ProjectProcessor: Resolve project via workspace", async (t) => {
	const {sinon} = t.context;
	const {ProjectProcessor} = t.context.utils;
	const graphMock = {
		getProject: sinon.stub().returns(),
		addProject: sinon.stub(),
		declareDependency: sinon.stub()
	};
	const libraryEProjectMock = {
		getName: () => "library.e",
		getFrameworkDependencies: sinon.stub().returns([{
			name: "library.d"
		}])
	};
	const libraryDProjectMock = {
		getName: () => "library.d",
		getFrameworkDependencies: sinon.stub().returns([])
	};
	const moduleMock = {
		getVersion: () => "1.0.0",
		getPath: () => path.join("module", "path"),
		getSpecifications: sinon.stub()
			.onFirstCall().resolves({
				project: libraryDProjectMock
			})
			.onSecondCall().resolves({
				project: libraryEProjectMock
			})
	};
	const workspaceMock = {
		getName: sinon.stub().returns("workspace name"),
		getModuleByProjectName: sinon.stub().resolves(moduleMock),
	};
	const projectProcessor = new ProjectProcessor({
		libraryMetadata: {
			"library.e": {
				id: "lib.e.id",
				version: "1000.0.0",
				path: libraryEPath,
				dependencies: ["library.d"],
				optionalDependencies: []
			},
			"library.d": {
				id: "lib.d.id",
				version: "120000.0.0",
				path: libraryDPath,
				dependencies: [],
				optionalDependencies: []
			}
		},
		graph: graphMock,
		workspace: workspaceMock
	});

	await projectProcessor.addProjectToGraph("library.e");
	t.is(graphMock.getProject.callCount, 2, "graph#getProject got called twice");
	t.is(graphMock.getProject.getCall(0).args[0], "library.e", "graph#getProject got called with the correct argument");
	t.is(graphMock.getProject.getCall(1).args[0], "library.d", "graph#getProject got called with the correct argument");
	t.is(graphMock.addProject.callCount, 2, "graph#addProject got called once");
	t.is(graphMock.addProject.getCall(0).args[0].getName(), "library.d",
		"graph#addProject got called with the correct project");
	t.is(graphMock.addProject.getCall(1).args[0].getName(), "library.e",
		"graph#addProject got called with the correct project");
	t.is(graphMock.declareDependency.callCount, 1, "graph#declareDependency got called once");
	t.deepEqual(graphMock.declareDependency.getCall(0).args, ["library.e", "library.d"],
		"graph#declareDependency got called with the correct arguments");
});

test.serial("ProjectProcessor: Resolve project via workspace with additional dependency", async (t) => {
	const {sinon} = t.context;
	const {ProjectProcessor} = t.context.utils;
	const graphMock = {
		getProject: sinon.stub().returns(),
		addProject: sinon.stub(),
		declareDependency: sinon.stub()
	};
	const libraryEProjectMock = {
		getName: () => "library.e",
		getFrameworkDependencies: sinon.stub().returns([{
			name: "library.d"
		}])
	};
	const libraryDProjectMock = {
		getName: () => "library.d",
		getFrameworkDependencies: sinon.stub().returns([])
	};
	const moduleMock = {
		getVersion: () => "1.0.0",
		getPath: () => path.join("module", "path"),
		getSpecifications: sinon.stub()
			.onFirstCall().resolves({
				project: libraryEProjectMock
			})
			.onSecondCall().resolves({
				project: libraryDProjectMock
			})
	};
	const workspaceMock = {
		getName: sinon.stub().returns("workspace name"),
		getModuleByProjectName: sinon.stub().resolves(moduleMock),
	};
	const projectProcessor = new ProjectProcessor({
		libraryMetadata: {
			"library.e": {
				id: "lib.e.id",
				version: "1000.0.0",
				path: libraryEPath,
				dependencies: [], // Dependency to library.d is only declared in workspace-resolved library.e
				optionalDependencies: []
			},
			"library.d": {
				id: "lib.d.id",
				version: "120000.0.0",
				path: libraryDPath,
				dependencies: [],
				optionalDependencies: []
			}
		},
		graph: graphMock,
		workspace: workspaceMock
	});

	await projectProcessor.addProjectToGraph("library.e");
	t.is(graphMock.getProject.callCount, 2, "graph#getProject got called twice");
	t.is(graphMock.getProject.getCall(0).args[0], "library.e", "graph#getProject got called with the correct argument");
	t.is(graphMock.getProject.getCall(1).args[0], "library.d", "graph#getProject got called with the correct argument");
	t.is(graphMock.addProject.callCount, 2, "graph#addProject got called once");
	t.is(graphMock.addProject.getCall(0).args[0].getName(), "library.e",
		"graph#addProject got called with the correct project");
	t.is(graphMock.addProject.getCall(1).args[0].getName(), "library.d",
		"graph#addProject got called with the correct project");
	t.is(graphMock.declareDependency.callCount, 1, "graph#declareDependency got called once");
	t.deepEqual(graphMock.declareDependency.getCall(0).args, ["library.e", "library.d"],
		"graph#declareDependency got called with the correct arguments");
});

test.serial("ProjectProcessor: Resolve project via workspace with additional, unknown dependency", async (t) => {
	const {sinon} = t.context;
	const {ProjectProcessor} = t.context.utils;
	const graphMock = {
		getProject: sinon.stub().returns(),
		addProject: sinon.stub(),
		declareDependency: sinon.stub()
	};
	const libraryEProjectMock = {
		getName: () => "library.e",
		getFrameworkDependencies: sinon.stub().returns([{
			name: "library.xyz"
		}])
	};
	const libraryDProjectMock = {
		getName: () => "library.d",
		getFrameworkDependencies: sinon.stub().returns([])
	};
	const moduleMock = {
		getVersion: () => "1.0.0",
		getPath: () => path.join("module", "path"),
		getSpecifications: sinon.stub()
			.onFirstCall().resolves({
				project: libraryEProjectMock
			})
			.onSecondCall().resolves({
				project: libraryDProjectMock
			})
	};
	const workspaceMock = {
		getName: sinon.stub().returns("workspace name"),
		getModuleByProjectName: sinon.stub().resolves(moduleMock),
	};
	const projectProcessor = new ProjectProcessor({
		libraryMetadata: {
			"library.e": {
				id: "lib.e.id",
				version: "1000.0.0",
				path: libraryEPath,
				dependencies: ["library.d"],
				optionalDependencies: []
			},
			"library.d": {
				id: "lib.d.id",
				version: "120000.0.0",
				path: libraryDPath,
				dependencies: [],
				optionalDependencies: []
			}
		},
		graph: graphMock,
		workspace: workspaceMock
	});

	await t.throwsAsync(projectProcessor.addProjectToGraph("library.e"), {
		message:
			"Unable to find dependency library.xyz, required by project library.e " +
			"(resolved via workspace name workspace) " +
			"in current set of libraries. Try adding it temporarily to the root project's dependencies"
	}, "Threw with expected error message");
});

test.serial("ProjectProcessor: Resolve project via workspace with cyclic dependency", async (t) => {
	const {sinon} = t.context;
	const {ProjectProcessor} = t.context.utils;
	const graphMock = {
		getProject: sinon.stub().returns(),
		addProject: sinon.stub(),
		declareDependency: sinon.stub()
	};
	const libraryEProjectMock = {
		getName: () => "library.e",
		getFrameworkDependencies: sinon.stub().returns([{
			name: "library.d"
		}])
	};
	const libraryDProjectMock = {
		getName: () => "library.d",
		getFrameworkDependencies: sinon.stub().returns([{
			name: "library.e" // Cyclic dependency in workspace project
		}])
	};
	const moduleMock = {
		getVersion: () => "1.0.0",
		getPath: () => path.join("module", "path"),
		getSpecifications: sinon.stub()
			.onFirstCall().resolves({
				project: libraryEProjectMock
			})
			.onSecondCall().resolves({
				project: libraryDProjectMock
			})
	};
	const workspaceMock = {
		getName: sinon.stub().returns("workspace name"),
		getModuleByProjectName: sinon.stub().resolves(moduleMock),
	};
	const projectProcessor = new ProjectProcessor({
		libraryMetadata: {
			"library.e": {
				id: "lib.e.id",
				version: "1000.0.0",
				path: libraryEPath,
				dependencies: ["library.d"],
				optionalDependencies: []
			},
			"library.d": {
				id: "lib.d.id",
				version: "120000.0.0",
				path: libraryDPath,
				dependencies: [],
				optionalDependencies: []
			}
		},
		graph: graphMock,
		workspace: workspaceMock
	});

	await t.throwsAsync(projectProcessor.addProjectToGraph("library.e"), {
		message:
			"ui5Framework:ProjectPreprocessor: Detected cyclic dependency chain: " +
			"library.e -> *library.d* -> *library.d*"
	}, "Threw with expected error message");
});

test.serial("ProjectProcessor: Resolve project via workspace with distant cyclic dependency", async (t) => {
	const {sinon} = t.context;
	const {ProjectProcessor} = t.context.utils;
	const graphMock = {
		getProject: sinon.stub().returns(),
		addProject: sinon.stub(),
		declareDependency: sinon.stub()
	};
	const libraryEProjectMock = {
		getName: () => "library.e",
		getFrameworkDependencies: sinon.stub().returns([{
			name: "library.d"
		}])
	};
	const libraryDProjectMock = {
		getName: () => "library.d",
		getFrameworkDependencies: sinon.stub().returns([{
			name: "library.f"
		}])
	};
	const libraryFProjectMock = {
		getName: () => "library.f",
		getFrameworkDependencies: sinon.stub().returns([{
			name: "library.e" // Cyclic dependency in workspace project
		}])
	};
	const moduleMock = {
		getVersion: () => "1.0.0",
		getPath: () => path.join("module", "path"),
		getSpecifications: sinon.stub()
			.onFirstCall().resolves({
				project: libraryEProjectMock
			})
			.onSecondCall().resolves({
				project: libraryDProjectMock
			})
			.onThirdCall().resolves({
				project: libraryFProjectMock
			})
	};
	const workspaceMock = {
		getName: sinon.stub().returns("workspace name"),
		getModuleByProjectName: sinon.stub().resolves(moduleMock),
	};
	const projectProcessor = new ProjectProcessor({
		libraryMetadata: {
			"library.e": {
				id: "lib.e.id",
				version: "1000.0.0",
				path: libraryEPath,
				dependencies: ["library.d"],
				optionalDependencies: []
			},
			"library.d": {
				id: "lib.d.id",
				version: "120000.0.0",
				path: libraryDPath,
				dependencies: ["library.f"],
				optionalDependencies: []
			},
			"library.f": {
				id: "lib.f.id",
				version: "1.0.0",
				path: libraryFPath,
				dependencies: [],
				optionalDependencies: []
			},
		},
		graph: graphMock,
		workspace: workspaceMock
	});

	await t.throwsAsync(projectProcessor.addProjectToGraph("library.e"), {
		message:
			"ui5Framework:ProjectPreprocessor: Detected cyclic dependency chain: " +
			"library.e -> *library.d* -> library.f -> *library.d*"
	}, "Threw with expected error message");
});

test.serial("ProjectProcessor: Project missing in metadata", async (t) => {
	const {sinon} = t.context;
	const {ProjectProcessor} = t.context.utils;
	const graphMock = {
		getProject: sinon.stub().returns(),
		addProject: sinon.stub()
	};
	const projectProcessor = new ProjectProcessor({
		libraryMetadata: {
			"lib.x": {}
		},
		graph: graphMock
	});

	await t.throwsAsync(projectProcessor.addProjectToGraph("lib.a"), {
		message: "Failed to find library lib.a in dist packages metadata.json"
	}, "Threw with expected error message");
});
