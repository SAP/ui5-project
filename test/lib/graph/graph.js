import test from "ava";
import {fileURLToPath} from "node:url";
import path from "node:path";
import sinonGlobal from "sinon";
import esmock from "esmock";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fixturesPath = path.join(__dirname, "..", "..", "fixtures");

test.beforeEach(async (t) => {
	const sinon = t.context.sinon = sinonGlobal.createSandbox();

	t.context.npmProviderConstructorStub = sinon.stub();
	class DummyNpmProvider {
		constructor(params) {
			t.context.npmProviderConstructorStub(params);
		}
	}

	t.context.DummyNpmProvider = DummyNpmProvider;

	t.context.workspaceConstructorStub = sinon.stub();
	class DummyWorkspace {
		constructor(params) {
			t.context.workspaceConstructorStub(params);
		}
	}
	t.context.DummyWorkspace = DummyWorkspace;

	t.context.dependencyTreeProviderStub = sinon.stub();
	class DummyDependencyTreeProvider {
		constructor(params) {
			t.context.dependencyTreeProviderStub(params);
		}
	}
	t.context.DummyDependencyTreeProvider = DummyDependencyTreeProvider;

	t.context.projectGraphBuilderStub = sinon.stub().resolves("graph");
	t.context.enrichProjectGraphStub = sinon.stub();
	t.context.graph = await esmock.p("../../../lib/graph/graph.js", {
		"../../../lib/graph/providers/NodePackageDependencies.js": t.context.DummyNpmProvider,
		"../../../lib/graph/providers/DependencyTree.js": t.context.DummyDependencyTreeProvider,
		"../../../lib/graph/Workspace.js": t.context.DummyWorkspace,
		"../../../lib/graph/projectGraphBuilder.js": t.context.projectGraphBuilderStub,
		"../../../lib/graph/helpers/ui5Framework.js": {
			enrichProjectGraph: t.context.enrichProjectGraphStub
		}
	});
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
	esmock.purge(t.context.graph);
});

test.serial("graphFromPackageDependencies", async (t) => {
	const {
		npmProviderConstructorStub,
		projectGraphBuilderStub, enrichProjectGraphStub, DummyNpmProvider
	} = t.context;
	const {graphFromPackageDependencies} = t.context.graph;

	const res = await graphFromPackageDependencies({
		cwd: "cwd",
		rootConfiguration: "rootConfiguration",
		rootConfigPath: "rootConfigPath",
		versionOverride: "versionOverride"
	});

	t.is(res, "graph");

	t.is(npmProviderConstructorStub.callCount, 1, "NPM provider constructor got called once");
	t.deepEqual(npmProviderConstructorStub.getCall(0).args[0], {
		cwd: path.join(__dirname, "..", "..", "..", "cwd"),
		rootConfiguration: "rootConfiguration",
		rootConfigPath: "rootConfigPath"
	}, "Created NodePackageDependencies provider instance with correct parameters");

	t.is(projectGraphBuilderStub.callCount, 1, "projectGraphBuilder got called once");
	t.true(projectGraphBuilderStub.getCall(0).args[0] instanceof DummyNpmProvider,
		"projectGraphBuilder got called with correct provider instance");
	t.is(projectGraphBuilderStub.getCall(0).args[1], undefined,
		"projectGraphBuilder got called with an empty workspace");

	t.is(enrichProjectGraphStub.callCount, 1, "enrichProjectGraph got called once");
	t.is(enrichProjectGraphStub.getCall(0).args[0], "graph",
		"enrichProjectGraph got called with graph");
	t.deepEqual(enrichProjectGraphStub.getCall(0).args[1], {
		versionOverride: "versionOverride",
		workspace: undefined
	}, "enrichProjectGraph got called with correct options");
});

