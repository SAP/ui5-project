const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");
const path = require("path");
const os = require("os");

const libnpmconfig = require("libnpmconfig");
const ui5Framework = require("../../../lib/translators/ui5Framework");
const FrameworkResolverSAPUI5 = ui5Framework.FrameworkResolverSAPUI5;

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

test.serial("FrameworkResolverSAPUI5#prepare loads metadata once from @sapui5/distribution-metadata package", async (t) => {
	const resolver = new FrameworkResolverSAPUI5({
		cwd: "/test-project/",
		version: "1.75.0"
	});

	const resolverMock = sinon.mock(resolver);

	resolverMock.expects("_getTargetDirForPackage").once().withArgs({
		pkgName: "@sapui5/distribution-metadata",
		version: "1.75.0"
	}).returns("/path/to/distribution-metadata/1.75.0/");
	resolverMock.expects("_installPackage").once().withArgs({
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

	t.deepEqual(resolver.metadata, {libraries: {}},
		"Metadata should be filled with an empty libraries object");
	await resolver.prepare();
	t.deepEqual(resolver.metadata, expectedMetadata,
		"Metadata should be filled with expected metadata after calling prepare");

	// Calling prepare again should not load package again (verified via mock)
	await resolver.prepare();
	resolverMock.verify();
	t.deepEqual(resolver.metadata, expectedMetadata,
		"Metadata should still be filled with expected metadata after calling prepare again");

	mock.stop("/path/to/distribution-metadata/1.75.0/metadata.json");
});
test.serial("FrameworkResolverSAPUI5#install", async (t) => {
	const resolver = new FrameworkResolverSAPUI5({
		cwd: "/test-project/",
		version: "1.75.0"
	});

	const prepareStub = sinon.stub(resolver, "prepare");
	prepareStub.callsFake(async () => {
		resolver.metadata = {
			libraries: {
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
				}
			}
		};
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

	t.is(prepareStub.callCount, 1, "prepare should be called once");
	t.is(_installPackage.callCount, 4, "Installation should only be done once");
});
