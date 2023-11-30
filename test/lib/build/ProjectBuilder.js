import test from "ava";
import sinonGlobal from "sinon";
import path from "node:path";
import esmock from "esmock";
import {setLogLevel} from "@ui5/logger";
import OutputStyleEnum from "../../../lib/build/helpers/ProjectBuilderOutputStyle.js";

function noop() {}

function getMockProject(type, id = "b") {
	return {
		getName: () => "project." + id,
		getNamespace: () => "project/" + id,
		getType: () => type,
		getCopyright: noop,
		getVersion: noop,
		getReader: () => "reader",
		getWorkspace: () => "workspace",
	};
}

test.beforeEach(async (t) => {
	const sinon = t.context.sinon = sinonGlobal.createSandbox();
	t.context.getRootNameStub = sinon.stub().returns("project.a");
	t.context.getRootTypeStub = sinon.stub().returns("application");
	t.context.taskRepository = "taskRepository";
	t.context.graph = {
		getRoot: () => {
			return {
				getName: t.context.getRootNameStub,
				getType: t.context.getRootTypeStub,
			};
		},
		isSealed: sinon.stub().returns(true),
		getProjectNames: sinon.stub().returns([
			"project.a",
			"project.b",
			"project.c",
		]),
		getSize: sinon.stub().returns(3),
		getDependencies: sinon.stub().returns([]).withArgs("project.a").returns(["project.b"]),
		traverseBreadthFirst: async (start, callback) => {
			if (callback) {
				await callback({
					project: getMockProject("library", "c")
				});
				return;
			}
			await start({
				project: getMockProject("library", "a")
			});
			await start({
				project: getMockProject("library", "c")
			});
			await start({
				project: getMockProject("library", "b")
			});
		},
		traverseDepthFirst: async (callback) => {
			await callback({
				project: getMockProject("library", "a")
			});
			await callback({
				project: getMockProject("library", "b")
			});
			await callback({
				project: getMockProject("library", "c")
			});
		},
		getProject: sinon.stub().callsFake((projectName) => {
			return getMockProject(...projectName.split("."));
		})
	};

	t.context.ProjectBuilder = await esmock("../../../lib/build/ProjectBuilder.js");
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
});

test("Missing graph parameters", (t) => {
	const {ProjectBuilder} = t.context;
	const err1 = t.throws(() => {
		new ProjectBuilder({});
	});
	t.is(err1.message, "Missing parameter 'graph'",
		"Threw with expected error message");

	const err2 = t.throws(() => {
		new ProjectBuilder({graph: "graph"});
	});
	t.is(err2.message, "Missing parameter 'taskRepository'",
		"Threw with expected error message");
});

test("build", async (t) => {
	const {graph, taskRepository, ProjectBuilder, sinon} = t.context;

	const builder = new ProjectBuilder({graph, taskRepository});

	const filterProjectStub = sinon.stub().returns(true);
	const getProjectFilterStub = sinon.stub(builder, "_getProjectFilter").resolves(filterProjectStub);

	const requiresBuildStub = sinon.stub().returns(true);
	const runTasksStub = sinon.stub().resolves();
	const projectBuildContextMock = {
		getTaskRunner: () => {
			return {
				runTasks: runTasksStub,
			};
		},
		requiresBuild: requiresBuildStub,
		getProject: sinon.stub().returns(getMockProject("library"))
	};
	const createRequiredBuildContextsStub = sinon.stub(builder, "_createRequiredBuildContexts")
		.resolves(new Map().set("project.a", projectBuildContextMock));

	const registerCleanupSigHooksStub = sinon.stub(builder, "_registerCleanupSigHooks").returns("cleanup sig hooks");

	const writeResultsStub = sinon.stub(builder, "_writeResults").resolves();
	const deregisterCleanupSigHooksStub = sinon.stub(builder, "_deregisterCleanupSigHooks");
	const executeCleanupTasksStub = sinon.stub(builder, "_executeCleanupTasks").resolves();

	await builder.build({
		destPath: "dest/path",
		includedDependencies: ["dep a"],
		excludedDependencies: ["dep b"]
	});

	t.is(getProjectFilterStub.callCount, 1, "_getProjectFilter got called once");
	t.deepEqual(getProjectFilterStub.getCall(0).args[0], {
		explicitIncludes: ["dep a"],
		explicitExcludes: ["dep b"],
		dependencyIncludes: undefined
	}, "_getProjectFilter got called with correct arguments");

	t.is(createRequiredBuildContextsStub.callCount, 1, "_createRequiredBuildContexts got called once");
	t.deepEqual(createRequiredBuildContextsStub.getCall(0).args[0], [
		"project.a", "project.b", "project.c"
	], "_createRequiredBuildContexts got called with correct arguments");

	t.is(requiresBuildStub.callCount, 1, "ProjectBuildContext#requiresBuild got called once");
	t.is(registerCleanupSigHooksStub.callCount, 1, "_registerCleanupSigHooksStub got called once");

	t.is(runTasksStub.callCount, 1, "TaskRunner#runTasks got called once");

	t.is(writeResultsStub.callCount, 1, "_writeResults got called once");
	t.is(writeResultsStub.getCall(0).args[0], projectBuildContextMock,
		"_writeResults got called with correct first argument");
	t.is(writeResultsStub.getCall(0).args[1]._fsBasePath, path.resolve("dest/path") + path.sep,
		"_writeResults got called with correct second argument");

	t.is(deregisterCleanupSigHooksStub.callCount, 1, "_deregisterCleanupSigHooks got called once");
	t.is(deregisterCleanupSigHooksStub.getCall(0).args[0], "cleanup sig hooks",
		"_deregisterCleanupSigHooks got called with correct arguments");
	t.is(executeCleanupTasksStub.callCount, 1, "_executeCleanupTasksStub got called once");
});

