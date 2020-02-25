const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");
const path = require("path");
const os = require("os");
const libnpmconfig = require("libnpmconfig");

const Sapui5Resolver = require("../../../lib/ui5Framework/Sapui5Resolver");

// Use path within project as mocking base directory to reduce chance of side effects
// in case mocks/stubs do not work and real fs is used
const fakeBaseDir = path.join(__dirname, "fake-tmp");
const ui5FrameworkBaseDir = path.join(fakeBaseDir, "homedir", ".ui5", "framework");

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

test.serial("Sapui5Resolver: loadDistMetadata loads metadata once from @sapui5/distribution-metadata package", async (t) => {
	const resolver = new Sapui5Resolver({
		cwd: "/test-project/",
		version: "1.75.0"
	});

	const getTargetDirForPackage = sinon.stub(resolver._installer, "_getTargetDirForPackage");
	getTargetDirForPackage.withArgs({
		pkgName: "@sapui5/distribution-metadata",
		version: "1.75.0"
	}).returns("/path/to/distribution-metadata/1.75.0/");
	const installPackage = sinon.stub(resolver._installer, "installPackage");
	installPackage.withArgs({
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

	t.deepEqual(resolver.metadata, undefined,
		"Metadata should not be set");
	await resolver.loadDistMetadata();
	t.is(installPackage.callCount, 1, "Distribution metadata package should be installed once");
	t.deepEqual(resolver.metadata, expectedMetadata,
		"Metadata should be filled with expected metadata after calling loadDistMetadata");

	// Calling loadDistMetadata again should not load package again
	await resolver.loadDistMetadata();

	t.is(installPackage.callCount, 1, "Distribution metadata package should still be installed once");
	t.deepEqual(resolver.metadata, expectedMetadata,
		"Metadata should still be filled with expected metadata after calling loadDistMetadata again");

	mock.stop("/path/to/distribution-metadata/1.75.0/metadata.json");
});

test.serial("Sapui5Resolver: install", async (t) => {
	const resolver = new Sapui5Resolver({
		cwd: "/test-project/",
		version: "1.75.0"
	});

	const loadDistMetadataStub = sinon.stub(resolver, "loadDistMetadata");
	loadDistMetadataStub.callsFake(async () => {
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

	const installPackage = sinon.stub(resolver._installer, "installPackage");
	installPackage
		.callsFake(async ({pkgName, version}) => {
			throw new Error(`Unknown install call: ${pkgName}@${version}`);
		})
		.withArgs({pkgName: "@openui5/sap.ui.lib1", version: "1.75.0"}).resolves()
		.withArgs({pkgName: "@openui5/sap.ui.lib2", version: "1.75.0"}).resolves()
		.withArgs({pkgName: "@openui5/sap.ui.lib3", version: "1.75.0"}).resolves()
		.withArgs({pkgName: "@openui5/sap.ui.lib4", version: "1.75.0"}).resolves();

	await resolver.install(["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib4"]);

	t.is(loadDistMetadataStub.callCount, 1, "loadDistMetadata should be called once");
	t.is(installPackage.callCount, 4, "Installation should only be done once");
});