test.serial("graphFromPackageDependencies with workspace object", async (t) => {
	const {
		workspaceConstructorStub, npmProviderConstructorStub,
		projectGraphBuilderStub, enrichProjectGraphStub, DummyNpmProvider
	} = t.context;
	const {graphFromPackageDependencies} = t.context.graph;

	const res = await graphFromPackageDependencies({
		cwd: "cwd",
		rootConfiguration: "rootConfiguration",
		rootConfigPath: "rootConfigPath",
		versionOverride: "versionOverride",
		workspaceConfiguration: {
			metadata: {
				name: "default"
			}
		}
	});

	t.is(res, "graph");

	t.is(workspaceConstructorStub.callCount, 1, "Workspace constructor got called once");
	t.deepEqual(workspaceConstructorStub.getCall(0).args[0], {
		cwd: path.join(__dirname, "..", "..", "..", "cwd"),
		workspaceConfiguration: {
			metadata: {
				name: "default"
			}
		}
	}, "Created Workspace instance with correct parameters");

	t.is(npmProviderConstructorStub.callCount, 1, "NPM provider constructor got called once");
	t.deepEqual(npmProviderConstructorStub.getCall(0).args[0], {
		cwd: path.join(__dirname, "..", "..", "..", "cwd"),
		rootConfiguration: "rootConfiguration",
		rootConfigPath: "rootConfigPath",
	}, "Created NodePackageDependencies provider instance with correct parameters");

	t.is(projectGraphBuilderStub.callCount, 1, "projectGraphBuilder got called once");
	t.true(projectGraphBuilderStub.getCall(0).args[0] instanceof DummyNpmProvider,
		"projectGraphBuilder got called with correct provider instance");
	t.true(projectGraphBuilderStub.getCall(0).args[1] instanceof t.context.DummyWorkspace,
		"projectGraphBuilder got called with correct workspace instance");

	t.is(enrichProjectGraphStub.callCount, 1, "enrichProjectGraph got called once");
	t.is(enrichProjectGraphStub.getCall(0).args[0], "graph",
		"enrichProjectGraph got called with graph");
	t.deepEqual(enrichProjectGraphStub.getCall(0).args[1], {
		versionOverride: "versionOverride",
		workspace: new t.context.DummyWorkspace()
	}, "enrichProjectGraph got called with correct options");
});

test.serial("graphFromPackageDependencies with workspace file", async (t) => {
	const {
		workspaceConstructorStub, npmProviderConstructorStub,
		projectGraphBuilderStub, enrichProjectGraphStub, DummyNpmProvider
	} = t.context;
	const {graphFromPackageDependencies} = t.context.graph;

	const readWorkspaceConfigFileStub =
		t.context.sinon.stub(graphFromPackageDependencies._utils, "readWorkspaceConfigFile")
			.resolves([{
				metadata: {
					name: "default"
				}
			}, {
				metadata: {
					name: "non-default"
				}
			}]);

	const res = await graphFromPackageDependencies({
		cwd: "cwd",
		rootConfiguration: "rootConfiguration",
		rootConfigPath: "rootConfigPath",
		versionOverride: "versionOverride"
	});

	t.is(res, "graph");

	t.is(readWorkspaceConfigFileStub.callCount, 1, "readWorkspaceConfigFile got called once");
	t.is(readWorkspaceConfigFileStub.getCall(0).args[0], path.join(__dirname, "..", "..", "..", "cwd"),
		"readWorkspaceConfigFile got called with correct first argument");
	t.is(readWorkspaceConfigFileStub.getCall(0).args[1], "ui5-workspace.yaml",
		"readWorkspaceConfigFile got called with correct second argument");
	t.is(readWorkspaceConfigFileStub.getCall(0).args[2], false,
		"readWorkspaceConfigFile got called with correct third argument");

	t.is(workspaceConstructorStub.callCount, 1, "Workspace constructor got called once");
	t.deepEqual(workspaceConstructorStub.getCall(0).args[0], {
		cwd: path.join(__dirname, "..", "..", "..", "cwd"),
		workspaceConfiguration: {
			metadata: {
				name: "default"
			}
		}
	}, "Created Workspace instance with correct parameters");

	t.is(npmProviderConstructorStub.callCount, 1, "NPM provider constructor got called once");
	t.deepEqual(npmProviderConstructorStub.getCall(0).args[0], {
		cwd: path.join(__dirname, "..", "..", "..", "cwd"),
		rootConfiguration: "rootConfiguration",
		rootConfigPath: "rootConfigPath"
	}, "Created NodePackageDependencies provider instance with correct parameters");

	t.is(projectGraphBuilderStub.callCount, 1, "projectGraphBuilder got called once");
	t.true(projectGraphBuilderStub.getCall(0).args[0] instanceof DummyNpmProvider,
		"projectGraphBuilder got called with correct provider instance");
	t.true(projectGraphBuilderStub.getCall(0).args[1] instanceof t.context.DummyWorkspace,
		"projectGraphBuilder got called with correct workspace instance");

	t.is(enrichProjectGraphStub.callCount, 1, "enrichProjectGraph got called once");
	t.is(enrichProjectGraphStub.getCall(0).args[0], "graph",
		"enrichProjectGraph got called with graph");
	t.deepEqual(enrichProjectGraphStub.getCall(0).args[1], {
		versionOverride: "versionOverride",
		workspace: new t.context.DummyWorkspace()
	}, "enrichProjectGraph got called with correct options");
});

