const test = require("ava");
const AjvCoverage = require("../../utils/AjvCoverage");
const {_Validator: Validator, ValidationError} = require("../../../lib/schema/validate");

async function assertValidation(t, config, expectedErrors = undefined) {
	const validation = t.context.validator.validate({config, project: {id: "my-project"}});
	if (expectedErrors) {
		const validationError = await t.throwsAsync(validation, {
			instanceOf: ValidationError,
			name: "ValidationError"
		});
		t.deepEqual(validationError.errors, expectedErrors);
	} else {
		await t.notThrowsAsync(validation);
	}
}

test.before((t) => {
	t.context.validator = new Validator();
	t.context.ajvCoverage = new AjvCoverage(t.context.validator.ajv);
});

test.after.always((t) => {
	t.context.ajvCoverage.createReport("html", {dir: "coverage/ajv"});
	const thresholds = {
		statements: 59,
		branches: 50,
		functions: 100,
		lines: 59
	};
	t.context.ajvCoverage.verify(thresholds);
});

test("Undefined", async (t) => {
	await assertValidation(t, undefined, [{
		dataPath: "",
		keyword: "type",
		message: "should be object",
		params: {
			type: "object",
		}
	}]);
});

test("Missing specVersion, type, metadata", async (t) => {
	await assertValidation(t, {}, [
		{
			dataPath: "",
			keyword: "required",
			message: "should have required property 'specVersion'",
			params: {
				missingProperty: "specVersion",
			}
		},
		{
			dataPath: "",
			keyword: "required",
			message: "should have required property 'metadata'",
			params: {
				missingProperty: "metadata",
			}
		},
		{
			dataPath: "",
			keyword: "required",
			message: "should have required property 'type'",
			params: {
				missingProperty: "type",
			}
		}

	]);
});

test("Missing type, metadata", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0"
	}, [
		{
			dataPath: "",
			keyword: "required",
			message: "should have required property 'metadata'",
			params: {
				missingProperty: "metadata",
			}
		},
		{
			dataPath: "",
			keyword: "required",
			message: "should have required property 'type'",
			params: {
				missingProperty: "type",
			}
		}
	]);
});

test("Invalid specVersion", async (t) => {
	await assertValidation(t, {
		"specVersion": "0.0"
	}, [
		{
			dataPath: "/specVersion",
			keyword: "errorMessage",
			message:
`Unsupported "specVersion":
Your UI5 CLI installation might be outdated.
Supported specification versions: "2.0", "1.1", "1.0", "0.1"
For details see: https://sap.github.io/ui5-tooling/pages/Configuration/#specification-versions`,
			params: {
				errors: [
					{
						dataPath: "/specVersion",
						keyword: "enum",
						message: "should be equal to one of the allowed values",
						params: {
							allowedValues: [
								"2.0",
								"1.1",
								"1.0",
								"0.1",
							],
						},
						schemaPath: "#/properties/specVersion/enum",
					},
				],
			}
		}
	]);
});

test("Invalid type", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "foo",
		"metadata": {
			"name": "foo"
		}
	}, [
		{
			dataPath: "/type",
			keyword: "enum",
			message: "should be equal to one of the allowed values",
			params: {
				allowedValues: [
					"application",
					"library",
					"theme-library",
					"module"
				]
			}
		}
	]);
});

test("Invalid kind", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "foo",
		"metadata": {
			"name": "foo"
		}
	}, [
		{
			dataPath: "/kind",
			keyword: "enum",
			message: "should be equal to one of the allowed values",
			params: {
				allowedValues: [
					"project",
					"extension",
					null
				],
			}
		}
	]);
});

test("Invalid metadata.name", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "application",
		"metadata": {
			"name": {}
		}
	}, [
		{
			dataPath: "/metadata/name",
			keyword: "type",
			message: "should be string",
			params: {
				type: "string"
			}
		}
	]);
});

