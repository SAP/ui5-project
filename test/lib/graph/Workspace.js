import path from "node:path";
import {fileURLToPath} from "node:url";
import test from "ava";
import sinonGlobal from "sinon";
import esmock from "esmock";
import Module from "../../../lib/graph/Module.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libraryD = path.join(__dirname, "..", "..", "fixtures", "library.d");
const libraryE = path.join(__dirname, "..", "..", "fixtures", "library.e");
const collectionLibraryA = path.join(__dirname, "..", "..", "fixtures", "collection", "library.a");
const collectionLibraryB = path.join(__dirname, "..", "..", "fixtures", "collection", "library.b");
const collectionLibraryC = path.join(__dirname, "..", "..", "fixtures", "collection", "library.c");
const collectionBLibraryA = path.join(__dirname, "..", "..", "fixtures", "collection.b", "library.a");
const collectionBLibraryB = path.join(__dirname, "..", "..", "fixtures", "collection.b", "library.b");
const collectionBLibraryC = path.join(__dirname, "..", "..", "fixtures", "collection.b", "library.c");

function createWorkspaceConfig({dependencyManagement}) {
	return {
		specVersion: "2.3",
		metadata: {
			name: "workspace-name"
		},
		dependencyManagement
	};
}

test.beforeEach(async (t) => {
	const sinon = t.context.sinon = sinonGlobal.createSandbox();

	t.context.log = {
		warn: sinon.stub(),
		verbose: sinon.stub(),
		error: sinon.stub(),
		info: sinon.stub(),
		isLevelEnabled: () => true
	};

	t.context.Workspace = await esmock.p("../../../lib/graph/Workspace.js", {
		"@ui5/logger": {
			getLogger: sinon.stub().withArgs("graph:Workspace").returns(t.context.log)
		}
	});
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
	esmock.purge(t.context.ProjectGraph);
});

test("Basic resolution", async (t) => {
	const workspace = new t.context.Workspace({
		cwd: __dirname,
		configuration: createWorkspaceConfig({
			dependencyManagement: {
				resolutions: [{
					path: "../../fixtures/library.d"
				}, {
					path: "../../fixtures/library.e"
				}]
			}
		})
	});

	t.is(workspace.getName(), "workspace-name");

	const {projectNameMap, moduleIdMap} = await workspace._getResolvedModules();
	t.deepEqual(Array.from(projectNameMap.keys()).sort(), ["library.d", "library.e"], "Correct project name keys");

	const libE = projectNameMap.get("library.e");
	t.true(libE instanceof Module, "library.e value is instance of Module");
	t.is(libE.getVersion(), "1.0.0", "Correct version for library.e");
	t.is(libE.getPath(), libraryE, "Correct path for library.e");

	const libD = projectNameMap.get("library.d");
	t.true(libD instanceof Module, "library.d value is instance of Module");
	t.is(libD.getVersion(), "1.0.0", "Correct version for library.d");
	t.is(libD.getPath(), libraryD, "Correct path for library.d");

	t.is(await workspace.getModuleByProjectName("library.d"), libD,
		"getModuleByProjectName returns correct module for library.d");
	t.is(await workspace.getModuleByNodeId("library.d"), libD,
		"getModuleByNodeId returns correct module for library.d");

	t.deepEqual(Array.from(moduleIdMap.keys()).sort(), ["library.d", "library.e"], "Correct module ID keys");
	moduleIdMap.forEach((value, key) => {
		t.is(value, projectNameMap.get(key), `Same instance of module ${key} in both maps`);
	});
});

