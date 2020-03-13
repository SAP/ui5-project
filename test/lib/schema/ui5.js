const test = require("ava");
const Ajv = require("ajv");
const ajvCoverage = require("./_ajvCoverage");
const {_Validator: Validator} = require("../../../lib/schema/validate");

async function assertValidation(t, config, expectedErrors = undefined) {
	let errors;
	try {
		await validator.validate({config});
	} catch (validationError) {
		errors = validationError.errors;
	}
	if (expectedErrors) {
		t.deepEqual(errors, expectedErrors);
	} else {
		// Use JSON string for better logging in case of errors
		t.is(JSON.stringify(errors, null, 2), undefined);
	}
}

const coverage = false;

let validator;
let createReport;

test.before(() => {
	if (coverage) {
		const {ajv, createReport: _createReport} = ajvCoverage(Ajv, {
			allErrors: true
		});
		createReport = _createReport;
		validator = new Validator(ajv);
	} else {
		validator = new Validator(new Ajv({
			allErrors: true
		}));
	}
});

test.after.always(() => {
	if (createReport) {
		createReport(global.__coverage__);
	}
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
	assertValidation(t, {
		"specVersion": "0.0"
	}, [
		{
			dataPath: ".specVersion",
			keyword: "enum",
			message: "should be equal to one of the allowed values",
			params: {
				allowedValues: [
					"2.0",
					"1.1",
					"1.0",
					"0.1",
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
			dataPath: ".type",
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
			dataPath: ".kind",
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
			dataPath: ".metadata.name",
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
			dataPath: ".metadata.copyright",
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
			dataPath: ".metadata",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "copyrihgt"
			}
		}
	]);
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
			dataPath: ".resources",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "notAllowed",
			}
		},
		{
			dataPath: ".resources.configuration",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "notAllowed",
			}
		},
		{
			dataPath: ".resources.configuration.propertiesFileSourceEncoding",
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
			dataPath: ".resources.configuration.paths",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "app",
			}
		},
		{
			dataPath: ".resources.configuration.paths.webapp",
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
			dataPath: ".resources.configuration.paths",
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
});

test("kind: extension / type: project-shim", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "extension",
		"type": "project-shim",
		"metadata": {
			"name": "my-project-shim"
		},
		"shims": {}
	});
});