test("Invalid metadata.copyright", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "application",
		"metadata": {
			"name": "foo",
			"copyright": 123
		}
	}, [
		{
			dataPath: "/metadata/copyright",
			keyword: "type",
			message: "should be string",
			params: {
				type: "string"
			}
		}
	]);
});

test("Additional metadata property", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "application",
		"metadata": {
			"name": "foo",
			"copyrihgt": "typo"
		}
	}, [
		{
			dataPath: "/metadata",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "copyrihgt"
			}
		}
	]);
});

test("specVersion 0.1", async (t) => {
	await assertValidation(t, {
		"specVersion": "0.1"
	});
});

test("specVersion 1.0", async (t) => {
	await assertValidation(t, {
		"specVersion": "1.0"
	});
});

test("specVersion 1.1", async (t) => {
	await assertValidation(t, {
		"specVersion": "1.1"
	});
});

test("type: application", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "application",
		"metadata": {
			"name": "com.sap.ui5.test",
			"copyright": "okay"
		},
		"resources": {
			"configuration": {
				"propertiesFileSourceEncoding": "UTF-8",
				"paths": {
					"webapp": "my/path"
				}
			}
		},
		"builder": {
			"resources": {
				"excludes": [
					"/resources/some/project/name/test_results/**",
					"/test-resources/**",
					"!/test-resources/some/project/name/demo-app/**"
				]
			},
			"jsdoc": {
				"excludes": [
					"some/project/name/thirdparty/**"
				]
			},
			"cachebuster": {
				"signatureType": "hash"
			},
			"customTasks": [
				{
					"name": "custom-task-1",
					"beforeTask": "replaceCopyright",
					"configuration": {
						"some-key": "some value"
					}
				},
				{
					"name": "custom-task-2",
					"afterTask": "custom-task-1",
					"configuration": {
						"color": "blue"
					}
				},
				{
					"name": "custom-task-2",
					"beforeTask": "not-valid",
					// "afterTask": "not-valid",
					"configuration": false
				}
			]
		},
		"server": {
			"settings": {
				"httpPort": 1337,
				"httpsPort": 1443
			}
		}
	});
});

test("type: application (invalid resources configuration)", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "application",
		"metadata": {
			"name": "com.sap.ui5.test"
		},
		"resources": {
			"configuration": {
				"propertiesFileSourceEncoding": "FOO",
				"paths": {
					"app": "webapp",
					"webapp": {
						"path": "invalid"
					}
				},
				"notAllowed": true
			},
			"notAllowed": true
		}
	}, [
		{
			dataPath: "/resources",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "notAllowed",
			}
		},
		{
			dataPath: "/resources/configuration",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "notAllowed",
			}
		},
		{
			dataPath: "/resources/configuration/propertiesFileSourceEncoding",
			keyword: "enum",
			message: "should be equal to one of the allowed values",
			params: {
				allowedValues: [
					"UTF-8",
					"ISO-8859-1"
				],
			}
		},
		{
			dataPath: "/resources/configuration/paths",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "app",
			}
		},
		{
			dataPath: "/resources/configuration/paths/webapp",
			keyword: "type",
			message: "should be string",
			params: {
				type: "string"
			}
		}
	]);
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "application",
		"metadata": {
			"name": "com.sap.ui5.test"
		},
		"resources": {
			"configuration": {
				"paths": "webapp"
			}
		}
	}, [
		{
			dataPath: "/resources/configuration/paths",
			keyword: "type",
			message: "should be object",
			params: {
				type: "object"
			}
		}
	]);
});

