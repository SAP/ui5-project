const test = require("ava");
const sinon = require("sinon");
const path = require("path");
const Project = require("../../../lib/specifications/Project");
const ProjectConfiguration = require("../../../lib/configurations/ProjectConfiguration");

const applicationAPath = path.join(__dirname, "..", "..", "fixtures", "application.a");

const emptyConfiguration = new ProjectConfiguration({
	metadata: {name: "application.a"}
});
const basicProjectInput = {
	id: "application.a.id",
	version: "1.0.0",
	modulePath: applicationAPath,
	configuration: emptyConfiguration
};

// test.beforeEach((t) => {
// });

test.afterEach.always(() => {
	sinon.restore();
});

test("Instantiate a basic project", async (t) => {
	const project = new Project(basicProjectInput);
	t.is(project.getName(), "application.a", "Returned correct name");
	t.is(project.getVersion(), "1.0.0", "Returned correct version");
	t.is(project.getPath(), applicationAPath, "Returned correct project path");
});

test("getConfiguration", async (t) => {
	const project = new Project(basicProjectInput);
	t.is(await project.getConfiguration(), emptyConfiguration, "Returned correct configuration instance");
});

test("Access project root resources via reader", async (t) => {
	const project = new Project(basicProjectInput);
	const rootReader = await project.getRootReader();
	const packageJsonResource = await rootReader.byPath("/package.json");
	t.is(packageJsonResource.getPath(), "/package.json", "Successfully retrieved root resource");
});
