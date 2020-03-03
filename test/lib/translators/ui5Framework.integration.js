const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");
const path = require("path");
const os = require("os");

const pacote = require("pacote");
const libnpmconfig = require("libnpmconfig");
const normalizer = require("../../../lib/normalizer");
const projectPreprocessor = require("../../../lib/projectPreprocessor");
const ui5Framework = require("../../../lib/translators/ui5Framework");

// Use path within project as mocking base directory to reduce chance of side effects
// in case mocks/stubs do not work and real fs is used
const fakeBaseDir = path.join(__dirname, "fake-tmp");
const ui5FrameworkBaseDir = path.join(fakeBaseDir, "homedir", ".ui5", "framework");
const ui5PackagesBaseDir = path.join(ui5FrameworkBaseDir, "packages");

test.before((t) => {
	// Enable verbose logging
	require("@ui5/logger").setLevel("verbose");
});

test.beforeEach((t) => {
	sinon.stub(libnpmconfig, "read").returns({
		registry: "https://registry.fake",
		cache: path.join(ui5FrameworkBaseDir, "cacache"),
		proxy: ""
	});
	sinon.stub(os, "homedir").returns(path.join(fakeBaseDir, "homedir"));
});

test.afterEach.always((t) => {
	sinon.restore();
	mock.stopAll();
});