test("build: Missing dest parameter", async (t) => {
	const {graph, taskRepository, ProjectBuilder} = t.context;

	const builder = new ProjectBuilder({graph, taskRepository});

	const err = await t.throwsAsync(builder.build({
		destPath: "dest/path",
		dependencyIncludes: "dependencyIncludes",
		includedDependencies: ["dep a"],
		excludedDependencies: ["dep b"]
	}));

	t.is(err.message,
		"Parameter 'dependencyIncludes' can't be used in conjunction " +
		"with parameters 'includedDependencies' or 'excludedDependencies",
		"Threw with expected error message");
});

test("build: Too many dependency parameters", async (t) => {
	const {graph, taskRepository, ProjectBuilder} = t.context;

	const builder = new ProjectBuilder({graph, taskRepository});

	const err = await t.throwsAsync(builder.build({
		includedDependencies: ["dep a"],
		excludedDependencies: ["dep b"]
	}));

	t.is(err.message, "Missing parameter 'destPath'", "Threw with expected error message");
});

test("build: createBuildManifest in conjunction with dependencies", async (t) => {
	const {graph, taskRepository, ProjectBuilder, sinon} = t.context;
	t.context.getRootTypeStub = sinon.stub().returns("library");
	const builder = new ProjectBuilder({graph, taskRepository,
		buildConfig: {
			createBuildManifest: true
		}
	});

	const filterProjectStub = sinon.stub().returns(true);
	sinon.stub(builder, "_getProjectFilter").resolves(filterProjectStub);
	const err = await t.throwsAsync(builder.build({
		destPath: "dest/path",
		includedDependencies: ["dep a"]
	}));

	t.is(err.message,
		"It is currently not supported to request the creation of a build manifest while " +
		"including any dependencies into the build result",
		"Threw with expected error message");
});

test("build: Failure", async (t) => {
	const {graph, taskRepository, ProjectBuilder, sinon} = t.context;

	const builder = new ProjectBuilder({graph, taskRepository});

	const filterProjectStub = sinon.stub().returns(true);
	sinon.stub(builder, "_getProjectFilter").resolves(filterProjectStub);

	const requiresBuildStub = sinon.stub().returns(true);
	const runTasksStub = sinon.stub().rejects(new Error("Some Error"));
	const projectBuildContextMock = {
		requiresBuild: requiresBuildStub,
		getTaskRunner: () => {
			return {
				runTasks: runTasksStub
			};
		},
		getProject: sinon.stub().returns(getMockProject("library"))
	};
	sinon.stub(builder, "_createRequiredBuildContexts")
		.resolves(new Map().set("project.a", projectBuildContextMock));

	sinon.stub(builder, "_registerCleanupSigHooks").returns("cleanup sig hooks");
	const writeResultsStub = sinon.stub(builder, "_writeResults").resolves();
	const deregisterCleanupSigHooksStub = sinon.stub(builder, "_deregisterCleanupSigHooks");
	const executeCleanupTasksStub = sinon.stub(builder, "_executeCleanupTasks").resolves();

	const err = await t.throwsAsync(builder.build({
		destPath: "dest/path",
		includedDependencies: ["dep a"],
		excludedDependencies: ["dep b"]
	}));

	t.is(err.message, "Some Error", "Threw with expected error message");

	t.is(writeResultsStub.callCount, 0, "_writeResults did not get called");

	t.is(deregisterCleanupSigHooksStub.callCount, 1, "_deregisterCleanupSigHooks got called once");
	t.is(deregisterCleanupSigHooksStub.getCall(0).args[0], "cleanup sig hooks",
		"_deregisterCleanupSigHooks got called with correct arguments");
	t.is(executeCleanupTasksStub.callCount, 1, "_executeCleanupTasksStub got called once");
});

