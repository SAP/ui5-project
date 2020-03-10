const test = require("ava");
const sinon = require("sinon");
const path = require("path");

const AbstractResolver = require("../../../lib/ui5Framework/AbstractResolver");

class MyResolver extends AbstractResolver {}

test("AbstractResolver: abstract constructor should throw", async (t) => {
	await t.throwsAsync(async () => {
		new AbstractResolver({
			cwd: "/test-project/",
			version: "1.75.0"
		});
	}, `Class 'AbstractResolver' is abstract`);
});

test("AbstractResolver: constructor", (t) => {
	const resolver = new MyResolver({
		cwd: "/test-project/",
		version: "1.75.0"
	});
	t.true(resolver instanceof MyResolver, "Constructor returns instance of sub-class");
	t.true(resolver instanceof AbstractResolver, "Constructor returns instance of abstract class");
});

test("AbstractResolver: constructor requires 'version'", (t) => {
	t.throws(() => {
		new MyResolver({});
	}, `AbstractResolver: Missing parameter "version"`);
});

test("AbstractResolver: Set absolute 'cwd'", (t) => {
	const resolver = new MyResolver({
		version: "1.75.0",
		cwd: "/my-cwd"
	});
	t.is(resolver._cwd, path.resolve("/my-cwd"), "Should be resolved 'cwd'");
});

test("AbstractResolver: Set relative 'cwd'", (t) => {
	const resolver = new MyResolver({
		version: "1.75.0",
		cwd: "./my-cwd"
	});
	t.is(resolver._cwd, path.resolve("./my-cwd"), "Should be resolved 'cwd'");
});

test("AbstractResolver: Defaults 'cwd' to process.cwd()", (t) => {
	const resolver = new MyResolver({
		version: "1.75.0",
		ui5HomeDir: "/ui5home"
	});
	t.is(resolver._cwd, process.cwd(), "Should default to process.cwd()");
});

test("AbstractResolver: Set absolute 'ui5HomeDir'", (t) => {
	const resolver = new MyResolver({
		version: "1.75.0",
		ui5HomeDir: "/my-ui5HomeDir"
	});
	t.is(resolver._ui5HomeDir, path.resolve("/my-ui5HomeDir"), "Should be resolved 'ui5HomeDir'");
});

test("AbstractResolver: Set relative 'ui5HomeDir'", (t) => {
	const resolver = new MyResolver({
		version: "1.75.0",
		ui5HomeDir: "./my-ui5HomeDir"
	});
	t.is(resolver._ui5HomeDir, path.resolve("./my-ui5HomeDir"), "Should be resolved 'ui5HomeDir'");
});

test("AbstractResolver: Defaults 'ui5HomeDir' to ~/.ui5", (t) => {
	const resolver = new MyResolver({
		version: "1.75.0",
		cwd: "/test-project/"
	});
	t.is(resolver._ui5HomeDir, path.join(require("os").homedir(), ".ui5"), "Should default to ~/.ui5");
});

test("AbstractResolver: handleLibrary should throw an Error when not implemented", async (t) => {
	await t.throwsAsync(async () => {
		const resolver = new MyResolver({
			cwd: "/test-project/",
			version: "1.75.0"
		});
		await resolver.handleLibrary();
	}, `AbstractResolver: handleLibrary must be implemented!`);
});

test("AbstractResolver: install", async (t) => {
	const resolver = new MyResolver({
		cwd: "/test-project/",
		version: "1.75.0"
	});

	const metadata = {
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
			metadata: Promise.resolve(metadata.libraries["sap.ui.lib1"]),
			install: Promise.resolve({pkgPath: "/foo/sap.ui.lib1"})
		})
		.withArgs("sap.ui.lib2").resolves({
			metadata: Promise.resolve(metadata.libraries["sap.ui.lib2"]),
			install: Promise.resolve({pkgPath: "/foo/sap.ui.lib2"})
		})
		.withArgs("sap.ui.lib3").resolves({
			metadata: Promise.resolve(metadata.libraries["sap.ui.lib3"]),
			install: Promise.resolve({pkgPath: "/foo/sap.ui.lib3"})
		})
		.withArgs("sap.ui.lib4").resolves({
			metadata: Promise.resolve(metadata.libraries["sap.ui.lib4"]),
			install: Promise.resolve({pkgPath: "/foo/sap.ui.lib4"})
		});

	await resolver.install(["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib4"]);

	t.is(handleLibraryStub.callCount, 4, "Each library should be handled once");
});

