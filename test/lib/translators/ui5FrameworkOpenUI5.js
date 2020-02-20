const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");
const path = require("path");
const os = require("os");

const libnpmconfig = require("libnpmconfig");
const ui5Framework = require("../../../lib/translators/ui5Framework");
const FrameworkResolverOpenUI5 = ui5Framework.FrameworkResolverOpenUI5;

// Use path within project as mocking base directory to reduce chance of side effects
// in case mocks/stubs do not work and real fs is used
const fakeBaseDir = path.join(__dirname, "fake-tmp");
const ui5FrameworkBaseDir = path.join(fakeBaseDir, "homedir", ".ui5", "framework");
const ui5PackagesBaseDir = path.join(ui5FrameworkBaseDir, "packages");

test.beforeEach((t) => {
	sinon.stub(os, "homedir").returns(path.join(fakeBaseDir, "homedir"));
	sinon.stub(libnpmconfig, "read").returns({
		toJSON: sinon.stub().returns({
			registry: "https://registry.fake",
			cache: path.join(ui5FrameworkBaseDir, "cacache"),
			proxy: ""
		})
	});
});

test.afterEach.always((t) => {
	sinon.restore();
	mock.stopAll();
});

test.serial("FrameworkResolverOpenUI5#prepare does not load any package", async (t) => {
	const resolver = new FrameworkResolverOpenUI5({
		cwd: "/test-project/",
		version: "1.75.0"
	});

	const resolverMock = sinon.mock(resolver);
	resolverMock.expects("_installPackage").never();

	t.deepEqual(resolver.metadata, {libraries: {}},
		"Metadata should be filled with an empty libraries object");
	await resolver.prepare();
	t.deepEqual(resolver.metadata, {libraries: {}},
		"Metadata should still be filled with an empty libraries object after calling prepare");
	resolverMock.verify();
});
test.serial("FrameworkResolverOpenUI5#install", async (t) => {
	const resolver = new FrameworkResolverOpenUI5({
		cwd: "/test-project/",
		version: "1.75.0"
	});

	const getLibraryMetadataStub = sinon.stub(resolver, "_getLibraryMetadata");
	getLibraryMetadataStub
		.callsFake(async (libraryName) => {
			throw new Error("_getLibraryMetadata stub called with unknown libraryName: " + libraryName);
		})
		.withArgs("sap.ui.lib1").resolves({
			"npmPackageName": "@openui5/sap.ui.lib1",
			"version": "1.75.0",
			"dependencies": [],
			"optionalDependencies": []
		}).withArgs("sap.ui.lib2").resolves({
			"npmPackageName": "@openui5/sap.ui.lib2",
			"version": "1.75.0",
			"dependencies": [
				"sap.ui.lib3"
			],
			"optionalDependencies": []
		}).withArgs("sap.ui.lib3").resolves({
			"npmPackageName": "@openui5/sap.ui.lib3",
			"version": "1.75.0",
			"dependencies": [],
			"optionalDependencies": [
				"sap.ui.lib4"
			]
		}).withArgs("sap.ui.lib4").resolves({
			"npmPackageName": "@openui5/sap.ui.lib4",
			"version": "1.75.0",
			"dependencies": [
				"sap.ui.lib1"
			],
			"optionalDependencies": []
		});

	const _installPackage = sinon.stub(resolver, "_installPackage");
	_installPackage
		.callsFake(async ({pkgName, version}) => {
			throw new Error(`Unknown install call: ${pkgName}@${version}`);
		})
		.withArgs({pkgName: "@openui5/sap.ui.lib1", version: "1.75.0"}).resolves()
		.withArgs({pkgName: "@openui5/sap.ui.lib2", version: "1.75.0"}).resolves()
		.withArgs({pkgName: "@openui5/sap.ui.lib3", version: "1.75.0"}).resolves()
		.withArgs({pkgName: "@openui5/sap.ui.lib4", version: "1.75.0"}).resolves();

	await resolver.install(["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib4"]);

	t.is(getLibraryMetadataStub.callCount, 4, "getLibraryMetadata should be called once for each package");
	t.is(_installPackage.callCount, 4, "Installation should only be done once");
});


// TODO: move to generic resolver tests (not specific to SAPUI5/OpenUI5)
test.serial("FrameworkResolverOpenUI5#generateDependencyTree", async (t) => {
	const resolver = new FrameworkResolverOpenUI5({
		cwd: "/test-project/",
		version: "1.75.0"
	});

	resolver.libraries = {
		"sap.ui.lib1": true,
		"sap.ui.lib2": true,
		"sap.ui.lib3": true,
		"sap.ui.lib4": true,
	};
	resolver.metadata = {
		"libraries": {
			"sap.ui.lib1": {
				"npmPackageName": "@openui5/sap.ui.lib1",
				"version": "1.75.0",
				"dependencies": [],
				"optionalDependencies": []
			},
			"sap.ui.lib2": {
				"npmPackageName": "@openui5/sap.ui.lib2",
				"version": "1.75.0",
				"dependencies": [
					"sap.ui.lib3"
				],
				"optionalDependencies": []
			},
			"sap.ui.lib3": {
				"npmPackageName": "@openui5/sap.ui.lib3",
				"version": "1.75.0",
				"dependencies": [],
				"optionalDependencies": [
					"sap.ui.lib4"
				]
			},
			"sap.ui.lib4": {
				"npmPackageName": "@openui5/sap.ui.lib4",
				"version": "1.75.0",
				"dependencies": [
					"sap.ui.lib1"
				],
				"optionalDependencies": []
			},
		}
	};

	const tree = resolver.generateDependencyTree(["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib4"]);

	t.deepEqual(tree, [
		{
			id: "@openui5/sap.ui.lib1",
			version: "1.75.0",
			path: path.join(ui5PackagesBaseDir, "@openui5", "sap.ui.lib1", "1.75.0"),
			dependencies: []
		},
		{
			id: "@openui5/sap.ui.lib2",
			version: "1.75.0",
			path: path.join(ui5PackagesBaseDir, "@openui5", "sap.ui.lib2", "1.75.0"),
			dependencies: [
				{
					id: "@openui5/sap.ui.lib3",
					version: "1.75.0",
					path: path.join(ui5PackagesBaseDir, "@openui5", "sap.ui.lib3", "1.75.0"),
					dependencies: [
						{
							id: "@openui5/sap.ui.lib4",
							version: "1.75.0",
							path: path.join(ui5PackagesBaseDir, "@openui5", "sap.ui.lib4", "1.75.0"),
							dependencies: [
								{
									id: "@openui5/sap.ui.lib1",
									version: "1.75.0",
									path: path.join(ui5PackagesBaseDir, "@openui5", "sap.ui.lib1", "1.75.0"),
									dependencies: []
								}
							],
						}
					],
				}
			]
		},
		{
			id: "@openui5/sap.ui.lib4",
			version: "1.75.0",
			path: path.join(ui5PackagesBaseDir, "@openui5", "sap.ui.lib4", "1.75.0"),
			dependencies: [
				{
					id: "@openui5/sap.ui.lib1",
					version: "1.75.0",
					path: path.join(ui5PackagesBaseDir, "@openui5", "sap.ui.lib1", "1.75.0"),
					dependencies: []
				}
			]
		}
	]);
});
