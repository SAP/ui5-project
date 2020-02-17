const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");

const FrameworkInstaller = require("../../../lib/translators/ui5Framework").FrameworkInstaller;

test("_isUi5FrameworkProject", (t) => {
	t.true(FrameworkInstaller._isUi5FrameworkProject({id: "@sapui5/foo"}), "@sapui5/foo");
	t.true(FrameworkInstaller._isUi5FrameworkProject({id: "@openui5/foo"}), "@openui5/foo");
	t.false(FrameworkInstaller._isUi5FrameworkProject({id: "sapui5"}), "sapui5");
	t.false(FrameworkInstaller._isUi5FrameworkProject({id: "openui5"}), "openui5");
});

test("_collectReferencedUi5Libraries: Project without dependencies", (t) => {
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

test("_collectReferencedUi5Libraries: Project with libraries and dependency with libraries", (t) => {
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

test("Create FrameworkInstaller instance", (t) => {
	new FrameworkInstaller({
		dirPath: "/test-project/",
		distVersion: "1.75.0"
	});
	t.pass("Can create FrameworkInstaller instance");
});

test("_getDistMetadata returns metadata from @sapui5/distribution-metadata package", async (t) => {
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

test.todo("_getDistMetadata only installs and reads metadata once");