test.serial("build: Multiple projects", async (t) => {
	const {graph, taskRepository, sinon} = t.context;

	const buildLoggerMock = {
		isLevelEnabled: sinon.stub(),
		setProjects: sinon.stub(),
		startProjectBuild: sinon.stub(),
		endProjectBuild: sinon.stub(),
		skipProjectBuild: sinon.stub(),

		info: sinon.stub(),
		verbose: sinon.stub(),
		error: sinon.stub(),
	};
	// Function acts as constructor for our class mock
	function CreateBuildLoggerMock(moduleName) {
		t.is(moduleName, "ProjectBuilder", "BuildLogger created with expected moduleName");
		return buildLoggerMock;
	}
	const ProjectBuilder = await esmock("../../../lib/build/ProjectBuilder.js", {
		"@ui5/logger/internal/loggers/Build": CreateBuildLoggerMock
	});

	const builder = new ProjectBuilder({graph, taskRepository});

	const filterProjectStub = sinon.stub().returns(true).onFirstCall().returns(false);
	const getProjectFilterStub = sinon.stub(builder, "_getProjectFilter").resolves(filterProjectStub);

	const requiresBuildAStub = sinon.stub().returns(true);
	const requiresBuildBStub = sinon.stub().returns(false);
	const requiresBuildCStub = sinon.stub().returns(true);
	const getBuildMetadataStub = sinon.stub().returns({
		timestamp: "2022-07-28T12:00:00.000Z",
		age: "xx days"
	});
	const runTasksStub = sinon.stub().resolves();
	const projectBuildContextMockA = {
		getTaskRunner: () => {
			return {
				runTasks: runTasksStub
			};
		},
		requiresBuild: requiresBuildAStub,
		getProject: sinon.stub().returns(getMockProject("library", "a"))
	};
	const projectBuildContextMockB = {
		getTaskRunner: () => {
			return {
				runTasks: runTasksStub
			};
		},
		getBuildMetadata: getBuildMetadataStub,
		requiresBuild: requiresBuildBStub,
		getProject: sinon.stub().returns(getMockProject("library", "b"))
	};
	const projectBuildContextMockC = {
		getTaskRunner: () => {
			return {
				runTasks: runTasksStub
			};
		},
		requiresBuild: requiresBuildCStub,
		getProject: sinon.stub().returns(getMockProject("library", "c"))
	};
	const createRequiredBuildContextsStub = sinon.stub(builder, "_createRequiredBuildContexts")
		.resolves(new Map()
			.set("project.a", projectBuildContextMockA)
			.set("project.b", projectBuildContextMockB)
			.set("project.c", projectBuildContextMockC)
		);

	const registerCleanupSigHooksStub = sinon.stub(builder, "_registerCleanupSigHooks").returns("cleanup sig hooks");
	const writeResultsStub = sinon.stub(builder, "_writeResults").resolves();
	const deregisterCleanupSigHooksStub = sinon.stub(builder, "_deregisterCleanupSigHooks");
	const executeCleanupTasksStub = sinon.stub(builder, "_executeCleanupTasks").resolves();

	setLogLevel("verbose");
	await builder.build({
		destPath: path.join("dest", "path"),
		dependencyIncludes: "dependencyIncludes"
	});
	setLogLevel("info");

	t.is(getProjectFilterStub.callCount, 1, "_getProjectFilter got called once");
	t.deepEqual(getProjectFilterStub.getCall(0).args[0], {
		explicitIncludes: [],
		explicitExcludes: [],
		dependencyIncludes: "dependencyIncludes"
	}, "_getProjectFilter got called with correct arguments");

	t.is(createRequiredBuildContextsStub.callCount, 1, "_createRequiredBuildContexts got called once");
	t.deepEqual(createRequiredBuildContextsStub.getCall(0).args[0], [
		"project.b", "project.c"
	], "_createRequiredBuildContexts got called with correct arguments");

	t.is(requiresBuildAStub.callCount, 1, "TaskRunner#requiresBuild got called once times for library.a");
	t.is(requiresBuildBStub.callCount, 1, "TaskRunner#requiresBuild got called once times for library.b");
	t.is(requiresBuildCStub.callCount, 1, "TaskRunner#requiresBuild got called once times for library.c");
	t.is(registerCleanupSigHooksStub.callCount, 1, "_registerCleanupSigHooksStub got called once");

	t.is(runTasksStub.callCount, 2, "TaskRunner#runTasks got called twice"); // library.b does not require a build

	t.is(writeResultsStub.callCount, 2, "_writeResults got called twice"); // library.a has not been requested
	t.is(writeResultsStub.getCall(0).args[0], projectBuildContextMockB,
		"_writeResults got called with correct first argument");
	t.is(writeResultsStub.getCall(0).args[1]._fsBasePath, path.resolve("dest/path") + path.sep,
		"_writeResults got called with correct second argument");
	t.is(writeResultsStub.getCall(1).args[0], projectBuildContextMockC,
		"_writeResults got called with correct first argument");
	t.is(writeResultsStub.getCall(1).args[1]._fsBasePath, path.resolve("dest/path") + path.sep,
		"_writeResults got called with correct second argument");

	t.is(deregisterCleanupSigHooksStub.callCount, 1, "_deregisterCleanupSigHooks got called once");
	t.is(deregisterCleanupSigHooksStub.getCall(0).args[0], "cleanup sig hooks",
		"_deregisterCleanupSigHooks got called with correct arguments");
	t.is(executeCleanupTasksStub.callCount, 1, "_executeCleanupTasksStub got called once");

	t.is(buildLoggerMock.setProjects.callCount, 1, "BuildLogger#setProjects got called once");
	t.deepEqual(buildLoggerMock.setProjects.firstCall.firstArg, [
		"project.a",
		"project.b",
		"project.c",
	], "BuildLogger#setProjects got called with expected argument");
	t.is(buildLoggerMock.startProjectBuild.callCount, 2,
		"BuildLogger#startProjectBuild got called twice");
	t.is(buildLoggerMock.startProjectBuild.getCall(0).firstArg, "project.a",
		"BuildLogger#startProjectBuild got called with expected argument on first call");
	t.is(buildLoggerMock.startProjectBuild.getCall(1).firstArg, "project.c",
		"BuildLogger#startProjectBuild got called with expected argument on second call");
	t.is(buildLoggerMock.endProjectBuild.callCount, 2,
		"BuildLogger#endProjectBuild got called twice");
	t.is(buildLoggerMock.endProjectBuild.getCall(0).firstArg, "project.a",
		"BuildLogger#endProjectBuild got called with expected argument on first call");
	t.is(buildLoggerMock.endProjectBuild.getCall(1).firstArg, "project.c",
		"BuildLogger#endProjectBuild got called with expected argument on second call");
	t.is(buildLoggerMock.skipProjectBuild.callCount, 1,
		"BuildLogger#skipProjectBuild got called once");
	t.is(buildLoggerMock.skipProjectBuild.getCall(0).firstArg, "project.b",
		"BuildLogger#skipProjectBuild got called with expected argument");
});