test("Package workspace resolution: Static patterns", async (t) => {
	const workspace = new t.context.Workspace({
		cwd: __dirname,
		configuration: createWorkspaceConfig({
			dependencyManagement: {
				resolutions: [{
					path: "../../fixtures/collection"
				}]
			}
		})
	});

	const {projectNameMap, moduleIdMap} = await workspace._getResolvedModules();
	t.deepEqual(Array.from(projectNameMap.keys()).sort(), ["library.a", "library.b", "library.c"],
		"Correct project name keys");

	const libA = projectNameMap.get("library.a");
	t.true(libA instanceof Module, "library.a value is instance of Module");
	t.is(libA.getVersion(), "1.0.0", "Correct version for library.a");
	t.is(libA.getPath(), collectionLibraryA, "Correct path for library.a");

	const libB = projectNameMap.get("library.b");
	t.true(libB instanceof Module, "library.b value is instance of Module");
	t.is(libB.getVersion(), "1.0.0", "Correct version for library.b");
	t.is(libB.getPath(), collectionLibraryB, "Correct path for library.b");

	const libC = projectNameMap.get("library.c");
	t.true(libC instanceof Module, "library.c value is instance of Module");
	t.is(libC.getVersion(), "1.0.0", "Correct version for library.c");
	t.is(libC.getPath(), collectionLibraryC, "Correct path for library.c");

	t.deepEqual(Array.from(moduleIdMap.keys()).sort(), ["library.a", "library.b", "library.c"],
		"Correct module ID keys");
	moduleIdMap.forEach((value, key) => {
		t.is(value, projectNameMap.get(key), `Same instance of module ${key} in both maps`);
	});
});

test("Package workspace resolution: Dynamic patterns", async (t) => {
	const workspace = new t.context.Workspace({
		cwd: __dirname,
		configuration: createWorkspaceConfig({
			dependencyManagement: {
				resolutions: [{
					path: "../../fixtures/collection.b"
				}]
			}
		})
	});

	const {projectNameMap, moduleIdMap} = await workspace._getResolvedModules();
	t.deepEqual(Array.from(projectNameMap.keys()).sort(), ["library.a", "library.b", "library.c"],
		"Correct project name keys");

	const libA = projectNameMap.get("library.a");
	t.true(libA instanceof Module, "library.a value is instance of Module");
	t.is(libA.getVersion(), "1.0.0", "Correct version for library.a");
	t.is(libA.getPath(), collectionBLibraryA, "Correct path for library.a");

	const libB = projectNameMap.get("library.b");
	t.true(libB instanceof Module, "library.b value is instance of Module");
	t.is(libB.getVersion(), "1.0.0", "Correct version for library.b");
	t.is(libB.getPath(), collectionBLibraryB, "Correct path for library.b");

	const libC = projectNameMap.get("library.c");
	t.true(libC instanceof Module, "library.c value is instance of Module");
	t.is(libC.getVersion(), "1.0.0", "Correct version for library.c");
	t.is(libC.getPath(), collectionBLibraryC, "Correct path for library.c");

	t.deepEqual(Array.from(moduleIdMap.keys()).sort(), ["library.a", "library.b", "library.c"],
		"Correct module ID keys");
	moduleIdMap.forEach((value, key) => {
		t.is(value, projectNameMap.get(key), `Same instance of module ${key} in both maps`);
	});
});

test("Package workspace resolution: Nested workspace", async (t) => {
	const workspace = new t.context.Workspace({
		cwd: __dirname,
		configuration: createWorkspaceConfig({
			dependencyManagement: {
				resolutions: [{
					path: "../../fixtures/library.xyz"
				}]
			}
		})
	});

	const readPackageJsonStub = t.context.sinon.stub(workspace, "_readPackageJson").onFirstCall().resolves({
		name: "First Package",
		ui5: {
			workspaces: [
				"workspace-a",
				"workspace-b"
			]
		}
	}).onSecondCall().resolves({
		name: "Second Package",
		ui5: {
			workspaces: [
				"workspace-c",
				"workspace-d"
			]
		}
	}).onThirdCall().resolves({
		name: "Third Package",
		workspaces: [
			"workspace-e",
			"workspace-f"
		]
	});

	const {projectNameMap, moduleIdMap} = await workspace._getResolvedModules();
	// All workspaces. Should not resolve to any module
	// Nested workspaces should not get resolved
	t.is(readPackageJsonStub.callCount, 3, "readPackageJson got called three times");
	t.is(projectNameMap.size, 0, "Project name to module map is empty");
	t.is(moduleIdMap.size, 0, "Module ID to module map is empty");
});

