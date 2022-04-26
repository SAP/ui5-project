const test = require("ava");
const path = require("path");
const Specification = require("../../../../lib/specifications/Specification");
const Application = require("../../../../lib/specifications/types/Application");

function clone(obj) {
	return JSON.parse(JSON.stringify(obj));
}

const applicationAPath = path.join(__dirname, "..", "..", "..", "fixtures", "application.a");
const basicProjectInput = {
	id: "application.a.id",
	version: "1.0.0",
	modulePath: applicationAPath,
	configuration: {
		specVersion: "2.3",
		kind: "project",
		type: "application",
		metadata: {name: "application.a"}
	}
};

test("Correct class", async (t) => {
	const project = await Specification.create(basicProjectInput);
	t.true(project instanceof Application, `Is an instance of the Application class`);
});

test("getPropertiesFileSourceEncoding: Default", async (t) => {
	const project = await Specification.create(basicProjectInput);
	t.is(project.getPropertiesFileSourceEncoding(), "UTF-8",
		"Returned correct default propertiesFileSourceEncoding configuration");
});

test("getPropertiesFileSourceEncoding: Configuration", async (t) => {
	const customProjectInput = clone(basicProjectInput);
	customProjectInput.configuration.resources = {
		configuration: {
			propertiesFileSourceEncoding: "ISO-8859-1"
		}
	};
	const project = await Specification.create(customProjectInput);
	t.is(project.getPropertiesFileSourceEncoding(), "ISO-8859-1",
		"Returned correct default propertiesFileSourceEncoding configuration");
});

test("Access project resources via reader: buildtime style, no test resources", async (t) => {
	const project = await Specification.create(basicProjectInput);
	const reader = await project.getReader();
	const resource = await reader.byPath("/resources/id1/manifest.json");
	t.truthy(resource, "Found the requested resource");
	t.is(resource.getPath(), "/resources/id1/manifest.json", "Resource has correct path");
});

test("Access project resources via reader: flat style, no test resources", async (t) => {
	const project = await Specification.create(basicProjectInput);
	const reader = await project.getReader({style: "flat"});
	const resource = await reader.byPath("/manifest.json");
	t.truthy(resource, "Found the requested resource");
	t.is(resource.getPath(), "/manifest.json", "Resource has correct path");
});

test("Access project resources via reader: flat style, including test resources", async (t) => {
	const project = await Specification.create(basicProjectInput);
	const error = t.throws(() => {
		project.getReader({style: "flat", includeTestResources: true});
	});
	t.is(error.message, `Readers of style "flat" can't include test resources`, "Correct error message");
});