test("_createRequiredBuildContexts", async (t) => {
	const {graph, taskRepository, ProjectBuilder, sinon} = t.context;

	const builder = new ProjectBuilder({graph, taskRepository});

	const requiresBuildStub = sinon.stub().returns(true);
	const getRequiredDependenciesStub = sinon.stub()
		.returns(new Set())
		.onFirstCall().returns(new Set(["project.b"])); // required dependency of project.a

	const projectBuildContextMock = {
		requiresBuild: requiresBuildStub,
		getTaskRunner: () => {
			return {
				getRequiredDependencies: getRequiredDependenciesStub
			};
		}
	};
	const createProjectContextStub = sinon.stub(builder._buildContext, "createProjectContext")
		.returns(projectBuildContextMock);
	const projectBuildContexts = await builder._createRequiredBuildContexts(["project.a", "project.c"]);

	t.is(requiresBuildStub.callCount, 3, "TaskRunner#requiresBuild got called three times");
	t.is(getRequiredDependenciesStub.callCount, 3, "TaskRunner#getRequiredDependencies got called three times");

	t.deepEqual(Object.fromEntries(projectBuildContexts), {
		"project.a": projectBuildContextMock,
		"project.b": projectBuildContextMock, // is a required dependency of project.a
		"project.c": projectBuildContextMock,
	}, "Returned expected project build contexts");

	t.is(createProjectContextStub.callCount, 3, "BuildContext#createProjectContextStub got called three times");
	t.is(createProjectContextStub.getCall(0).args[0].project.getName(), "project.a",
		"First call to BuildContext#createProjectContextStub with expected project");
	t.is(createProjectContextStub.getCall(1).args[0].project.getName(), "project.c",
		"Second call to BuildContext#createProjectContextStub with expected project");
	t.is(createProjectContextStub.getCall(2).args[0].project.getName(), "project.b",
		"Third call to BuildContext#createProjectContextStub with expected project");
});

