const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");
const path = require("path");
const os = require("os");

const libnpmconfig = require("libnpmconfig");
const ui5Framework = require("../../../lib/translators/ui5Framework");
const utils = ui5Framework.utils;
const FrameworkResolver = ui5Framework.FrameworkResolver;

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

// Generic Resolver
test.serial("FrameworkResolver: constructor", (t) => {
	const resolver = new FrameworkResolver({
		cwd: "/test-project/",
		version: "1.75.0"
	});
	t.true(resolver instanceof FrameworkResolver, "Constructor returns instance of class");
});
test.serial("FrameworkResolver: constructor requires 'dirPath'", (t) => {
	t.throws(() => {
		new FrameworkResolver({
			version: "1.75.0"
		});
	}, `FrameworkResolver: Missing parameter "cwd"`);
});
test.serial("FrameworkResolver: constructor requires 'version'", (t) => {
	t.throws(() => {
		new FrameworkResolver({
			cwd: "/test-project/"
		});
	}, `FrameworkResolver: Missing parameter "version"`);
});
test.serial("FrameworkResolver: install", async (t) => {
	const resolver = new FrameworkResolver({
		cwd: "/test-project/",
		version: "1.75.0"
	});

	const handleLibraryStub = sinon.stub(resolver, "handleLibrary");
	handleLibraryStub
		.callsFake(async (libraryName) => {
			throw new Error(`Unknown handleLibrary call: ${libraryName}`);
		})
		.withArgs("sap.ui.lib1").resolves({
			libraryMetadata: {
				"npmPackageName": "@openui5/sap.ui.lib1",
				"version": "1.75.0",
				"dependencies": [],
				"optionalDependencies": []
			},
			install: Promise.resolve()
		})
		.withArgs("sap.ui.lib2").resolves({
			libraryMetadata: {
				"npmPackageName": "@openui5/sap.ui.lib2",
				"version": "1.75.0",
				"dependencies": [
					"sap.ui.lib3"
				],
				"optionalDependencies": []
			},
			install: Promise.resolve()
		})
		.withArgs("sap.ui.lib3").resolves({
			libraryMetadata: {
				"npmPackageName": "@openui5/sap.ui.lib3",
				"version": "1.75.0",
				"dependencies": [],
				"optionalDependencies": [
					"sap.ui.lib4"
				]
			},
			install: Promise.resolve()
		})
		.withArgs("sap.ui.lib4").resolves({
			libraryMetadata: {
				"npmPackageName": "@openui5/sap.ui.lib4",
				"version": "1.75.0",
				"dependencies": [
					"sap.ui.lib1"
				],
				"optionalDependencies": []
			},
			install: Promise.resolve()
		});

	await resolver.install(["sap.ui.lib1", "sap.ui.lib2", "sap.ui.lib4"]);

	t.is(handleLibraryStub.callCount, 4, "Each library should be handled once");
});
test.serial("FrameworkResolver: generateDependencyTree", async (t) => {
	const resolver = new FrameworkResolver({
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
test.todo("FrameworkResolver: _installPackage");

// Translator
test.serial("generateDependencyTree should ignore root project without framework configuration", async (t) => {
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
test.serial("utils.isFrameworkProject", (t) => {
	t.true(utils.isFrameworkProject({id: "@sapui5/foo"}), "@sapui5/foo");
	t.true(utils.isFrameworkProject({id: "@openui5/foo"}), "@openui5/foo");
	t.false(utils.isFrameworkProject({id: "sapui5"}), "sapui5");
	t.false(utils.isFrameworkProject({id: "openui5"}), "openui5");
});
test.serial("utils.getFrameworkLibrariesFromTree: Project without dependencies", (t) => {
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
	const ui5Dependencies = utils.getFrameworkLibrariesFromTree(tree);
	t.deepEqual(ui5Dependencies, []);
});

test.serial("utils.getFrameworkLibrariesFromTree: Project with libraries and dependency with libraries", (t) => {
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
	const ui5Dependencies = utils.getFrameworkLibrariesFromTree(tree);
	t.deepEqual(ui5Dependencies, ["lib1", "lib2", "lib3", "lib5"]);
});

test.todo("utils._getDistMetadata only installs and reads metadata once");

test.todo("Ensure no unhandled promise rejection happens during install");
