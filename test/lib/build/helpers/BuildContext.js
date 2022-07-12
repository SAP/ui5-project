const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");

test.afterEach.always((t) => {
	sinon.restore();
	mock.stopAll();
});

const BuildContext = require("../../../../lib/build/helpers/BuildContext");

test("Missing parameters", (t) => {
	const error = t.throws(() => {
		new BuildContext();
	});

	t.is(error.message, `Missing parameter 'graph'`, "Threw with expected error message");
});

test("getRootProject", (t) => {
	const buildContext = new BuildContext({
		getRoot: () => "pony"
	});

	t.is(buildContext.getRootProject(), "pony", "Returned correct value");
});

test("getGraph", (t) => {
	const buildContext = new BuildContext("graph");

	t.is(buildContext.getGraph(), "graph", "Returned correct value");
});

test("getBuildConfig: Default values", (t) => {
	const buildContext = new BuildContext("graph");

	t.deepEqual(buildContext.getBuildConfig(), {
		selfContained: false,
		cssVariables: false,
		jsdoc: false,
		createBuildManifest: false,
		includedTasks: [],
		excludedTasks: [],
	}, "Returned correct value");
});

test("getBuildConfig: Custom values", (t) => {
	const buildContext = new BuildContext({
		getRoot: () => {
			return {
				getType: () => "library"
			};
		}
	}, {
		selfContained: true,
		cssVariables: true,
		jsdoc: true,
		createBuildManifest: true,
		includedTasks: ["included tasks"],
		excludedTasks: ["excluded tasks"],
	});

	t.deepEqual(buildContext.getBuildConfig(), {
		selfContained: true,
		cssVariables: true,
		jsdoc: true,
		createBuildManifest: true,
		includedTasks: ["included tasks"],
		excludedTasks: ["excluded tasks"],
	}, "Returned correct value");
});

test("createBuildManifest not supported", (t) => {
	const err = t.throws(() => {
		new BuildContext({
			getRoot: () => {
				return {
					getType: () => "pony"
				};
			}
		}, {
			createBuildManifest: true
		});
	});
	t.is(err.message,
		"Build manifest creation is currently not supported for projects of type pony",
		"Threw with expected error message");
});

test("getBuildOption", (t) => {
	const buildContext = new BuildContext("graph", {
		cssVariables: "value",
	});

	t.is(buildContext.getOption("cssVariables"), "value",
		"Returned correct value for build configuration 'cssVariables'");
	t.is(buildContext.getOption("selfContained"), undefined,
		"Returned undefined for build configuration 'selfContained' " +
		"(not exposed as buold option)");
});

test.serial("createProjectContext", (t) => {
	class DummyProjectContext {
		constructor({buildContext, project, log}) {
			t.is(buildContext, testBuildContext, "Correct buildContext parameter");
			t.is(project, "project", "Correct project parameter");
			t.is(log, "log", "Correct log parameter");
		}
	}
	mock("../../../../lib/build/helpers/ProjectBuildContext", DummyProjectContext);

	const BuildContext = mock.reRequire("../../../../lib/build/helpers/BuildContext");
	const testBuildContext = new BuildContext("graph"
	);

	const projectContext = testBuildContext.createProjectContext({
		project: "project",
		log: "log"
	});

	t.true(projectContext instanceof DummyProjectContext,
		"Project context is an instance of DummyProjectContext");
	t.is(testBuildContext._projectBuildContexts[0], projectContext,
		"BuildContext stored correct ProjectBuildContext");
});

test("executeCleanupTasks", async (t) => {
	const buildContext = new BuildContext("graph"
	);

	const executeCleanupTasks = sinon.stub().resolves();

	buildContext._projectBuildContexts.push({
		executeCleanupTasks
	});
	buildContext._projectBuildContexts.push({
		executeCleanupTasks
	});

	await buildContext.executeCleanupTasks();

	t.is(executeCleanupTasks.callCount, 2,
		"Project context executeCleanupTasks got called twice");
});