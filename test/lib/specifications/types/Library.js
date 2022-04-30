const test = require("ava");
const path = require("path");
const Specification = require("../../../../lib/specifications/Specification");
const Library = require("../../../../lib/specifications/types/Library");

function clone(obj) {
	return JSON.parse(JSON.stringify(obj));
}

const applicationAPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.d");
const basicProjectInput = {
	id: "library.d.id",
	version: "1.0.0",
	modulePath: applicationAPath,
	configuration: {
		specVersion: "2.3",
		kind: "project",
		type: "library",
		metadata: {
			name: "library.d",
		},
		resources: {
			configuration: {
				paths: {
					src: "main/src",
					test: "main/test"
				}
			}
		},
	}
};

test("Correct class", async (t) => {
	const project = await Specification.create(basicProjectInput);
	t.true(project instanceof Library, `Is an instance of the Library class`);
});

test("getNamespace", async (t) => {
	const project = await Specification.create(basicProjectInput);
	t.is(project.getNamespace(), "library/d",
		"Returned correct namespace");
});

test("getPropertiesFileSourceEncoding: Default", async (t) => {
	const project = await Specification.create(basicProjectInput);
	t.is(project.getPropertiesFileSourceEncoding(), "UTF-8",
		"Returned correct default propertiesFileSourceEncoding configuration");
});

test("getPropertiesFileSourceEncoding: Configuration", async (t) => {
	const customProjectInput = clone(basicProjectInput);
	customProjectInput.configuration.resources.configuration.propertiesFileSourceEncoding = "ISO-8859-1";
	const project = await Specification.create(customProjectInput);
	t.is(project.getPropertiesFileSourceEncoding(), "ISO-8859-1",
		"Returned correct default propertiesFileSourceEncoding configuration");
});

test("Access project resources via reader: buildtime style", async (t) => {
	const project = await Specification.create(basicProjectInput);
	const reader = await project.getReader();
	const resource = await reader.byPath("/resources/library/d/.library");
	t.truthy(resource, "Found the requested resource");
	t.is(resource.getPath(), "/resources/library/d/.library", "Resource has correct path");
});

test("Access project resources via reader: flat style", async (t) => {
	const project = await Specification.create(basicProjectInput);
	const reader = await project.getReader({style: "flat"});
	const resource = await reader.byPath("/.library");
	t.truthy(resource, "Found the requested resource");
	t.is(resource.getPath(), "/.library", "Resource has correct path");
});

test("Access project test-resources via reader: buildtime style, including test resources", async (t) => {
	const project = await Specification.create(basicProjectInput);
	const reader = await project.getReader({style: "buildtime"});
	const resource = await reader.byPath("/test-resources/library/d/Test.html");
	t.truthy(resource, "Found the requested resource");
	t.is(resource.getPath(), "/test-resources/library/d/Test.html", "Resource has correct path");
});

test("Modify project resources via workspace and access via flat reader", async (t) => {
	const project = await Specification.create(basicProjectInput);
	const workspace = await project.getWorkspace();
	const workspaceResource = await workspace.byPath("/resources/library/d/.library");

	const newContent = (await workspaceResource.getString()).replace("fancy", "fancy dancy");
	workspaceResource.setString(newContent);
	await workspace.write(workspaceResource);

	const reader = await project.getReader({style: "flat"});
	const readerResource = await reader.byPath("/.library");
	t.truthy(readerResource, "Found the requested resource byPath");
	t.is(readerResource.getPath(), "/.library", "Resource (byPath) has correct path");
	t.is(await readerResource.getString(), newContent, "Found resource (byPath) has expected (changed) content");

	const globResult = await reader.byGlob("**/.library");
	t.is(globResult.length, 1, "Found the requested resource byGlob");
	t.is(globResult[0].getPath(), "/.library", "Resource (byGlob) has correct path");
	t.is(await globResult[0].getString(), newContent, "Found resource (byGlob) has expected (changed) content");
});
