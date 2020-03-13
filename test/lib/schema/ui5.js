const test = require("ava");
const Ajv = require("ajv");
const ajvCoverage = require("./_ajvCoverage");
const {_Validator: Validator} = require("../../../lib/schema/validate");

function assertValidation(t, data, expectedErrors = undefined) {
	const errors = validator.validate(data);
	if (expectedErrors) {
		t.deepEqual(errors, expectedErrors);
	} else {
		// Use JSON string for better logging in case of errors
		t.is(JSON.stringify(errors, null, 2), undefined);
		t.is(errors, undefined);
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

test("Missing specVersion, type, metadata", (t) => {
	assertValidation(t, {}, [
		{
			dataPath: "",
			keyword: "required",
			message: "should have required property 'specVersion'",
			params: {
				missingProperty: "specVersion",
			},
			schemaPath: "#/required"
		},
		{
			dataPath: "",
			keyword: "required",
			message: "should have required property 'metadata'",
			params: {
				missingProperty: "metadata",
			},
			schemaPath: "#/required"
		},
		{
			dataPath: "",
			keyword: "required",
			message: "should have required property 'type'",
			params: {
				missingProperty: "type",
			},
			schemaPath: "#/required"
		}

	]);
});

test("Missing type, metadata", (t) => {
	assertValidation(t, {
		"specVersion": "2.0"
	}, [
		{
			dataPath: "",
			keyword: "required",
			message: "should have required property 'metadata'",
			params: {
				missingProperty: "metadata",
			},
			schemaPath: "#/required"
		},
		{
			dataPath: "",
			keyword: "required",
			message: "should have required property 'type'",
			params: {
				missingProperty: "type",
			},
			schemaPath: "#/required"
		}
	]);
});

test("Invalid specVersion", (t) => {
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
			},
			schemaPath: "#/properties/specVersion/enum"
		}
	]);
});

test("Invalid type", (t) => {
	assertValidation(t, {
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
			},
			schemaPath: "#/properties/type/enum"
		}
	]);
});

test("Invalid kind", (t) => {
	assertValidation(t, {
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
			},
			schemaPath: "#/properties/kind/enum"
		}
	]);
});

test("Invalid metadata.name", (t) => {
	assertValidation(t, {
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
			},
			schemaPath: "../ui5.json#/definitions/metadata/properties/name/type"
		}
	]);
});

test("Invalid metadata.copyright", (t) => {
	assertValidation(t, {
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
			},
			schemaPath: "../ui5.json#/definitions/metadata/properties/copyright/type"
		}
	]);
});

test("Additional metadata property", (t) => {
	assertValidation(t, {
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
			},
			schemaPath: "../ui5.json#/definitions/metadata/additionalProperties"
		}
	]);
});

test("type: application", (t) => {
	assertValidation(t, {
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

test("type: application (invalid resources configuration)", (t) => {
	assertValidation(t, {
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
			},
			schemaPath: "#/properties/resources/additionalProperties",
		},
		{
			dataPath: ".resources.configuration",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "notAllowed",
			},
			schemaPath: "#/properties/resources/properties/configuration/additionalProperties",
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
			},
			schemaPath: "#/definitions/resources-configuration-propertiesFileSourceEncoding/enum"
		},
		{
			dataPath: ".resources.configuration.paths",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "app",
			},
			schemaPath: "#/properties/resources/properties/configuration/properties/paths/additionalProperties",
		},
		{
			dataPath: ".resources.configuration.paths.webapp",
			keyword: "type",
			message: "should be string",
			params: {
				type: "string"
			},
			schemaPath: "#/properties/resources/properties/configuration/properties/paths/properties/webapp/type"
		}
	]);
	assertValidation(t, {
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
			},
			schemaPath: "#/properties/resources/properties/configuration/properties/paths/type"
		}
	]);
});

test("type: library", (t) => {
	assertValidation(t, {
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
	assertValidation(t, {
		"specVersion": "2.0",
		"type": "library",
		"metadata": {
			"name": "com.sap.ui5.test",
			"copyright": "yes"
		},
		"foo": true
	}, [{
		"keyword": "additionalProperties",
		"dataPath": "",
		"schemaPath": "#/additionalProperties",
		"params": {
			"additionalProperty": "foo"
		},
		"message": "should NOT have additional properties"
	}]);
});

test("type: theme-library", (t) => {
	assertValidation(t, {
		"specVersion": "2.0",
		"type": "theme-library",
		"metadata": {
			"name": "my-theme-library"
		}
	});
	assertValidation(t, {
		"specVersion": "2.0",
		"type": "theme-library",
		"metadata": {
			"name": "my-theme-library"
		},
		"foo": true
	}, [{
		"keyword": "additionalProperties",
		"dataPath": "",
		"schemaPath": "#/additionalProperties",
		"params": {
			"additionalProperty": "foo"
		},
		"message": "should NOT have additional properties"
	}]);
});

test("type: module", (t) => {
	assertValidation(t, {
		"specVersion": "2.0",
		"type": "module",
		"metadata": {
			"name": "my-module"
		}
	});
	assertValidation(t, {
		"specVersion": "2.0",
		"type": "module",
		"metadata": {
			"name": "my-module"
		},
		"foo": true
	}, [{
		"keyword": "additionalProperties",
		"dataPath": "",
		"schemaPath": "#/additionalProperties",
		"params": {
			"additionalProperty": "foo"
		},
		"message": "should NOT have additional properties"
	}]);
});

test("kind: extension / type: task", (t) => {
	assertValidation(t, {
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

test("kind: extension / type: server-middleware", (t) => {
	assertValidation(t, {
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

test("kind: extension / type: project-shim", (t) => {
	assertValidation(t, {
		"specVersion": "2.0",
		"kind": "extension",
		"type": "project-shim",
		"metadata": {
			"name": "my-project-shim"
		},
		"shims": {}
	});
});
