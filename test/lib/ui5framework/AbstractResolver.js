const test = require("ava");
const sinon = require("sinon");
const path = require("path");

const AbstractResolver = require("../../../lib/ui5Framework/AbstractResolver");

test("AbstractResolver: constructor", (t) => {
	const resolver = new AbstractResolver({
		cwd: "/test-project/",
		version: "1.75.0"
	});
	t.true(resolver instanceof AbstractResolver, "Constructor returns instance of class");
});

test("AbstractResolver: constructor requires 'version'", (t) => {
	t.throws(() => {
		new AbstractResolver({});
	}, `AbstractResolver: Missing parameter "version"`);
});

test("AbstractResolver: Set 'cwd'", (t) => {
	const resolver = new AbstractResolver({
		version: "1.75.0",
		cwd: "/my-cwd/"
	});
	t.is(resolver._cwd, "/my-cwd/", "Should be given 'cwd'");
});

test("AbstractResolver: Defaults 'cwd' to process.cwd()", (t) => {
	const resolver = new AbstractResolver({
		version: "1.75.0",
		ui5HomeDir: "/ui5home/"
	});
	t.is(resolver._cwd, process.cwd(), "Should default to process.cwd()");
});

test("AbstractResolver: Set 'ui5HomeDir'", (t) => {
	const resolver = new AbstractResolver({
		version: "1.75.0",
		ui5HomeDir: "/my-ui5HomeDir/"
	});
	t.is(resolver._ui5HomeDir, "/my-ui5HomeDir/", "Should be given 'ui5HomeDir'");
});

test("AbstractResolver: Defaults 'ui5HomeDir' to ~/.ui5", (t) => {
	const resolver = new AbstractResolver({
		version: "1.75.0",
		cwd: "/test-project/"
	});
	t.is(resolver._ui5HomeDir, path.join(require("os").homedir(), ".ui5"), "Should default to ~/.ui5");
});

test("AbstractResolver: handleLibrary should throw an Error when not implemented", async (t) => {
	await t.throwsAsync(async () => {
		const resolver = new AbstractResolver({
			cwd: "/test-project/",
			version: "1.75.0"
		});
		await resolver.handleLibrary();
	}, `AbstractResolver: handleLibrary must be implemented!`);
});

test("AbstractResolver: install", async (t) => {
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
			metadata: resolver.metadata.libraries["sap.ui.lib1"],
			install: Promise.resolve({pkgPath: "/foo/sap.ui.lib1"})
		})
		.withArgs("sap.ui.lib2").resolves({
			metadata: resolver.metadata.libraries["sap.ui.lib2"],
			install: Promise.resolve({pkgPath: "/foo/sap.ui.lib2"})
		})
		.withArgs("sap.ui.lib3").resolves({
			metadata: resolver.metadata.libraries["sap.ui.lib3"],
			install: Promise.resolve({pkgPath: "/foo/sap.ui.lib3"})
		})
		.withArgs("sap.ui.lib4").resolves({
			metadata: resolver.metadata.libraries["sap.ui.lib4"],
			install: Promise.resolve({pkgPath: "/foo/sap.ui.lib4"})
		});

	await resolver.install(["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib4"]);

	t.is(handleLibraryStub.callCount, 4, "Each library should be handled once");
});