test.serial("_getProjectFilter with dependencyIncludes", async (t) => {
	const {graph, taskRepository, sinon} = t.context;
	const composeProjectListStub = sinon.stub().returns({
		includedDependencies: ["project.b", "project.c"],
		excludedDependencies: ["project.d", "project.e", "project.a"],
	});
	const ProjectBuilder = await esmock("../../../lib/build/ProjectBuilder.js", {
		"../../../lib/build/helpers/composeProjectList.js": composeProjectListStub
	});

	const builder = new ProjectBuilder({graph, taskRepository});

	const filterProject = await builder._getProjectFilter({
		dependencyIncludes: "dependencyIncludes",
		explicitIncludes: "explicitIncludes",
		explicitExcludes: "explicitExcludes",
	});

	t.is(composeProjectListStub.callCount, 1, "composeProjectList got called once");
	t.is(composeProjectListStub.getCall(0).args[0], graph,
		"composeProjectList got called with correct graph argument");
	t.is(composeProjectListStub.getCall(0).args[1], "dependencyIncludes",
		"composeProjectList got called with correct include/exclude argument");

	t.true(filterProject("project.a"), "project.a (root project) is always allowed");
	t.true(filterProject("project.b"), "project.b is allowed");
	t.true(filterProject("project.c"), "project.c is allowed");
	t.false(filterProject("project.d"), "project.d is not allowed");
	t.false(filterProject("project.e"), "project.e is not allowed");
});

test.serial("_getProjectFilter with explicit include/exclude", async (t) => {
	const {graph, taskRepository, sinon} = t.context;
	const composeProjectListStub = sinon.stub().returns({
		includedDependencies: ["project.b", "project.c"],
		excludedDependencies: ["project.d", "project.e", "project.a"],
	});
	const ProjectBuilder = await esmock("../../../lib/build/ProjectBuilder.js", {
		"../../../lib/build/helpers/composeProjectList.js": composeProjectListStub
	});

	const builder = new ProjectBuilder({graph, taskRepository});

	const filterProject = await builder._getProjectFilter({
		explicitIncludes: "explicitIncludes",
		explicitExcludes: "explicitExcludes",
	});

	t.is(composeProjectListStub.callCount, 1, "composeProjectList got called once");
	t.is(composeProjectListStub.getCall(0).args[0], graph,
		"composeProjectList got called with correct graph argument");
	t.deepEqual(composeProjectListStub.getCall(0).args[1], {
		includeDependencyTree: "explicitIncludes",
		excludeDependencyTree: "explicitExcludes",
	}, "composeProjectList got called with correct include/exclude argument");

	t.true(filterProject("project.a"), "project.a (root project) is always allowed");
	t.true(filterProject("project.b"), "project.b is allowed");
	t.true(filterProject("project.c"), "project.c is allowed");
	t.false(filterProject("project.d"), "project.d is not allowed");
	t.false(filterProject("project.e"), "project.e is not allowed");
});