test("AbstractResolver: install error handling (rejection of metadata/install)", async (t) => {
	const resolver = new MyResolver({
		cwd: "/test-project/",
		version: "1.75.0"
	});

	const handleLibraryStub = sinon.stub(resolver, "handleLibrary");
	handleLibraryStub
		.callsFake(async (libraryName) => {
			throw new Error(`Unknown handleLibrary call: ${libraryName}`);
		})
		.withArgs("sap.ui.lib1").resolves({
			metadata: Promise.reject(new Error("Error loading metadata for sap.ui.lib1")),
			install: Promise.reject(new Error("Error installing sap.ui.lib1"))
		})
		.withArgs("sap.ui.lib2").resolves({
			metadata: Promise.reject(new Error("Error loading metadata for sap.ui.lib2")),
			install: Promise.reject(new Error("Error installing sap.ui.lib2"))
		});

	await t.throwsAsync(async () => {
		await resolver.install(["sap.ui.lib1", "sap.ui.lib2"]);
	}, `Resolution of framework libraries failed with errors:
Failed to resolve library sap.ui.lib1: Error installing sap.ui.lib1
Failed to resolve library sap.ui.lib2: Error installing sap.ui.lib2`);

	t.is(handleLibraryStub.callCount, 2, "Each library should be handled once");
});

test("AbstractResolver: install error handling (rejection of dependency metadata/install)", async (t) => {
	const resolver = new MyResolver({
		cwd: "/test-project/",
		version: "1.75.0"
	});

	const handleLibraryStub = sinon.stub(resolver, "handleLibrary");
	handleLibraryStub
		.callsFake(async (libraryName) => {
			throw new Error(`Unknown handleLibrary call: ${libraryName}`);
		})
		.withArgs("sap.ui.lib1").resolves({
			metadata: Promise.resolve({
				dependencies: ["sap.ui.lib2"]
			}),
			install: Promise.resolve({pkgPath: "/foo/sap.ui.lib1"})
		})
		.withArgs("sap.ui.lib2").resolves({
			metadata: Promise.reject(new Error("Error loading metadata for sap.ui.lib2")),
			install: Promise.reject(new Error("Error installing sap.ui.lib2"))
		});

	await t.throwsAsync(async () => {
		await resolver.install(["sap.ui.lib1"]);
	}, `Resolution of framework libraries failed with errors:
Failed to resolve library sap.ui.lib2: Error installing sap.ui.lib2`);

	t.is(handleLibraryStub.callCount, 2, "Each library should be handled once");
});

test("AbstractResolver: install error handling (rejection of dependency install)", async (t) => {
	const resolver = new MyResolver({
		cwd: "/test-project/",
		version: "1.75.0"
	});

	const handleLibraryStub = sinon.stub(resolver, "handleLibrary");
	handleLibraryStub
		.callsFake(async (libraryName) => {
			throw new Error(`Unknown handleLibrary call: ${libraryName}`);
		})
		.withArgs("sap.ui.lib1").resolves({
			metadata: Promise.resolve({
				dependencies: ["sap.ui.lib2"]
			}),
			install: Promise.resolve({pkgPath: "/foo/sap.ui.lib1"})
		})
		.withArgs("sap.ui.lib2").callsFake(() => {
			return {
				metadata: Promise.resolve({
					dependencies: ["sap.ui.lib3"]
				}),
				install: Promise.resolve({pkgPath: "/foo/sap.ui.lib1"})
			};
		})
		.withArgs("sap.ui.lib3").callsFake(() => {
			return {
				metadata: Promise.resolve({
					dependencies: []
				}),
				install: Promise.reject(new Error("Error installing sap.ui.lib3"))
			};
		});

	await t.throwsAsync(async () => {
		await resolver.install(["sap.ui.lib1"]);
	}, `Resolution of framework libraries failed with errors:
Failed to resolve library sap.ui.lib3: Error installing sap.ui.lib3`);

	t.is(handleLibraryStub.callCount, 3, "Each library should be handled once");
});

test("AbstractResolver: install error handling (handleLibrary throws error)", async (t) => {
	const resolver = new MyResolver({
		cwd: "/test-project/",
		version: "1.75.0"
	});

	const handleLibraryStub = sinon.stub(resolver, "handleLibrary");
	handleLibraryStub
		.callsFake(async (libraryName) => {
			throw new Error(`Error within handleLibrary: ${libraryName}`);
		});

	await t.throwsAsync(async () => {
		await resolver.install(["sap.ui.lib1", "sap.ui.lib2"]);
	}, `Resolution of framework libraries failed with errors:
Failed to resolve library sap.ui.lib1: Error within handleLibrary: sap.ui.lib1
Failed to resolve library sap.ui.lib2: Error within handleLibrary: sap.ui.lib2`);

	t.is(handleLibraryStub.callCount, 2, "Each library should be handled once");
});