function defineTest(testName, {
	frameworkName
}) {
	const npmScope = frameworkName === "SAPUI5" ? "@sapui5" : "@openui5";

	test.serial(testName, async (t) => {
		const translatorTree = {
			id: "test-id",
			version: "1.2.3",
			path: path.join(fakeBaseDir, "application-project"),
			dependencies: [
				{
					id: "test-dependency-id",
					version: "4.5.6",
					path: path.join(fakeBaseDir, "dependency-project"),
					dependencies: []
				},
				{
					id: "test-dependency-no-framework-id",
					version: "7.8.9",
					path: path.join(fakeBaseDir, "dependency-project-no-framework"),
					dependencies: []
				}
			]
		};

		sinon.stub(normalizer, "generateDependencyTree").resolves(translatorTree);

		sinon.stub(projectPreprocessor.ProjectPreprocessor.prototype, "readConfigFile")
			.callsFake(async (configPath) => {
				throw new Error("ProjectPreprocessor#readConfigFile stub called with unknown configPath: " + configPath);
			})
			.withArgs(path.join(fakeBaseDir, "application-project", "ui5.yaml"))
			.resolves([{
				specVersion: "1.1",
				type: "application",
				metadata: {
					name: "test-project"
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
						}
					]
				}
			}])
			.withArgs(path.join(fakeBaseDir, "dependency-project", "ui5.yaml"))
			.resolves([{
				specVersion: "1.1",
				type: "library",
				metadata: {
					name: "test-project"
				},
				framework: {
					version: "1.99.0",
					libraries: [
						{
							name: "sap.ui.lib1"
						},
						{
							name: "sap.ui.lib2"
						}
					]
				}
			}])
			.withArgs(path.join(fakeBaseDir, "dependency-project-no-framework", "ui5.yaml"))
			.resolves([{
				specVersion: "1.1",
				type: "library",
				metadata: {
					name: "test-project-no-framework"
				}
			}])
			.withArgs(path.join(ui5PackagesBaseDir, npmScope, "sap.ui.lib1",
				frameworkName === "SAPUI5" ? "1.75.1" : "1.75.0", "ui5.yaml"
			))
			.resolves([{
				specVersion: "1.0",
				type: "library",
				metadata: {
					name: "sap.ui.lib1"
				},
				framework: {libraries: []}
			}])
			.withArgs(path.join(ui5PackagesBaseDir, npmScope, "sap.ui.lib2",
				frameworkName === "SAPUI5" ? "1.75.2" : "1.75.0", "ui5.yaml"
			))
			.resolves([{
				specVersion: "1.0",
				type: "library",
				metadata: {
					name: "sap.ui.lib2"
				},
				framework: {libraries: []}
			}])
			.withArgs(path.join(ui5PackagesBaseDir, npmScope, "sap.ui.lib3",
				frameworkName === "SAPUI5" ? "1.75.3" : "1.75.0", "ui5.yaml"
			))
			.resolves([{
				specVersion: "1.0",
				type: "library",
				metadata: {
					name: "sap.ui.lib3"
				},
				framework: {libraries: []}
			}])
			.withArgs(path.join(ui5PackagesBaseDir, "@openui5", "sap.ui.lib4",
				frameworkName === "SAPUI5" ? "1.75.4" : "1.75.0", "ui5.yaml"
			))
			.resolves([{
				specVersion: "1.0",
				type: "library",
				metadata: {
					name: "sap.ui.lib4"
				},
				framework: {libraries: []}
			}]);

		// Prevent applying types as this would require a lot of mocking
		sinon.stub(projectPreprocessor.ProjectPreprocessor.prototype, "applyType");

		sinon.stub(pacote, "extract").resolves();

		if (frameworkName === "OpenUI5") {
			sinon.stub(pacote, "manifest")
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
				});
		} else if (frameworkName === "SAPUI5") {
			mock(path.join(fakeBaseDir,
				"homedir", ".ui5", "framework", "packages",
				"@sapui5", "distribution-metadata", "1.75.0",
				"metadata.json"), {
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
					}
				}
			});
		}

		const expectedTree = {
			_level: 0,
			id: "test-id",
			kind: "project",
			version: "1.2.3",
			path: path.join(fakeBaseDir, "application-project"),
			specVersion: "1.1",
			type: "application",
			metadata: {
				name: "test-project"
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
					}
				]
			},
			dependencies: [
				{
					_level: 1,
					id: "test-dependency-id",
					version: "4.5.6",
					path: path.join(fakeBaseDir, "dependency-project"),
					specVersion: "1.1",
					kind: "project",
					type: "library",
					metadata: {
						name: "test-project"
					},
					framework: {
						version: "1.99.0",
						libraries: [
							{
								name: "sap.ui.lib1"
							},
							{
								name: "sap.ui.lib2"
							}
						]
					},
					dependencies: [
						{
							_level: 1,
							id: npmScope + "/sap.ui.lib1",
							version: frameworkName === "SAPUI5" ? "1.75.1" : "1.75.0",
							path: path.join(ui5PackagesBaseDir, npmScope, "sap.ui.lib1", frameworkName === "SAPUI5" ? "1.75.1" : "1.75.0"),
							specVersion: "1.0",
							kind: "project",
							type: "library",
							metadata: {
								name: "sap.ui.lib1"
							},
							framework: {
								libraries: []
							},
							dependencies: []
						},
						{
							_level: 1,
							id: npmScope + "/sap.ui.lib2",
							version: frameworkName === "SAPUI5" ? "1.75.2" : "1.75.0",
							path: path.join(ui5PackagesBaseDir, npmScope, "sap.ui.lib2", frameworkName === "SAPUI5" ? "1.75.2" : "1.75.0"),
							specVersion: "1.0",
							kind: "project",
							type: "library",
							metadata: {
								name: "sap.ui.lib2"
							},
							framework: {
								libraries: []
							},
							dependencies: [
								{
									_level: 2,
									id: npmScope + "/sap.ui.lib3",
									version: frameworkName === "SAPUI5" ? "1.75.3" : "1.75.0",
									path: path.join(ui5PackagesBaseDir, npmScope, "sap.ui.lib3", frameworkName === "SAPUI5" ? "1.75.3" : "1.75.0"),
									specVersion: "1.0",
									kind: "project",
									type: "library",
									metadata: {
										name: "sap.ui.lib3"
									},
									framework: {
										libraries: []
									},
									dependencies: [
										{
											_level: 1,
											id: "@openui5/sap.ui.lib4",
											version: frameworkName === "SAPUI5" ? "1.75.4" : "1.75.0",
											path: path.join(ui5PackagesBaseDir, "@openui5", "sap.ui.lib4", frameworkName === "SAPUI5" ? "1.75.4" : "1.75.0"),
											specVersion: "1.0",
											kind: "project",
											type: "library",
											metadata: {
												name: "sap.ui.lib4"
											},
											framework: {
												libraries: []
											},
											dependencies: [
												{
													_level: 1,
													id: npmScope + "/sap.ui.lib1",
													version: frameworkName === "SAPUI5" ? "1.75.1" : "1.75.0",
													path: path.join(ui5PackagesBaseDir, npmScope, "sap.ui.lib1", frameworkName === "SAPUI5" ? "1.75.1" : "1.75.0"),
													specVersion: "1.0",
													kind: "project",
													type: "library",
													metadata: {
														name: "sap.ui.lib1"
													},
													framework: {
														libraries: []
													},
													dependencies: []
												}
											]
										}
									]
								}
							]
						}
					]
				},
				{
					_level: 1,
					id: "test-dependency-no-framework-id",
					version: "7.8.9",
					path: path.join(fakeBaseDir, "dependency-project-no-framework"),
					specVersion: "1.1",
					kind: "project",
					type: "library",
					metadata: {
						name: "test-project-no-framework"
					},
					dependencies: []
				},
				{
					_level: 1,
					id: npmScope + "/sap.ui.lib1",
					version: frameworkName === "SAPUI5" ? "1.75.1" : "1.75.0",
					path: path.join(ui5PackagesBaseDir, npmScope, "sap.ui.lib1", frameworkName === "SAPUI5" ? "1.75.1" : "1.75.0"),
					specVersion: "1.0",
					kind: "project",
					type: "library",
					metadata: {
						name: "sap.ui.lib1"
					},
					framework: {
						libraries: []
					},
					dependencies: []
				},
				{
					_level: 1,
					id: "@openui5/sap.ui.lib4",
					version: frameworkName === "SAPUI5" ? "1.75.4" : "1.75.0",
					path: path.join(ui5PackagesBaseDir, "@openui5", "sap.ui.lib4", frameworkName === "SAPUI5" ? "1.75.4" : "1.75.0"),
					specVersion: "1.0",
					kind: "project",
					type: "library",
					metadata: {
						name: "sap.ui.lib4"
					},
					framework: {
						libraries: []
					},
					dependencies: [
						{
							_level: 1,
							id: npmScope + "/sap.ui.lib1",
							version: frameworkName === "SAPUI5" ? "1.75.1" : "1.75.0",
							path: path.join(ui5PackagesBaseDir, npmScope, "sap.ui.lib1", frameworkName === "SAPUI5" ? "1.75.1" : "1.75.0"),
							specVersion: "1.0",
							kind: "project",
							type: "library",
							metadata: {
								name: "sap.ui.lib1"
							},
							framework: {
								libraries: []
							},
							dependencies: []
						}
					]
				},
			]
		};

		const tree = await normalizer.generateProjectTree();

		t.deepEqual(tree, expectedTree, "Returned tree should be correct");
	});
}

