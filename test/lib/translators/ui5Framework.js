const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");

const ui5Framework = require("../../../lib/translators/ui5Framework");
const FrameworkInstaller = ui5Framework.FrameworkInstaller;

test.afterEach.always((t) => {
	sinon.restore();
	mock.stopAll();
});

test("generateDependencyTree should ignore root project without framework configuration", async (t) => {
	const tree = {
		id: "test-id",
		version: "1.2.3",
		path: "/test-project/",
		metadata: {
			name: "test-name"
		},
		dependencies: []
	};
	const ui5FrameworkTree = await ui5Framework.generateDependencyTree(tree);

	t.is(ui5FrameworkTree, null, "No framework tree should be returned");
});

test.serial("generateDependencyTree", async (t) => {
	const tree = {
		id: "test-id",
		version: "1.2.3",
		path: "/test-project/",
		metadata: {
			name: "test-name"
		},
		framework: {
			version: "1.75.0",
			libraries: [
				{
					name: "lib1"
				}
			]
		},
		dependencies: []
	};

	sinon.stub(FrameworkInstaller, "_collectReferencedUi5Libraries")
		.withArgs(tree, [], true)
		.returns([
			"lib1"
		]);

	sinon.stub(FrameworkInstaller.prototype, "install")
		.withArgs({libraryNames: ["lib1"]})
		.resolves();

	sinon.stub(FrameworkInstaller.prototype, "generateDependencyTree")
		.withArgs({libraryNames: ["lib1"]})
		.resolves([
			{
				id: "@sapui5/lib1",
				version: "1.75.0",
				path: "/some/path",
				dependencies: []
			}
		]);

	const ui5FrameworkTree = await ui5Framework.generateDependencyTree(tree);

	t.deepEqual(ui5FrameworkTree, {
		id: "test-id",
		version: "1.2.3",
		path: "/test-project/",
		dependencies: [
			{
				id: "@sapui5/lib1",
				version: "1.75.0",
				path: "/some/path",
				dependencies: []
			}
		]
	});
});

test("FrameworkInstaller._isUi5FrameworkProject", (t) => {
	t.true(FrameworkInstaller._isUi5FrameworkProject({id: "@sapui5/foo"}), "@sapui5/foo");
	t.true(FrameworkInstaller._isUi5FrameworkProject({id: "@openui5/foo"}), "@openui5/foo");
	t.false(FrameworkInstaller._isUi5FrameworkProject({id: "sapui5"}), "sapui5");
	t.false(FrameworkInstaller._isUi5FrameworkProject({id: "openui5"}), "openui5");
});

test("FrameworkInstaller._collectReferencedUi5Libraries: Project without dependencies", (t) => {
	const tree = {
		id: "test",
		metadata: {
			name: "test"
		},
		framework: {
			libraries: []
		},
		dependencies: []
	};
	const ui5Dependencies = FrameworkInstaller._collectReferencedUi5Libraries(tree, [], true);
	t.deepEqual(ui5Dependencies, []);
});

test("FrameworkInstaller._collectReferencedUi5Libraries: Project with libraries and dependency with libraries", (t) => {
	const tree = {
		id: "test1",
		metadata: {
			name: "test1"
		},
		framework: {
			libraries: [
				{
					name: "lib1"
				},
				{
					name: "lib2",
					optional: true
				}
			]
		},
		dependencies: [
			{
				id: "test2",
				metadata: {
					name: "test2"
				},
				framework: {
					libraries: [
						{
							name: "lib3"
						},
						{
							name: "lib4",
							optional: true
						}
					]
				},
				dependencies: [
					{
						id: "test3",
						metadata: {
							name: "test3"
						},
						framework: {
							libraries: [
								{
									name: "lib5"
								}
							]
						},
						dependencies: []
					}
				]
			}
		]
	};
	const ui5Dependencies = FrameworkInstaller._collectReferencedUi5Libraries(tree, [], true);
	t.deepEqual(ui5Dependencies, ["lib1", "lib2", "lib3", "lib5"]);
});

test("FrameworkInstaller: Constructor", (t) => {
	const frameworkInstaller = new FrameworkInstaller({
		dirPath: "/test-project/",
		distVersion: "1.75.0"
	});
	t.true(frameworkInstaller instanceof FrameworkInstaller, "Constructor returns instance of class");
});

test("FrameworkInstaller: Constructor requires 'dirPath'", (t) => {
	t.throws(() => {
		new FrameworkInstaller({
			distVersion: "1.75.0"
		});
	}, `FrameworkInstaller: missing parameter "dirPath"`);
});

test("FrameworkInstaller: Constructor requires 'distVersion'", (t) => {
	t.throws(() => {
		new FrameworkInstaller({
			dirPath: "/test-project/"
		});
	}, `FrameworkInstaller: missing parameter "distVersion"`);
});


test("FrameworkInstaller#install", async (t) => {
	// Mock data
	const distMetadata = {
		libraries: {
			"sap.ui.foo": {
				"npmPackageName": "@openui5/sap.ui.foo",
				"version": "1.75.0",
				"dependencies": [],
				"optionalDependencies": []
			}
		}
	};
	const packagesToInstall = {
		"sap.ui.foo": {
			"version": "1.75.0"
		}
	};

	const framework = new FrameworkInstaller({
		dirPath: "/test-project/",
		distVersion: "1.75.0"
	});

	const frameworkMock = sinon.mock(framework);
	frameworkMock.expects("_getDistMetadata").once().resolves(distMetadata);
	frameworkMock.expects("_collectTransitiveDependencies").once().withExactArgs({
		libraryNames: ["sap.ui.foo"],
		metadata: distMetadata
	}).returns(packagesToInstall);
	frameworkMock.expects("_installPackages").once().withExactArgs({
		packages: packagesToInstall
	}).resolves();

	await framework.install({
		libraryNames: ["sap.ui.foo"]
	});

	t.pass("Install should not fail");
	frameworkMock.verify();
});

test("FrameworkInstaller#_getDistMetadata returns metadata from @sapui5/distribution-metadata package", async (t) => {
	const framework = new FrameworkInstaller({
		dirPath: "/test-project/",
		distVersion: "1.75.0"
	});

	sinon.stub(framework, "_getTargetDirForPackage").withArgs({
		pkgName: "@sapui5/distribution-metadata",
		version: "1.75.0"
	}).returns("/path/to/distribution-metadata/1.75.0/");
	sinon.stub(framework, "_installPackage").withArgs({
		pkgName: "@sapui5/distribution-metadata",
		version: "1.75.0",
		targetDir: "/path/to/distribution-metadata/1.75.0/"
	}).resolves();

	const expectedMetadata = {
		libraries: {
			"sap.ui.foo": {
				"npmPackageName": "@openui5/sap.ui.foo",
				"version": "1.75.0",
				"dependencies": [],
				"optionalDependencies": []
			}
		}
	};
	mock("/path/to/distribution-metadata/1.75.0/metadata.json", expectedMetadata);

	const metadata = await framework._getDistMetadata();
	t.deepEqual(metadata, expectedMetadata, "Dist Metadata should be returned");

	mock.stop("/path/to/distribution-metadata/1.75.0/metadata.json");
});

test.todo("FrameworkInstaller._getDistMetadata only installs and reads metadata once");