test("type: library", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "library",
		"metadata": {
			"name": "com.sap.ui5.test",
			"copyright": "yes"
		},
		"resources": {
			"configuration": {
				"propertiesFileSourceEncoding": "UTF-8",
				"paths": {
					"src": "my/path"
				}
			}
		},
		"builder": {
			"resources": {
				"excludes": [
					"/resources/some/project/name/test_results/**",
					"/test-resources/**",
					"!/test-resources/some/project/name/demo-app/**"
				]
			},
			"jsdoc": {
				"excludes": [
					"some/project/name/thirdparty/**"
				]
			},
			"cachebuster": {
				"signatureType": "time"
			},
			"customTasks": [
				{
					"name": "custom-task-1",
					"beforeTask": "replaceCopyright",
					"configuration": {
						"some-key": "some value"
					}
				},
				{
					"name": "custom-task-2",
					"afterTask": "custom-task-1",
					"configuration": {
						"color": "blue"
					}
				}
			]
		},
		"server": {
			"settings": {
				"httpPort": 1337,
				"httpsPort": 1443
			},
			"customMiddleware": [
				{
					"name": "myCustomMiddleware",
					"mountPath": "/myapp",
					"afterMiddleware": "compression",
					"configuration": {
						"debug": true
					}
				}
			]
		}
	});
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "library",
		"metadata": {
			"name": "com.sap.ui5.test",
			"copyright": "yes"
		},
		"foo": true
	}, [{
		dataPath: "",
		keyword: "additionalProperties",
		message: "should NOT have additional properties",
		params: {
			additionalProperty: "foo"
		}
	}]);
});

test("type: theme-library", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "theme-library",
		"metadata": {
			"name": "my-theme-library"
		},
		"resources": {
			"configuration": {
				"paths": {
					"src": "src/main/uilib",
					"test": "src/test/uilib"
				}
			}
		}
	});
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "theme-library",
		"metadata": {
			"name": "my-theme-library"
		},
		"foo": true
	}, [{
		dataPath: "",
		keyword: "additionalProperties",
		message: "should NOT have additional properties",
		params: {
			"additionalProperty": "foo"
		}
	}]);
});

test("type: module", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "module",
		"metadata": {
			"name": "my-module"
		}
	});
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "module",
		"metadata": {
			"name": "my-module"
		},
		"foo": true
	}, [{
		dataPath: "",
		keyword: "additionalProperties",
		message: "should NOT have additional properties",
		params: {
			"additionalProperty": "foo"
		}
	}]);
});

test("kind: project / type: application", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "project",
		"type": "application",
		"metadata": {
			"name": "my-application"
		}
	});
});

test("kind: extension / type: task", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "extension",
		"type": "task",
		"metadata": {
			"name": "my-task"
		},
		"task": {
			"path": "/foo"
		}
	});
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "extension",
		"type": "task",
		"metadata": {
			"name": "my-task"
		},
		"task": {
			"path": "/foo"
		},
		"resources": {}
	}, [{
		dataPath: "",
		keyword: "additionalProperties",
		message: "should NOT have additional properties",
		params: {
			"additionalProperty": "resources"
		}
	}]);
});

test("kind: extension / type: server-middleware", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "extension",
		"type": "server-middleware",
		"metadata": {
			"name": "my-server-middleware"
		},
		"middleware": {
			"path": "/foo"
		}
	});
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "extension",
		"type": "server-middleware",
		"metadata": {
			"name": "my-server-middleware"
		},
		"middleware": {
			"path": "/foo"
		},
		"task": {
			"path": "/bar"
		}
	}, [{
		dataPath: "",
		keyword: "additionalProperties",
		message: "should NOT have additional properties",
		params: {
			"additionalProperty": "task"
		}
	}]);
});