test("Package workspace resolution: Package workspace resolves to many modules", async (t) => {
	// This should generally not happen. Currently this test is only *really* required for code coverage reasons

	const {sinon} = t.context;
	const workspace = new t.context.Workspace({
		cwd: __dirname,
		configuration: createWorkspaceConfig({
			dependencyManagement: {
				resolutions: [{
					path: "../../fixtures/library.xyz"
				}]
			}
		})
	});

	sinon.stub(workspace, "_readPackageJson").onFirstCall().resolves({
		name: "First Package",
		workspaces: [
			"workspace-a",
			"workspace-b"
		]
	});

	sinon.stub(workspace, "_getModulesFromPath").callThrough().onSecondCall().resolves([
		"module 1",
		"module 2"
	]);

	await t.throwsAsync(workspace._getResolvedModules(), {
		message:
			`Workspace of module First Package at ${path.join(__dirname, "..", "..", "fixtures", "library.xyz")} ` +
			`unexpectedly resolved to multiple modules`
	}, "Threw with expected error message");
});

test("No resolutions configuration", async (t) => {
	const workspace = new t.context.Workspace({
		cwd: __dirname,
		configuration: createWorkspaceConfig({
			dependencyManagement: {}
		})
	});

	t.is(workspace.getName(), "workspace-name");

	const {projectNameMap, moduleIdMap} = await workspace._getResolvedModules();
	t.is(projectNameMap.size, 0, "Project name to module map is empty");
	t.is(moduleIdMap.size, 0, "Module ID to module map is empty");

	t.falsy(await workspace.getModuleByProjectName("library.e"),
		"getModuleByProjectName yields no result for library.e");
	t.falsy(await workspace.getModuleByNodeId("library.e"),
		"getModuleByNodeId yields no result for library.e");
});

test("Empty dependencyManagement configuration", async (t) => {
	const workspace = new t.context.Workspace({
		cwd: __dirname,
		configuration: createWorkspaceConfig({
			dependencyManagement: {}
		})
	});

	t.is(workspace.getName(), "workspace-name");

	const {projectNameMap, moduleIdMap} = await workspace._getResolvedModules();
	t.is(projectNameMap.size, 0, "Project name to module map is empty");
	t.is(moduleIdMap.size, 0, "Module ID to module map is empty");
});

test("Empty resolutions configuration", async (t) => {
	const workspace = new t.context.Workspace({
		cwd: __dirname,
		configuration: createWorkspaceConfig({
			dependencyManagement: {
				resolutions: []
			}
		})
	});

	t.is(workspace.getName(), "workspace-name");

	const {projectNameMap, moduleIdMap} = await workspace._getResolvedModules();
	t.is(projectNameMap.size, 0, "Project name to module map is empty");
	t.is(moduleIdMap.size, 0, "Module ID to module map is empty");
});

test("Missing path in resolution", async (t) => {
	const workspace = new t.context.Workspace({
		cwd: __dirname,
		configuration: createWorkspaceConfig({
			dependencyManagement: {
				resolutions: [{}]
			}
		})
	});

	await t.throwsAsync(workspace._getResolvedModules(), {
		message: "Missing property 'path' in dependency resolution configuration of workspace workspace-name"
	}, "Threw with expected error message");
});

test("Invalid resolutions configuration", async (t) => {
	const workspace = new t.context.Workspace({
		cwd: __dirname,
		configuration: createWorkspaceConfig({
			dependencyManagement: {
				resolutions: [{
					path: "../../fixtures/does-not-exist"
				}]
			}
		})
	});

	await t.throwsAsync(workspace._getResolvedModules(), {
		message:
			/Failed to resolve workspace-resolutions path \.\.\/\.\.\/fixtures\/does-not-exist: ENOENT:/
	}, "Threw with expected error message");
});

test("Resolution does not lead to a project", async (t) => {
	const workspace = new t.context.Workspace({
		cwd: __dirname,
		configuration: createWorkspaceConfig({
			dependencyManagement: {
				resolutions: [{
					path: "../../fixtures/extension.a"
				}]
			}
		})
	});

	t.is(workspace.getName(), "workspace-name");

	const {projectNameMap, moduleIdMap} = await workspace._getResolvedModules();
	t.is(projectNameMap.size, 0, "Project name to module map is empty");
	t.is(moduleIdMap.size, 0, "Module ID to module map is empty");
});

test("Missing parameters", (t) => {
	t.throws(() => {
		new t.context.Workspace({
			configuration: {metadata: {name: "config-a"}}
		});
	}, {
		message: "[Workspace] One or more mandatory parameters not provided"
	}, "Threw with expected error message");

	t.throws(() => {
		new t.context.Workspace({
			cwd: "cwd"
		});
	}, {
		message: "[Workspace] One or more mandatory parameters not provided"
	}, "Threw with expected error message");
});
