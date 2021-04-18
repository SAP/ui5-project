const test = require("ava");
const path = require("path");
const Specification = require("../../../lib/specifications/Specification");

const applicationAPath = path.join(__dirname, "..", "..", "fixtures", "application.a");
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

test("Instantiate a basic project", async (t) => {
	const project = await Specification.create(basicProjectInput);
	t.is(project.getName(), "application.a", "Returned correct name");
	t.is(project.getVersion(), "1.0.0", "Returned correct version");
	t.is(project.getPath(), applicationAPath, "Returned correct project path");
});

test("Configurations", async (t) => {
	const project = await Specification.create(basicProjectInput);
	t.is(project.getKind(), "project", "Returned correct kind configuration");
});

test("Access project root resources via reader", async (t) => {
	const project = await Specification.create(basicProjectInput);
	const rootReader = await project.getRootReader();
	const packageJsonResource = await rootReader.byPath("/package.json");
	t.is(packageJsonResource.getPath(), "/package.json", "Successfully retrieved root resource");
});