test("_writeResults", async (t) => {
	const {ProjectBuilder, sinon} = t.context;
	t.context.getRootTypeStub = sinon.stub().returns("library");
	const {graph, taskRepository} = t.context;
	const builder = new ProjectBuilder({
		graph, taskRepository,
		buildConfig: {
			createBuildManifest: false,
			otherBuildConfig: "yes"
		}
	});

	const mockResources = [{
		_resourceName: "resource.a",
		getPath: () => "resource.a"
	}, {
		_resourceName: "resource.b",
		getPath: () => "resource.b"
	}, {
		_resourceName: "resource.c",
		getPath: () => "resource.c"
	}];
	const byGlobStub = sinon.stub().resolves(mockResources);
	const getReaderStub = sinon.stub().returns({
		byGlob: byGlobStub
	});
	const mockProject = getMockProject("library", "c");
	mockProject.getReader = getReaderStub;

	const getTagStub = sinon.stub().returns(false).onFirstCall().returns(true);
	const projectBuildContextMock = {
		getProject: () => mockProject,
		getTaskUtil: () => {
			return {
				isRootProject: () => false,
				getTag: getTagStub,
				STANDARD_TAGS: {
					OmitFromBuildResult: "OmitFromBuildResultTag"
				}
			};
		}
	};
	const writerMock = {
		write: sinon.stub().resolves()
	};

	await builder._writeResults(projectBuildContextMock, writerMock);

	t.is(getReaderStub.callCount, 1, "One reader requested");
	t.deepEqual(getReaderStub.getCall(0).args[0], {
		style: "dist"
	}, "Reader requested expected style");

	t.is(byGlobStub.callCount, 1, "One byGlob call");
	t.is(byGlobStub.getCall(0).args[0], "/**/*", "byGlob called with expected pattern");

	t.is(getTagStub.callCount, 3, "TaskUtil#getTag got called three times");
	t.is(getTagStub.getCall(0).args[0], mockResources[0], "TaskUtil#getTag called with first resource");
	t.is(getTagStub.getCall(0).args[1], "OmitFromBuildResultTag", "TaskUtil#getTag called with correct tag value");
	t.is(getTagStub.getCall(1).args[0], mockResources[1], "TaskUtil#getTag called with second resource");
	t.is(getTagStub.getCall(1).args[1], "OmitFromBuildResultTag", "TaskUtil#getTag called with correct tag value");
	t.is(getTagStub.getCall(2).args[0], mockResources[2], "TaskUtil#getTag called with third resource");
	t.is(getTagStub.getCall(2).args[1], "OmitFromBuildResultTag", "TaskUtil#getTag called with correct tag value");

	t.is(writerMock.write.callCount, 2, "Write got called twice");
	t.is(writerMock.write.getCall(0).args[0], mockResources[1], "Write got called with second resource");
	t.is(writerMock.write.getCall(1).args[0], mockResources[2], "Write got called with third resource");
});

