const test = require("ava");
const path = require("path");
const createArchiveMetadata = require("../../../lib/buildHelpers/createArchiveMetadata");
const Module = require("../../../lib/graph/Module");
const Specification = require("../../../lib/specifications/Specification");

const applicationAPath = path.join(__dirname, "..", "..", "fixtures", "application.a");
const archiveApplicationAPath = path.join(__dirname, "..", "..", "fixtures", "archives", "application.a");
const applicationAConfig = {
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
const libraryEPath = path.join(__dirname, "..", "..", "fixtures", "library.e");
const archiveLibraryEPath = path.join(__dirname, "..", "..", "fixtures", "archives", "library.e");
const libraryEConfig = {
	id: "library.e.id",
	version: "1.0.0",
	modulePath: libraryEPath,
	configuration: {
		specVersion: "2.3",
		kind: "project",
		type: "library",
		metadata: {name: "library.e"}
	}
};

const buildConfig = {
	selfContained: false,
	jsdoc: false,
	includedTasks: [],
	excludedTasks: []
};

// Note: The actual archive-metadata.json files in the fixtures are never used in these tests

test("Create archive from application project archive", async (t) => {
	const project = await Specification.create(applicationAConfig);
	project.getResourceTagCollection().setTag("/resources/id1/foo.js", "ui5:HasDebugVariant");

	const metadata = await createArchiveMetadata(project, buildConfig);
	const m = new Module({
		id: "archive-application.a.id",
		version: "2.0.0",
		modulePath: archiveApplicationAPath,
		configuration: metadata
	});

	const {project: archiveProject} = await m.getSpecifications();
	t.truthy(archiveProject, "Module was able to create project from archive metadata");
	t.is(archiveProject.getName(), project.getName(), "Archive project has correct name");
	t.is(archiveProject.getNamespace(), project.getNamespace(), "Archive project has correct namespace");
	t.is(archiveProject.getResourceTagCollection().getTag("/resources/id1/foo.js", "ui5:HasDebugVariant"), true,
		"Archive project has correct tag");
	t.is(archiveProject.getVersion(), "2.0.0", "Archive project has version from archive module");

	const resources = await archiveProject.getReader().byGlob("**/test.js");
	t.is(resources.length, 1,
		"Found requested resource in archive project");
	t.is(resources[0].getPath(), "/resources/id1/test.js",
		"Resource has expected path");
});

test("Create archive from library project archive", async (t) => {
	const project = await Specification.create(libraryEConfig);
	project.getResourceTagCollection().setTag("/resources/library/e/file.js", "ui5:HasDebugVariant");

	const metadata = await createArchiveMetadata(project, buildConfig);
	const m = new Module({
		id: "archive-library.e.id",
		version: "2.0.0",
		modulePath: archiveLibraryEPath,
		configuration: metadata
	});

	const {project: archiveProject} = await m.getSpecifications();
	t.truthy(archiveProject, "Module was able to create project from archive metadata");
	t.is(archiveProject.getName(), project.getName(), "Archive project has correct name");
	t.is(archiveProject.getNamespace(), project.getNamespace(), "Archive project has correct namespace");
	t.is(archiveProject.getResourceTagCollection().getTag("/resources/library/e/file.js", "ui5:HasDebugVariant"), true,
		"Archive project has correct tag");
	t.is(archiveProject.getVersion(), "2.0.0", "Archive project has version from archive module");

	const resources = await archiveProject.getReader().byGlob("**/some.js");
	t.is(resources.length, 1,
		"Found requested resource in archive project");
	t.is(resources[0].getPath(), "/resources/library/e/some.js",
		"Resource has expected path");
});