test.serial("graphFromPackageDependencies: Do not resolve framework dependencies", async (t) => {
	const {enrichProjectGraphStub} = t.context;
	const {graphFromPackageDependencies} = t.context.graph;

	const res = await graphFromPackageDependencies({
		cwd: "cwd",
		rootConfiguration: "rootConfiguration",
		rootConfigPath: "rootConfigPath",
		versionOverride: "versionOverride",
		resolveFrameworkDependencies: false
	});

	t.is(res, "graph");
	t.is(enrichProjectGraphStub.callCount, 0, "enrichProjectGraph did not get called");
});

test.serial("graphFromStaticFile", async (t) => {
	const {
		dependencyTreeProviderStub,
		projectGraphBuilderStub, enrichProjectGraphStub, DummyDependencyTreeProvider
	} = t.context;
	const {graphFromStaticFile} = t.context.graph;

	const readDependencyConfigFileStub = t.context.sinon.stub(graphFromStaticFile._utils, "readDependencyConfigFile")
		.resolves("dependencyTree");

	const res = await graphFromStaticFile({
		cwd: "cwd",
		filePath: "file/path",
		rootConfiguration: "rootConfiguration",
		rootConfigPath: "rootConfigPath",
		versionOverride: "versionOverride"
	});

	t.is(res, "graph");

	t.is(readDependencyConfigFileStub.callCount, 1, "_readDependencyConfigFile got called once");
	t.is(readDependencyConfigFileStub.getCall(0).args[0], path.join(__dirname, "..", "..", "..", "cwd"),
		"_readDependencyConfigFile got called with correct directory");
	t.is(readDependencyConfigFileStub.getCall(0).args[1], "file/path",
		"_readDependencyConfigFile got called with correct file path");

	t.is(dependencyTreeProviderStub.callCount, 1, "DependencyTree provider constructor got called once");
	t.deepEqual(dependencyTreeProviderStub.getCall(0).args[0], {
		dependencyTree: "dependencyTree",
		rootConfiguration: "rootConfiguration",
		rootConfigPath: "rootConfigPath",
	}, "Created NodePackageDependencies provider instance with correct parameters");

	t.is(projectGraphBuilderStub.callCount, 1, "projectGraphBuilder got called once");
	t.true(projectGraphBuilderStub.getCall(0).args[0] instanceof DummyDependencyTreeProvider,
		"projectGraphBuilder got called with correct provider instance");

	t.is(enrichProjectGraphStub.callCount, 1, "enrichProjectGraph got called once");
	t.is(enrichProjectGraphStub.getCall(0).args[0], "graph",
		"enrichProjectGraph got called with graph");
	t.deepEqual(enrichProjectGraphStub.getCall(0).args[1], {
		versionOverride: "versionOverride"
	}, "enrichProjectGraph got called with correct options");
});

test.serial("graphFromStaticFile: Do not resolve framework dependencies", async (t) => {
	const {enrichProjectGraphStub} = t.context;
	const {graphFromStaticFile} = t.context.graph;

	t.context.sinon.stub(graphFromStaticFile._utils, "readDependencyConfigFile")
		.resolves("dependencyTree");

	const res = await graphFromStaticFile({
		cwd: "cwd",
		filePath: "filePath",
		rootConfiguration: "rootConfiguration",
		rootConfigPath: "rootConfigPath",
		versionOverride: "versionOverride",
		resolveFrameworkDependencies: false
	});

	t.is(res, "graph");
	t.is(enrichProjectGraphStub.callCount, 0, "enrichProjectGraph did not get called");
});