test.serial("_writeResults: Create build manifest", async (t) => {
	const {sinon} = t.context;
	t.context.getRootTypeStub = sinon.stub().returns("library");
	const {graph, taskRepository} = t.context;

	const createBuildManifestStub = sinon.stub().returns({"build": "manifest"});
	const createResourceStub = sinon.stub().returns("build manifest resource");
	const ProjectBuilder = await esmock.p("../../../lib/build/ProjectBuilder.js", {
		"../../../lib/build/helpers/createBuildManifest.js": createBuildManifestStub,
		"@ui5/fs/resourceFactory": {
			createResource: createResourceStub
		}
	});

	const builder = new ProjectBuilder({
		graph, taskRepository,
		buildConfig: {
			createBuildManifest: true,
			otherBuildConfig: "yes"
		}
	});

	const mockResources = [{
		_resourceName: "resource.a",
		getPath: () => "resource.a"
	}, {
		_resourceName: "resource.b",
		getPath: () => "resource.b"
	}, {
		_resourceName: "resource.c",
		getPath: () => "resource.c"
	}];
	const byGlobStub = sinon.stub().resolves(mockResources);
	const getReaderStub = sinon.stub().returns({
		byGlob: byGlobStub
	});
	const mockProject = getMockProject("library", "c");
	mockProject.getReader = getReaderStub;

	const getTagStub = sinon.stub().returns(false).onFirstCall().returns(true);
	const projectBuildContextMock = {
		getProject: () => mockProject,
		getTaskUtil: () => {
			return {
				isRootProject: () => true,
				getTag: getTagStub,
				STANDARD_TAGS: {
					OmitFromBuildResult: "OmitFromBuildResultTag"
				}
			};
		}
	};
	const writerMock = {
		write: sinon.stub().resolves()
	};

	await builder._writeResults(projectBuildContextMock, writerMock);

	t.is(getReaderStub.callCount, 1, "One reader requested");
	t.deepEqual(getReaderStub.getCall(0).args[0], {
		style: "buildtime"
	}, "Reader requested expected style");

	t.is(byGlobStub.callCount, 1, "One byGlob call");
	t.is(byGlobStub.getCall(0).args[0], "/**/*", "byGlob called with expected pattern");

	t.is(createBuildManifestStub.callCount, 1, "createBuildManifest got called once");
	t.is(createBuildManifestStub.getCall(0).args[0], mockProject,
		"createBuildManifest got called with correct project");
	t.deepEqual(createBuildManifestStub.getCall(0).args[1], {
		createBuildManifest: true,
		outputStyle: OutputStyleEnum.Default,
		cssVariables: false,
		excludedTasks: [],
		includedTasks: [],
		jsdoc: false,
		selfContained: false,
	}, "createBuildManifest got called with correct build configuration");

	t.is(createResourceStub.callCount, 1, "One resource has been created");
	t.deepEqual(createResourceStub.getCall(0).args[0], {
		path: "/.ui5/build-manifest.json",
		string: `{
	"build": "manifest"
}`
	}, "Build manifest resource has been created with correct arguments");

	t.is(getTagStub.callCount, 3, "TaskUtil#getTag got called three times");
	t.is(getTagStub.getCall(0).args[0], mockResources[0], "TaskUtil#getTag called with first resource");
	t.is(getTagStub.getCall(0).args[1], "OmitFromBuildResultTag", "TaskUtil#getTag called with correct tag value");
	t.is(getTagStub.getCall(1).args[0], mockResources[1], "TaskUtil#getTag called with second resource");
	t.is(getTagStub.getCall(1).args[1], "OmitFromBuildResultTag", "TaskUtil#getTag called with correct tag value");
	t.is(getTagStub.getCall(2).args[0], mockResources[2], "TaskUtil#getTag called with third resource");
	t.is(getTagStub.getCall(2).args[1], "OmitFromBuildResultTag", "TaskUtil#getTag called with correct tag value");

	t.is(writerMock.write.callCount, 3, "Write got called three times");
	t.is(writerMock.write.getCall(0).args[0], "build manifest resource", "Write got called with build manifest");
	t.is(writerMock.write.getCall(1).args[0], mockResources[1], "Write got called with second resource");
	t.is(writerMock.write.getCall(2).args[0], mockResources[2], "Write got called with third resource");

	esmock.purge(ProjectBuilder);
});

test.serial("_writeResults: Flat build output", async (t) => {
	const {sinon, ProjectBuilder} = t.context;
	t.context.getRootTypeStub = sinon.stub().returns("library");
	const {graph, taskRepository} = t.context;

	const builder = new ProjectBuilder({
		graph, taskRepository,
		buildConfig: {
			outputStyle: OutputStyleEnum.Flat,
			otherBuildConfig: "yes"
		}
	});

	const mockResources = [{
		_resourceName: "resource.a",
		getPath: () => "resource.a"
	}, {
		_resourceName: "resource.b",
		getPath: () => "resource.b"
	}, {
		_resourceName: "resource.c",
		getPath: () => "resource.c"
	}];
	const byGlobStub = sinon.stub().resolves(mockResources);
	const getReaderStub = sinon.stub().returns({
		byGlob: byGlobStub
	});
	const mockProject = getMockProject("library", "c");
	mockProject.getReader = getReaderStub;

	const getTagStub = sinon.stub().returns(false).onFirstCall().returns(true);
	const projectBuildContextMock = {
		getProject: () => mockProject,
		getTaskUtil: () => {
			return {
				isRootProject: () => true,
				getTag: getTagStub,
				STANDARD_TAGS: {
					OmitFromBuildResult: "OmitFromBuildResultTag"
				}
			};
		}
	};
	const writerMock = {
		write: sinon.stub().resolves()
	};

	await builder._writeResults(projectBuildContextMock, writerMock);

	t.is(getReaderStub.callCount, 2, "One reader requested");
	t.deepEqual(getReaderStub.getCall(0).args[0], {
		style: "flat"
	}, "Reader requested expected style");

	t.is(byGlobStub.callCount, 2, "One byGlob call");
	t.is(byGlobStub.getCall(0).args[0], "/**/*", "byGlob called with expected pattern");

	t.is(getTagStub.callCount, 3, "TaskUtil#getTag got called three times");
	t.is(getTagStub.getCall(0).args[0], mockResources[0], "TaskUtil#getTag called with first resource");
	t.is(getTagStub.getCall(0).args[1], "OmitFromBuildResultTag", "TaskUtil#getTag called with correct tag value");
	t.is(getTagStub.getCall(1).args[0], mockResources[1], "TaskUtil#getTag called with second resource");
	t.is(getTagStub.getCall(1).args[1], "OmitFromBuildResultTag", "TaskUtil#getTag called with correct tag value");
	t.is(getTagStub.getCall(2).args[0], mockResources[2], "TaskUtil#getTag called with third resource");
	t.is(getTagStub.getCall(2).args[1], "OmitFromBuildResultTag", "TaskUtil#getTag called with correct tag value");

	t.is(writerMock.write.callCount, 2, "Write got called twice");
	t.is(writerMock.write.getCall(0).args[0], mockResources[1], "Write got called with second resource");
	t.is(writerMock.write.getCall(1).args[0], mockResources[2], "Write got called with third resource");
});


