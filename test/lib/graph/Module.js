const test = require("ava");
const sinon = require("sinon");
const path = require("path");
const Module = require("../../../lib/graph/Module");

const applicationAPath = path.join(__dirname, "..", "..", "fixtures", "application.a");
const buildDescriptionApplicationAPath =
	path.join(__dirname, "..", "..", "fixtures", "build-manifest", "application.a");
const buildDescriptionLibraryAPath =
	path.join(__dirname, "..", "..", "fixtures", "build-manifest", "library.e");

const basicModuleInput = {
	id: "application.a.id",
	version: "1.0.0",
	modulePath: applicationAPath
};
const archiveAppProjectInput = {
	id: "application.a.id",
	version: "1.0.0",
	modulePath: buildDescriptionApplicationAPath
};

const archiveLibProjectInput = {
	id: "library.e.id",
	version: "1.0.0",
	modulePath: buildDescriptionLibraryAPath
};

// test.beforeEach((t) => {
// });

test.afterEach.always(() => {
	sinon.restore();
});

test("Instantiate a basic module", async (t) => {
	const ui5Module = new Module(basicModuleInput);
	t.is(ui5Module.getId(), "application.a.id", "Should return correct ID");
	t.is(ui5Module.getVersion(), "1.0.0", "Should return correct version");
	t.is(ui5Module.getPath(), applicationAPath, "Should return correct module path");
});

test("Access module root resources via reader", async (t) => {
	const ui5Module = new Module(basicModuleInput);
	const rootReader = await ui5Module.getReader();
	const packageJsonResource = await rootReader.byPath("/package.json");
	t.is(packageJsonResource.getPath(), "/package.json", "Successfully retrieved root resource");
});

test("Get specifications from module", async (t) => {
	const ui5Module = new Module(basicModuleInput);
	const {project, extensions} = await ui5Module.getSpecifications();
	t.is(project.getName(), "application.a", "Should return correct project");
	t.is(extensions.length, 0, "Should return no extensions");
});

test.only("Get specifications from application project with build manifest", async (t) => {
	const ui5Module = new Module(archiveAppProjectInput);
	const {project, extensions} = await ui5Module.getSpecifications();
	t.is(project.getName(), "application.a", "Should return correct project");
	t.is(extensions.length, 0, "Should return no extensions");
});

test.only("Get specifications from library project with build manifest", async (t) => {
	const ui5Module = new Module(archiveLibProjectInput);
	const {project, extensions} = await ui5Module.getSpecifications();
	t.is(project.getName(), "library.e", "Should return correct project");
	t.is(extensions.length, 0, "Should return no extensions");
});
