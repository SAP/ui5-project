const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");
const path = require("path");
const os = require("os");
const fs = require("graceful-fs");

const pacote = require("pacote");
const libnpmconfig = require("libnpmconfig");
const lockfile = require("lockfile");
const logger = require("@ui5/logger");
const normalizer = require("../../../../lib/normalizer");
const Module = require("../../../../lib/graph/Module");
// let ui5Framework;
let Installer;

// Use path within project as mocking base directory to reduce chance of side effects
// in case mocks/stubs do not work and real fs is used
const fakeBaseDir = path.join(__dirname, "fake-tmp");
const ui5FrameworkBaseDir = path.join(fakeBaseDir, "homedir", ".ui5", "framework");
const ui5PackagesBaseDir = path.join(ui5FrameworkBaseDir, "packages");

test.before((t) => {
	sinon.stub(fs, "rename").yieldsAsync();
});

test.beforeEach((t) => {
	sinon.stub(libnpmconfig, "read").returns({
		toJSON: () => {
			return {
				registry: "https://registry.fake",
				cache: path.join(ui5FrameworkBaseDir, "cacache"),
				proxy: ""
			};
		}
	});
	sinon.stub(os, "homedir").returns(path.join(fakeBaseDir, "homedir"));

	sinon.stub(lockfile, "lock").yieldsAsync();
	sinon.stub(lockfile, "unlock").yieldsAsync();

	const testLogger = logger.getLogger();
	sinon.stub(logger, "getLogger").returns(testLogger);
	t.context.logInfoSpy = sinon.spy(testLogger, "info");

	mock("mkdirp", sinon.stub().resolves());

	// Re-require to ensure that mocked modules are used
	// ui5Framework = mock.reRequire("../../../../lib/graph/providers/ui5Framework");
	Installer = require("../../../../lib/ui5Framework/npm/Installer");
});

test.afterEach.always((t) => {
	sinon.restore();
	mock.stopAll();
	logger.setLevel("info"); // default log level
});