test("_executeCleanupTasks", async (t) => {
	const {graph, taskRepository, ProjectBuilder, sinon} = t.context;
	const builder = new ProjectBuilder({graph, taskRepository});

	const executeCleanupTasksStub = sinon.stub(builder._buildContext, "executeCleanupTasks");
	await builder._executeCleanupTasks();
	t.is(executeCleanupTasksStub.callCount, 1, "BuildContext#executeCleanupTasks got called once");
	t.deepEqual(executeCleanupTasksStub.getCall(0).args, [undefined],
		"BuildContext#executeCleanupTasks got called with correct arguments");

	// reset stub
	executeCleanupTasksStub.reset();
	// Call with enforcement flag
	await builder._executeCleanupTasks(true);
	t.is(executeCleanupTasksStub.callCount, 1, "BuildContext#executeCleanupTasks got called once");
	t.deepEqual(executeCleanupTasksStub.getCall(0).args, [true],
		"BuildContext#executeCleanupTasks got called with correct arguments");
});

test("instantiate new logger for every ProjectBuilder", async (t) => {
	function CreateBuildLoggerMock(moduleName) {
		t.is(moduleName, "ProjectBuilder", "BuildLogger created with expected moduleName");
		return {};
	}

	const {graph, taskRepository, sinon} = t.context;
	const createBuildLoggerMockSpy = sinon.spy(CreateBuildLoggerMock);
	const ProjectBuilder = await esmock("../../../lib/build/ProjectBuilder.js", {
		"@ui5/logger/internal/loggers/Build": createBuildLoggerMockSpy
	});

	new ProjectBuilder({graph, taskRepository});
	new ProjectBuilder({graph, taskRepository});

	t.is(createBuildLoggerMockSpy.callCount, 2, "BuildLogger is instantiated for every ProjectBuilder instance");
});


function getProcessListenerCount() {
	return ["SIGHUP", "SIGINT", "SIGTERM", "SIGBREAK"].map((eventName) => {
		return process.listenerCount(eventName);
	});
}
test("_registerCleanupSigHooks/_deregisterCleanupSigHooks", (t) => {
	const listenersBefore = getProcessListenerCount();

	const {graph, taskRepository, ProjectBuilder} = t.context;
	const builder = new ProjectBuilder({graph, taskRepository});

	const signals = builder._registerCleanupSigHooks();

	t.deepEqual(Object.keys(signals), ["SIGHUP", "SIGINT", "SIGTERM", "SIGBREAK"],
		"Returned four signal listeners");

	t.deepEqual(getProcessListenerCount(), listenersBefore.map((x) => x+1),
		"For every signal one new listener got registered");

	builder._deregisterCleanupSigHooks(signals);

	t.deepEqual(getProcessListenerCount(), listenersBefore,
		"All signal listeners got de-registered");
});

test("_getElapsedTime", (t) => {
	const {graph, taskRepository, ProjectBuilder} = t.context;
	const builder = new ProjectBuilder({graph, taskRepository});

	const res = builder._getElapsedTime(process.hrtime());
	t.truthy(res, "Returned a value");
});