defineTest("SAPUI5: ui5Framework translator should enhance tree with UI5 framework libraries", {
	frameworkName: "SAPUI5"
});
defineTest("OpenUI5: ui5Framework translator should enhance tree with UI5 framework libraries", {
	frameworkName: "OpenUI5"
});

function defineErrorTest(testName, {
	frameworkName,
	failExtract = false,
	failMetadata = false,
	expectedErrorMessage
}) {
	test.serial(testName, async (t) => {
		const translatorTree = {
			id: "test-id",
			version: "1.2.3",
			path: path.join(fakeBaseDir, "application-project"),
			dependencies: []
		};

		sinon.stub(normalizer, "generateDependencyTree").resolves(translatorTree);

		sinon.stub(projectPreprocessor.ProjectPreprocessor.prototype, "readConfigFile")
			.callsFake(async (configPath) => {
				throw new Error("ProjectPreprocessor#readConfigFile stub called with unknown configPath: " + configPath);
			})
			.withArgs(path.join(fakeBaseDir, "application-project", "ui5.yaml"))
			.resolves([{
				specVersion: "1.1",
				type: "application",
				metadata: {
					name: "test-project"
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
						}
					]
				}
			}]);

		// Prevent applying types as this would require a lot of mocking
		sinon.stub(projectPreprocessor.ProjectPreprocessor.prototype, "applyType");

		const extractStub = sinon.stub(pacote, "extract");

		if (frameworkName === "SAPUI5") {
			if (failExtract) {
				extractStub
					.withArgs("@sapui5/sap.ui.lib1@1.75.1")
					.rejects(new Error("Failed extracting package @sapui5/sap.ui.lib1@1.75.1"))
					.withArgs("@openui5/sap.ui.lib4@1.75.4")
					.rejects(new Error("Failed extracting package @openui5/sap.ui.lib4@1.75.4"));
			} else {
				extractStub
					.withArgs("@sapui5/sap.ui.lib1@1.75.1").resolves()
					.withArgs("@openui5/sap.ui.lib4@1.75.4").resolves();
			}
			if (failMetadata) {
				extractStub
					.withArgs("@sapui5/distribution-metadata@1.75.0")
					.rejects(new Error("Failed extracting package @sapui5/distribution-metadata@1.75.0"));
			} else {
				extractStub
					.withArgs("@sapui5/distribution-metadata@1.75.0")
					.resolves();
				mock(path.join(fakeBaseDir,
					"homedir", ".ui5", "framework", "packages",
					"@sapui5", "distribution-metadata", "1.75.0",
					"metadata.json"), {
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
						}
					}
				});
			}
		} else if (frameworkName === "OpenUI5") {
			if (failExtract) {
				extractStub
					.withArgs("@openui5/sap.ui.lib1@1.75.0")
					.rejects(new Error("Failed extracting package @openui5/sap.ui.lib1@1.75.0"))
					.withArgs("@openui5/sap.ui.lib4@1.75.0")
					.rejects(new Error("Failed extracting package @openui5/sap.ui.lib4@1.75.0"));
			} else {
				extractStub.resolves();
			}
			if (failMetadata) {
				sinon.stub(pacote, "manifest")
					.withArgs("@openui5/sap.ui.lib1@1.75.0")
					.rejects(new Error("Failed to read manifest of @openui5/sap.ui.lib1@1.75.0"))
					.withArgs("@openui5/sap.ui.lib4@1.75.0")
					.rejects(new Error("Failed to read manifest of @openui5/sap.ui.lib4@1.75.0"));
			} else {
				sinon.stub(pacote, "manifest")
					.withArgs("@openui5/sap.ui.lib1@1.75.0")
					.resolves({
						name: "@openui5/sap.ui.lib1",
						version: "1.75.0",
						dependencies: {}
					})
					.withArgs("@openui5/sap.ui.lib4@1.75.0")
					.resolves({
						name: "@openui5/sap.ui.lib4",
						version: "1.75.0"
					});
			}
		}

		await t.throwsAsync(async () => {
			await normalizer.generateProjectTree();
		}, expectedErrorMessage);
	});
}