test("kind: extension / type: project-shim", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "extension",
		"type": "project-shim",
		"metadata": {
			"name": "my-project-shim"
		},
		"shims": {
			"configurations": {
				"my-dependency": {
					"specVersion": "2.0",
					"type": "application",
					"metadata": {
						"name": "my-application"
					}
				},
				"my-other-dependency": {
					"specVersion": "3.0",
					"type": "does-not-exist",
					"metadata": {
						"name": "my-application"
					}
				}
			},
			"dependencies": {
				"my-dependency": [
					"my-other-dependency"
				],
				"my-other-dependency": [
					"some-lib",
					"some-other-lib"
				]
			},
			"collections": {
				"my-dependency": {
					"modules": {
						"lib-1": "src/lib1",
						"lib-2": "src/lib2"
					}
				}
			}
		}
	});
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "extension",
		"type": "project-shim",
		"metadata": {
			"name": "my-project-shim"
		},
		"shims": {
			"configurations": {
				"invalid": {
					"specVersion": "3.0",
					"type": "does-not-exist",
					"metadata": {
						"name": "my-application"
					}
				}
			},
			"dependencies": {
				"my-dependency": {
					"foo": "bar"
				}
			},
			"collections": {
				"foo": {
					"modules": {
						"lib-1": {
							"path": "src/lib1"
						}
					},
					"notAllowed": true
				}
			},
			"notAllowed": true
		},
		"middleware": {}
	}, [
		{
			dataPath: "",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				"additionalProperty": "middleware"
			}
		},
		{
			dataPath: "/shims",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "notAllowed",
			},
		},
		{
			dataPath: "/shims/dependencies/my-dependency",
			keyword: "type",
			message: "should be array",
			params: {
				type: "array",
			},
		},
		{
			dataPath: "/shims/collections/foo",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "notAllowed",
			},
		},
		{
			dataPath: "/shims/collections/foo/modules/lib-1",
			keyword: "type",
			message: "should be string",
			params: {
				type: "string",
			},
		}
	]);
});

test("framework configuration: OpenUI5", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "application",
		"metadata": {
			"name": "my-application"
		},
		"framework": {
			"name": "OpenUI5",
			"version": "1.75.0",
			"libraries": [
				{"name": "sap.ui.core"},
				{"name": "sap.m"},
				{"name": "sap.f", "optional": true},
				{"name": "sap.ui.support", "development": true}
			]
		}
	});
});

test("framework configuration: SAPUI5", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "application",
		"metadata": {
			"name": "my-application"
		},
		"framework": {
			"name": "SAPUI5",
			"version": "1.75.0",
			"libraries": [
				{"name": "sap.ui.core"},
				{"name": "sap.m"},
				{"name": "sap.f", "optional": true},
				{"name": "sap.ui.support", "development": true}
			]
		}
	});
});

test("framework configuration: Invalid", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "application",
		"metadata": {
			"name": "my-application"
		},
		"framework": {
			"name": "FooUI5",
			"version": "1.75",
			"libraries": [
				"sap.ui.core",
				{"library": "sap.m"},
				{"name": "sap.f", "optional": "x"},
				{"name": "sap.f", "development": "no"}
			]
		}
	}, [
		{
			dataPath: "/framework/name",
			keyword: "enum",
			message: "should be equal to one of the allowed values",
			params: {
				allowedValues: [
					"OpenUI5",
					"SAPUI5",
				],
			},
		},
		{
			dataPath: "/framework/version",
			keyword: "pattern",
			message: "should match pattern \"^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$\"",
			params: {
				pattern: "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$",
			},
		},
		{
			dataPath: "/framework/libraries/0",
			keyword: "type",
			message: "should be object",
			params: {
				type: "object",
			}
		},
		{
			dataPath: "/framework/libraries/1",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "library",
			}
		},
		{
			dataPath: "/framework/libraries/1",
			keyword: "required",
			message: "should have required property 'name'",
			params: {
				missingProperty: "name",
			}
		},
		{
			dataPath: "/framework/libraries/2/optional",
			keyword: "type",
			message: "should be boolean",
			params: {
				type: "boolean"
			},
		},
		{
			dataPath: "/framework/libraries/3/development",
			keyword: "type",
			message: "should be boolean",
			params: {
				type: "boolean"
			},
		}
	]);
});
