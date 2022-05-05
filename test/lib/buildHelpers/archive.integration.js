const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");
const path = require("path");
const logger = require("@ui5/logger");
const createArchiveMetadata = require("../../../lib/buildHelpers/createArchiveMetadata");
const Module = require("../../../lib/graph/Module");
const Specification = require("../../../lib/specifications/Specification");

const applicationAPath = path.join(__dirname, "..", "..", "fixtures", "application.a");
const archiveApplicationAPath = path.join(__dirname, "..", "..", "fixtures", "archives", "application.a");
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

const buildConfig = {
	selfContained: false,
	jsdoc: false,
	includedTasks: [],
	excludedTasks: []
};

test.beforeEach((t) => {
	t.context.log = {
		warn: sinon.stub()
	};
	sinon.stub(logger, "getLogger").callThrough()
		.withArgs("buildHelpers:composeProjectList").returns(t.context.log);
	t.context.composeProjectList = mock.reRequire("../../../lib/buildHelpers/composeProjectList");
});

test.afterEach.always((t) => {
	sinon.restore();
	mock.stopAll();
});

test("Create archive from project and compare to fixture", async (t) => {
	const project = await Specification.create(basicProjectInput);
	project.getResourceTagCollection().setTag("/resources/id1/foo.js", "ui5:HasDebugVariant");

	const metadata = await createArchiveMetadata(project, buildConfig);
	const m = new Module({
		id: "archive-application.a.id",
		version: "1.0.0",
		modulePath: archiveApplicationAPath,
		configuration: metadata
	});

	const {project: archiveProject} = await m.getSpecifications();
	t.truthy(archiveProject, "Module was able to create project from archive metadata");
	t.is(archiveProject.getName(), project.getName(), "Archive project has correct name");
	t.is(archiveProject.getNamespace(), project.getNamespace(), "Archive project has correct name");
	t.is(archiveProject.getNamespace(), project.getNamespace(), "Archive project has correct name");
	t.is(archiveProject.getResourceTagCollection().getTag("/resources/id1/foo.js", "ui5:HasDebugVariant"), true,
		"Archive project has correct tag");
});
