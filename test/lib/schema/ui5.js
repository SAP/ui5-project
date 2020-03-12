const test = require("ava");

const validate = require("../../../lib/schema/validate");

function assertValidation(t, data, expectedErrors = undefined) {
	const errors = validate(data);
	if (expectedErrors) {
		t.deepEqual(errors, expectedErrors);
		t.is(errors.length, expectedErrors.length);
	} else {
		// Use JSON string for better logging in case of errors
		t.is(JSON.stringify(errors, null, 2), undefined);
		t.is(errors, undefined);
	}
}

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
	assertValidation(t, {
		"specVersion": "2.0",
		"type": "application",
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