test.serial("usingObject", async (t) => {
	const {
		dependencyTreeProviderStub,
		projectGraphBuilderStub, enrichProjectGraphStub, DummyDependencyTreeProvider
	} = t.context;
	const {graphFromObject} = t.context.graph;

	const res = await graphFromObject({
		dependencyTree: "dependencyTree",
		rootConfiguration: "rootConfiguration",
		rootConfigPath: "rootConfigPath",
		versionOverride: "versionOverride"
	});

	t.is(res, "graph");

	t.is(dependencyTreeProviderStub.callCount, 1, "DependencyTree provider constructor got called once");
	t.deepEqual(dependencyTreeProviderStub.getCall(0).args[0], {
		dependencyTree: "dependencyTree",
		rootConfiguration: "rootConfiguration",
		rootConfigPath: "rootConfigPath",
	}, "Created NodePackageDependencies provider instance with correct parameters");

	t.is(projectGraphBuilderStub.callCount, 1, "projectGraphBuilder got called once");
	t.true(projectGraphBuilderStub.getCall(0).args[0] instanceof DummyDependencyTreeProvider,
		"projectGraphBuilder got called with correct provider instance");

	t.is(enrichProjectGraphStub.callCount, 1, "enrichProjectGraph got called once");
	t.is(enrichProjectGraphStub.getCall(0).args[0], "graph",
		"enrichProjectGraph got called with graph");
	t.deepEqual(enrichProjectGraphStub.getCall(0).args[1], {
		versionOverride: "versionOverride"
	}, "enrichProjectGraph got called with correct options");
});

test.serial("usingObject: Do not resolve framework dependencies", async (t) => {
	const {enrichProjectGraphStub} = t.context;
	const {graphFromObject} = t.context.graph;
	const res = await graphFromObject({
		cwd: "cwd",
		filePath: "filePath",
		rootConfiguration: "rootConfiguration",
		rootConfigPath: "rootConfigPath",
		versionOverride: "versionOverride",
		resolveFrameworkDependencies: false
	});

	t.is(res, "graph");
	t.is(enrichProjectGraphStub.callCount, 0, "enrichProjectGraph did not get called");
});

test.serial("utils: readDependencyConfigFile", async (t) => {
	const {graphFromStaticFile} = t.context.graph;
	const res = await graphFromStaticFile._utils.readDependencyConfigFile(
		path.join(fixturesPath, "application.h"), "projectDependencies.yaml");

	t.deepEqual(res, {
		id: "static-application.a",
		path: path.join(fixturesPath, "application.a"),
		version: "0.0.1",
		dependencies: [{
			id: "static-library.e",
			path: path.join(fixturesPath, "library.e"),
			version: "0.0.1",
		}],
	}, "Returned correct file content");
});

test.serial("utils: readWorkspaceConfigFile", async (t) => {
	const {graphFromPackageDependencies} = t.context.graph;
	const res = await graphFromPackageDependencies._utils.readWorkspaceConfigFile(
		path.join(fixturesPath, "library.e"), "ui5-workspace.yaml");

	t.deepEqual(res, [{
		"specVersion": "workspace/1.0",
		"metadata": {
			"name": "config-a"
		},
		"dependencyManagement": {
			"resolutions": [{
				"path": "../library.d"
			}]
		}
	}, {
		"specVersion": "workspace/1.0",
		"metadata": {
			"name": "config-b"
		},
		"dependencyManagement": {
			"resolutions": [{
				"path": "../library.x"
			}]
		}
	}], "Returned correct file content");
});

test.serial("utils: readWorkspaceConfigFile - throwIfMissing: false", async (t) => {
	const {graphFromPackageDependencies} = t.context.graph;
	const res = await graphFromPackageDependencies._utils.readWorkspaceConfigFile(
		path.join(fixturesPath, "library.d"), "ui5-workspace.yaml");

	t.deepEqual(res, [], "Returned empty array");
});

test.serial("utils: readWorkspaceConfigFile - throwIfMissing: true", async (t) => {
	const {graphFromPackageDependencies} = t.context.graph;
	const err = await t.throwsAsync(graphFromPackageDependencies._utils.readWorkspaceConfigFile(
		path.join(fixturesPath, "library.d"), "ui5-workspace.yaml", true));
	const filePath = path.join(fixturesPath, "library.d", "ui5-workspace.yaml");
	t.is(err.message,
		`Failed to load workspace configuration from path ${filePath}: ` +
		`ENOENT: no such file or directory, open '${filePath}'`);
});
