const test = require("ava");
const path = require("path");
const Project = require("../../../lib/specifications/Project");
const Configuration = require("../../../lib/specifications/Configuration");

const applicationAPath = path.join(__dirname, "..", "..", "fixtures", "application.a");

test.beforeEach(async (t) => {
	t.context.basicConfiguration = new Configuration({
		specVersion: "2.3",
		kind: "project",
		type: "application",
		metadata: {name: "application.a"}
	});

	t.context.basicProjectInput = {
		id: "application.a.id",
		version: "1.0.0",
		modulePath: applicationAPath,
		configuration: t.context.basicConfiguration
	};
});

test("Instantiate a basic project", async (t) => {
	const project = new Project(t.context.basicProjectInput);
	t.is(project.getName(), "application.a", "Returned correct name");
	t.is(project.getVersion(), "1.0.0", "Returned correct version");
	t.is(project.getPath(), applicationAPath, "Returned correct project path");
});

test("_getConfiguration", async (t) => {
	const project = new Project(t.context.basicProjectInput);
	t.is(await project._getConfiguration(), t.context.basicConfiguration, "Returned correct configuration instance");
});

test("Access project root resources via reader", async (t) => {
	const project = new Project(t.context.basicProjectInput);
	const rootReader = await project.getRootReader();
	const packageJsonResource = await rootReader.byPath("/package.json");
	t.is(packageJsonResource.getPath(), "/package.json", "Successfully retrieved root resource");
});
