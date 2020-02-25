const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");
const path = require("path");
const os = require("os");
const libnpmconfig = require("libnpmconfig");

const AbstractResolver = require("../../../lib/ui5Framework/AbstractResolver");

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

test.serial("AbstractResolver: constructor", (t) => {
	const resolver = new AbstractResolver({
		cwd: "/test-project/",
		version: "1.75.0"
	});
	t.true(resolver instanceof AbstractResolver, "Constructor returns instance of class");
});

test.serial("AbstractResolver: constructor requires 'cwd'", (t) => {
	t.throws(() => {
		new AbstractResolver({
			version: "1.75.0"
		});
	}, `AbstractResolver: Missing parameter "cwd"`);
});

test.serial("AbstractResolver: constructor requires 'version'", (t) => {
	t.throws(() => {
		new AbstractResolver({
			cwd: "/test-project/"
		});
	}, `AbstractResolver: Missing parameter "version"`);
});

test.serial("AbstractResolver: install", async (t) => {
	const resolver = new AbstractResolver({
		cwd: "/test-project/",
		version: "1.75.0"
	});

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

	const handleLibraryStub = sinon.stub(resolver, "handleLibrary");
	handleLibraryStub
		.callsFake(async (libraryName) => {
			throw new Error(`Unknown handleLibrary call: ${libraryName}`);
		})
		.withArgs("sap.ui.lib1").resolves({
			libraryMetadata: resolver.metadata.libraries["sap.ui.lib1"],
			install: Promise.resolve({pkgPath: "/foo/sap.ui.lib1"})
		})
		.withArgs("sap.ui.lib2").resolves({
			libraryMetadata: resolver.metadata.libraries["sap.ui.lib2"],
			install: Promise.resolve({pkgPath: "/foo/sap.ui.lib2"})
		})
		.withArgs("sap.ui.lib3").resolves({
			libraryMetadata: resolver.metadata.libraries["sap.ui.lib3"],
			install: Promise.resolve({pkgPath: "/foo/sap.ui.lib3"})
		})
		.withArgs("sap.ui.lib4").resolves({
			libraryMetadata: resolver.metadata.libraries["sap.ui.lib4"],
			install: Promise.resolve({pkgPath: "/foo/sap.ui.lib4"})
		});

	await resolver.install(["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib4"]);

	t.is(handleLibraryStub.callCount, 4, "Each library should be handled once");
});