function defineTest(testName, {
	frameworkName,
	verbose = false
}) {
	const npmScope = frameworkName === "SAPUI5" ? "@sapui5" : "@openui5";

	const distributionMetadata = {
		libraries: {
			"sap.ui.lib1": {
				npmPackageName: "@sapui5/sap.ui.lib1",
				version: "1.75.1",
				dependencies: [],
				optionalDependencies: []
			},
			"sap.ui.lib2": {
				npmPackageName: "@sapui5/sap.ui.lib2",
				version: "1.75.2",
				dependencies: [
					"sap.ui.lib3"
				],
				optionalDependencies: []
			},
			"sap.ui.lib3": {
				npmPackageName: "@sapui5/sap.ui.lib3",
				version: "1.75.3",
				dependencies: [],
				optionalDependencies: [
					"sap.ui.lib4"
				]
			},
			"sap.ui.lib4": {
				npmPackageName: "@openui5/sap.ui.lib4",
				version: "1.75.4",
				dependencies: [
					"sap.ui.lib1"
				],
				optionalDependencies: []
			},
			"sap.ui.lib8": {
				npmPackageName: "@sapui5/sap.ui.lib8",
				version: "1.75.8",
				dependencies: [],
				optionalDependencies: []
			}
		}
	};

	test.serial(`${frameworkName}: ${verbose ? "(verbose) " : ""}${testName}`, async (t) => {
		// Enable verbose logging
		if (verbose) {
			logger.setLevel("verbose");
		}

		const testDependency = {
			id: "test-dependency-id",
			version: "4.5.6",
			path: path.join(fakeBaseDir, "project-test-dependency"),
			dependencies: [],
			configuration: {
				specVersion: "2.0",
				type: "library",
				metadata: {
					name: "test-dependency"
				},
				framework: {
					version: "1.99.0",
					name: frameworkName,
					libraries: [
						{
							name: "sap.ui.lib1"
						},
						{
							name: "sap.ui.lib2"
						},
						{
							name: "sap.ui.lib5",
							optional: true
						},
						{
							name: "sap.ui.lib6",
							development: true
						},
						{
							name: "sap.ui.lib8",
							// optional dependency gets resolved by dev-dependency of root project
							optional: true
						}
					]
				}
			}
		};
		const translatorTree = {
			id: "test-application-id",
			version: "1.2.3",
			path: path.join(fakeBaseDir, "project-test-application"),
			configuration: {
				specVersion: "2.0",
				type: "application",
				metadata: {
					name: "test-application"
				},
				framework: {
					name: frameworkName,
					version: "1.75.0",
					libraries: [
						{
							name: "sap.ui.lib1"
						},
						{
							name: "sap.ui.lib4",
							optional: true
						},
						{
							name: "sap.ui.lib8",
							development: true
						}
					]
				}
			},
			dependencies: [
				testDependency,
				{
					id: "test-dependency-no-framework-id",
					version: "7.8.9",
					path: path.join(fakeBaseDir, "project-test-dependency-no-framework"),
					configuration: {
						specVersion: "2.0",
						type: "library",
						metadata: {
							name: "test-dependency-no-framework"
						}
					},
					dependencies: [
						testDependency
					]
				}
			]
		};

		sinon.stub(normalizer, "generateDependencyTree").resolves(translatorTree);

		sinon.stub(Module.prototype, "_readConfigFile")
			.callsFake(async function() {
				switch (this.getPath()) {
				case path.join(ui5PackagesBaseDir, npmScope, "sap.ui.lib1",
					frameworkName === "SAPUI5" ? "1.75.1" : "1.75.0"):
					return [{
						specVersion: "1.0",
						type: "library",
						metadata: {
							name: "sap.ui.lib1"
						},
						framework: {libraries: []}
					}];
				case path.join(ui5PackagesBaseDir, npmScope, "sap.ui.lib2",
					frameworkName === "SAPUI5" ? "1.75.2" : "1.75.0"):
					return [{
						specVersion: "1.0",
						type: "library",
						metadata: {
							name: "sap.ui.lib2"
						},
						framework: {libraries: []}
					}];
				case path.join(ui5PackagesBaseDir, npmScope, "sap.ui.lib3",
					frameworkName === "SAPUI5" ? "1.75.3" : "1.75.0"):
					return [{
						specVersion: "1.0",
						type: "library",
						metadata: {
							name: "sap.ui.lib3"
						},
						framework: {libraries: []}
					}];
				case path.join(ui5PackagesBaseDir, "@openui5", "sap.ui.lib4",
					frameworkName === "SAPUI5" ? "1.75.4" : "1.75.0"):
					return [{
						specVersion: "1.0",
						type: "library",
						metadata: {
							name: "sap.ui.lib4"
						},
						framework: {libraries: []}
					}];
				case path.join(ui5PackagesBaseDir, npmScope, "sap.ui.lib8",
					frameworkName === "SAPUI5" ? "1.75.8" : "1.75.0"):
					return [{
						specVersion: "1.0",
						type: "library",
						metadata: {
							name: "sap.ui.lib8"
						},
						framework: {libraries: []}
					}];
				default:
					throw new Error(
						"Module#_readConfigFile stub called with unknown project: " +
						(this.getId())
					);
				}
			});

		sinon.stub(pacote, "extract").resolves();

		if (frameworkName === "OpenUI5") {
			sinon.stub(pacote, "manifest")
				.callsFake(async (spec) => {
					throw new Error("pacote.manifest stub called with unknown spec: " + spec);
				})
				.withArgs("@openui5/sap.ui.lib1@1.75.0")
				.resolves({
					name: "@openui5/sap.ui.lib1",
					version: "1.75.0",
					dependencies: {}
				})
				.withArgs("@openui5/sap.ui.lib2@1.75.0")
				.resolves({
					name: "@openui5/sap.ui.lib2",
					version: "1.75.0",
					dependencies: {
						"@openui5/sap.ui.lib3": "1.75.0"
					}
				})
				.withArgs("@openui5/sap.ui.lib3@1.75.0")
				.resolves({
					name: "@openui5/sap.ui.lib3",
					version: "1.75.0",
					devDependencies: {
						"@openui5/sap.ui.lib4": "1.75.0"
					}
				})
				.withArgs("@openui5/sap.ui.lib4@1.75.0")
				.resolves({
					name: "@openui5/sap.ui.lib4",
					version: "1.75.0",
					dependencies: {
						"@openui5/sap.ui.lib1": "1.75.0"
					}
				})
				.withArgs("@openui5/sap.ui.lib8@1.75.0")
				.resolves({
					name: "@openui5/sap.ui.lib8",
					version: "1.75.0",
					dependencies: {}
				});
		} else if (frameworkName === "SAPUI5") {
			sinon.stub(Installer.prototype, "readJson")
				.callsFake(async (path) => {
					throw new Error("Installer#readJson stub called with unknown path: " + path);
				})
				.withArgs(path.join(fakeBaseDir,
					"homedir", ".ui5", "framework", "packages",
					"@sapui5", "distribution-metadata", "1.75.0",
					"metadata.json"))
				.resolves(distributionMetadata);
		}

		const projectGraph = await normalizer.generateProjectGraph();

		const callbackStub = sinon.stub().resolves();
		await projectGraph.traverseDepthFirst(callbackStub);

		t.is(callbackStub.callCount, 8, "Correct number of projects have been visited");

		const callbackCalls = callbackStub.getCalls().map((call) => call.args[0].project.getName());
		t.deepEqual(callbackCalls, [
			"sap.ui.lib1",
			"sap.ui.lib8",
			"sap.ui.lib4",
			"sap.ui.lib3",
			"sap.ui.lib2",
			"test-dependency",
			"test-dependency-no-framework",
			"test-application",
		], "Traversed graph in correct order");

		const frameworkLibAlreadyAddedInfoLogged = (t.context.logInfoSpy.getCalls()
			.map(($) => $.firstArg)
			.findIndex(($) => $.includes("defines a dependency to the UI5 framework library")) !== -1);
		t.false(frameworkLibAlreadyAddedInfoLogged, "No info regarding already added UI5 framework libraries logged");
	});
}

defineTest("ui5Framework translator should enhance project graph with UI5 framework libraries", {
	frameworkName: "SAPUI5"
});
defineTest("ui5Framework translator should enhance project graph with UI5 framework libraries", {
	frameworkName: "SAPUI5",
	verbose: true
});
defineTest("ui5Framework translator should enhance project graph with UI5 framework libraries", {
	frameworkName: "OpenUI5"
});
defineTest("ui5Framework translator should enhance project graph with UI5 framework libraries", {
	frameworkName: "OpenUI5",
	verbose: true
});

// TODO missing tests from non-graph ui5Framework.integration.js

// TODO test: Should not download packages again in case they are already installed

// TODO test: Should ignore framework libraries in dependencies