defineErrorTest("SAPUI5: ui5Framework translator should throw a proper error when metadata request fails", {
	frameworkName: "SAPUI5",
	failMetadata: true,
	expectedErrorMessage: `Failed to install libraries:
Error: Failed extracting package @sapui5/distribution-metadata@1.75.0
Error: Failed extracting package @sapui5/distribution-metadata@1.75.0` // TODO: should only be returned once?
});
defineErrorTest("SAPUI5: ui5Framework translator should throw a proper error when package extraction fails", {
	frameworkName: "SAPUI5",
	failExtract: true,
	expectedErrorMessage: `Failed to install libraries:
Error: Failed extracting package @sapui5/sap.ui.lib1@1.75.1
Error: Failed extracting package @openui5/sap.ui.lib4@1.75.4`
});
defineErrorTest("SAPUI5: ui5Framework translator should throw a proper error when metadata request and package extraction fails", {
	frameworkName: "SAPUI5",
	failMetadata: true,
	failExtract: true,
	expectedErrorMessage: `Failed to install libraries:
Error: Failed extracting package @sapui5/distribution-metadata@1.75.0
Error: Failed extracting package @sapui5/distribution-metadata@1.75.0`
});


defineErrorTest("OpenUI5: ui5Framework translator should throw a proper error when metadata request fails", {
	frameworkName: "OpenUI5",
	failMetadata: true,
	expectedErrorMessage: `Failed to install libraries:
Error: Failed to read manifest of @openui5/sap.ui.lib1@1.75.0
Error: Failed to read manifest of @openui5/sap.ui.lib4@1.75.0`
});
defineErrorTest("OpenUI5: ui5Framework translator should throw a proper error when package extraction fails", {
	frameworkName: "OpenUI5",
	failExtract: true,
	expectedErrorMessage: `Failed to install libraries:
Error: Failed extracting package @openui5/sap.ui.lib1@1.75.0
Error: Failed extracting package @openui5/sap.ui.lib4@1.75.0`
});
defineErrorTest("OpenUI5: ui5Framework translator should throw a proper error when metadata request and package extraction fails", {
	frameworkName: "OpenUI5",
	failMetadata: true,
	failExtract: true,
	expectedErrorMessage: `Failed to install libraries:
Error: Failed to read manifest of @openui5/sap.ui.lib1@1.75.0
Error: Failed to read manifest of @openui5/sap.ui.lib4@1.75.0`
});

test.todo("Should not download packages again in case they are already installed");

test.todo("Should not download dist-metadata package when no libraries are defined");

test.todo("Should ignore framework libraries in dependencies");

test.serial("ui5Framework translator should not be called when no framework configuration is given", async (t) => {
	const translatorTree = {
		id: "test-id",
		version: "1.2.3",
		path: path.join(fakeBaseDir, "application-project"),
		dependencies: []
	};
	const projectPreprocessorTree = Object.assign({}, translatorTree, {
		specVersion: "1.1",
		type: "application",
		metadata: {
			name: "test-project"
		}
	});

	sinon.stub(normalizer, "generateDependencyTree").resolves(translatorTree);
	sinon.stub(projectPreprocessor, "processTree").withArgs(translatorTree).resolves(projectPreprocessorTree);

	const ui5FrameworkMock = sinon.mock(ui5Framework);
	ui5FrameworkMock.expects("generateDependencyTree").never();

	const expectedTree = projectPreprocessorTree;

	const tree = await normalizer.generateProjectTree();

	t.deepEqual(tree, expectedTree, "Returned tree should be correct");
	ui5FrameworkMock.verify();
});
