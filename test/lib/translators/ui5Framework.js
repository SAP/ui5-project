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

test.serial("generateDependencyTree (SAPUI5)", async (t) => {
	const tree = {
		id: "test-id",
		version: "1.2.3",
		path: "/test-project/",
		metadata: {
			name: "test-name"
		},
		framework: {
			name: "SAPUI5",
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
		version: "1.75.0",
		name: "OpenUI5"
	});
	t.true(frameworkInstaller instanceof FrameworkInstaller, "Constructor returns instance of class");
});

test("FrameworkInstaller: Constructor requires 'dirPath'", (t) => {
	t.throws(() => {
		new FrameworkInstaller({
			version: "1.75.0",
			name: "OpenUI5"
		});
	}, `FrameworkInstaller: Missing parameter "dirPath"`);
});

test("FrameworkInstaller: Constructor requires 'name'", (t) => {
	t.throws(() => {
		new FrameworkInstaller({
			dirPath: "/test-project/",
			version: "1.75.0"
		});
	}, `FrameworkInstaller: Missing parameter "name"`);
});

test("FrameworkInstaller: Constructor requires valid 'name'", (t) => {
	t.throws(() => {
		new FrameworkInstaller({
			dirPath: "/test-project/",
			version: "1.75.0",
			name: "Foo"
		});
	}, `FrameworkInstaller: Invalid value "Foo" for parameter "name". Must be "OpenUI5" or "SAPUI5"`);
});

test("FrameworkInstaller: Constructor requires 'version'", (t) => {
	t.throws(() => {
		new FrameworkInstaller({
			dirPath: "/test-project/",
			name: "OpenUI5"
		});
	}, `FrameworkInstaller: Missing parameter "version"`);
});

test("FrameworkInstaller#install: SAPUI5", async (t) => {
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
		version: "1.75.0",
		name: "SAPUI5"
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
		version: "1.75.0",
		name: "SAPUI5"
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

test("OpenUI5 installAllDependencies", async (t) => {
	const framework = new FrameworkInstaller({
		dirPath: "/test-project/",
		version: "1.75.0",
		name: "OpenUI5"
	});

	framework._baseDir = "/.ui5/framework/packages/";

	const _requestPackageManifest = sinon.stub(framework, "_requestPackageManifest");
	_requestPackageManifest
		.callsFake(async (pkgName) => {
			throw new Error("Unknown package: " + pkgName);
		})
		.withArgs("@openui5/sap.ui.lib1", "1.75.0")
		.resolves({
			name: "@openui5/sap.ui.lib1",
			version: "1.75.0",
			dependencies: {}
		})
		.withArgs("@openui5/sap.ui.lib2", "1.75.0")
		.resolves({
			name: "@openui5/sap.ui.lib2",
			version: "1.75.0",
			dependencies: {
				"@openui5/sap.ui.lib3": "1.75.0"
			}
		})
		.withArgs("@openui5/sap.ui.lib3", "1.75.0")
		.resolves({
			name: "@openui5/sap.ui.lib3",
			version: "1.75.0",
			devDependencies: {
				"@openui5/sap.ui.lib4": "1.75.0"
			}
		})
		.withArgs("@openui5/sap.ui.lib4", "1.75.0")
		.resolves({
			name: "@openui5/sap.ui.lib4",
			version: "1.75.0"
		});

	const _installPackage = sinon.stub(framework, "_installPackage");
	_installPackage
		.callsFake(async ({pkgName}) => {
			throw new Error("Unknown install call: " + pkgName);
		})
		.withArgs({pkgName: "@openui5/sap.ui.lib1", version: "1.75.0"}).resolves()
		.withArgs({pkgName: "@openui5/sap.ui.lib2", version: "1.75.0"}).resolves()
		.withArgs({pkgName: "@openui5/sap.ui.lib3", version: "1.75.0"}).resolves()
		.withArgs({pkgName: "@openui5/sap.ui.lib4", version: "1.75.0"}).resolves();

	const tree = await framework._installAllOpenUI5Dependencies(["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib4"]);

	t.deepEqual(tree, [
		{
			id: "@openui5/sap.ui.lib1",
			version: "1.75.0",
			path: "/.ui5/framework/packages/@openui5/sap.ui.lib1/1.75.0",
			dependencies: [],
		},
		{
			id: "@openui5/sap.ui.lib2",
			version: "1.75.0",
			path: "/.ui5/framework/packages/@openui5/sap.ui.lib2/1.75.0",
			dependencies: [
				{
					id: "@openui5/sap.ui.lib3",
					version: "1.75.0",
					path: "/.ui5/framework/packages/@openui5/sap.ui.lib3/1.75.0",
					dependencies: [
						{
							id: "@openui5/sap.ui.lib4",
							version: "1.75.0",
							path: "/.ui5/framework/packages/@openui5/sap.ui.lib4/1.75.0",
							dependencies: [],
						}
					],
				}
			]
		},
		{
			id: "@openui5/sap.ui.lib4",
			version: "1.75.0",
			path: "/.ui5/framework/packages/@openui5/sap.ui.lib4/1.75.0",
			dependencies: []
		}
	]);

	t.is(_requestPackageManifest.callCount, 4, "Manifests should only be requested once");
	t.is(_installPackage.callCount, 4, "Installation should only be done once");
});

test.todo("Ensure no unhandled promise rejection happens during install");
