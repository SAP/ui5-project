const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");
const path = require("path");
const os = require("os");

const pacote = require("pacote");
const libnpmconfig = require("libnpmconfig");
const normalizer = require("../../../lib/normalizer");
const projectPreprocessor = require("../../../lib/projectPreprocessor");
const ui5Framework = require("../../../lib/translators/ui5Framework");

// Use path within project as mocking base directory to reduce chance of side effects
// in case mocks/stubs do not work and real FS is used
const fakeBaseDir = path.join(__dirname, "fake-tmp");
const ui5FrameworkBaseDir = path.join(fakeBaseDir, "homedir", ".ui5", "framework");
const ui5PackagesBaseDir = path.join(ui5FrameworkBaseDir, "packages");

test.beforeEach((t) => {
	sinon.stub(os, "homedir").returns(path.join(fakeBaseDir, "homedir"));
});

test.afterEach.always((t) => {
	sinon.restore();
	mock.stopAll();
});

test.serial("ui5Framework translator should not be called when no framework configuration is given", async (t) => {
	const translatorTree = {
		id: "test-id",
		version: "1.2.3",
		path: path.join(fakeBaseDir, "application-project"),
		dependencies: []
	};
	const projectPreprocessorTree = Object.assign({}, translatorTree, {
		specVersion: "1.1",
		type: "application",
		metadata: {
			name: "test-project"
		}
	});

	sinon.stub(normalizer, "generateDependencyTree").resolves(translatorTree);
	sinon.stub(projectPreprocessor, "processTree").withArgs(translatorTree).resolves(projectPreprocessorTree);

	const ui5FrameworkMock = sinon.mock(ui5Framework);
	ui5FrameworkMock.expects("generateDependencyTree").never();

	const expectedTree = projectPreprocessorTree;

	const tree = await normalizer.generateProjectTree();

	t.deepEqual(tree, expectedTree, "Returned tree should be correct");
	ui5FrameworkMock.verify();
});

test.serial("ui5Framework translator should enhance tree with UI5 framework libraries", async (t) => {
	const translatorTree = {
		id: "test-id",
		version: "1.2.3",
		path: path.join(fakeBaseDir, "application-project"),
		dependencies: []
	};
	const projectPreprocessorTree = Object.assign({}, translatorTree, {
		specVersion: "1.1",
		type: "application",
		metadata: {
			name: "test-project"
		},
		framework: {
			version: "1.75.0",
			libraries: [
				{
					name: "sap.ui.foo"
				}
			]
		}
	});

	const expectedUi5FrameworkTree = Object.assign({}, translatorTree);
	expectedUi5FrameworkTree.dependencies = [
		{
			id: "@openui5/sap.ui.foo",
			version: "1.75.0",
			path: path.join(ui5PackagesBaseDir, "@openui5", "sap.ui.foo", "1.75.0"),
			dependencies: []
		}
	];

	const ui5FrameworkPreprocessorTree = Object.assign({}, projectPreprocessorTree);
	ui5FrameworkPreprocessorTree.dependencies = [
		Object.assign({}, expectedUi5FrameworkTree.dependencies[0], {
			specVersion: "1.0",
			type: "library",
			metadata: {
				name: "sap.ui.foo"
			}
		})
	];

	sinon.stub(normalizer, "generateDependencyTree").resolves(translatorTree);
	sinon.stub(projectPreprocessor, "processTree")
		.withArgs(translatorTree).resolves(projectPreprocessorTree)
		.withArgs(expectedUi5FrameworkTree).resolves(ui5FrameworkPreprocessorTree);

	sinon.stub(libnpmconfig, "read").withArgs({
		log: undefined,
		cache: path.join(ui5FrameworkBaseDir, "cacache")
	}, {
		cwd: path.join(fakeBaseDir, "application-project")
	}).returns({
		toJSON: sinon.stub().returns({
			registry: "https://registry.fake",
			cache: path.join(ui5FrameworkBaseDir, "cacache"),
			proxy: ""
		})
	});
	sinon.stub(pacote, "extract").resolves();

	mock(path.join(fakeBaseDir,
		"homedir", ".ui5", "framework", "packages",
		"@sapui5", "distribution-metadata", "1.75.0",
		"metadata.json"), {
		libraries: {
			"sap.ui.foo": {
				npmPackageName: "@openui5/sap.ui.foo",
				version: "1.75.0",
				dependencies: [],
				optionalDependencies: []
			}
		}
	});

	const expectedTree = {
		id: "test-id",
		version: "1.2.3",
		path: path.join(fakeBaseDir, "application-project"),
		specVersion: "1.1",
		type: "application",
		metadata: {
			name: "test-project"
		},
		framework: {
			version: "1.75.0",
			libraries: [
				{
					name: "sap.ui.foo"
				}
			]
		},
		dependencies: [
			{
				id: "@openui5/sap.ui.foo",
				version: "1.75.0",
				path: path.join(ui5PackagesBaseDir, "@openui5", "sap.ui.foo", "1.75.0"),
				specVersion: "1.0",
				type: "library",
				metadata: {
					name: "sap.ui.foo"
				},
				dependencies: []
			}
		]
	};

	const tree = await normalizer.generateProjectTree();

	t.deepEqual(tree, expectedTree, "Returned tree should be correct");
});

test.todo("Should not download dist-metadata package when no libraries are defined");
