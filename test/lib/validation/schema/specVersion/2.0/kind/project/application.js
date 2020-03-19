const test = require("ava");
const AjvCoverage = require("../../../../../../../utils/AjvCoverage");
const {_Validator: Validator} = require("../../../../../../../../lib/validation/validator");
const ValidationError = require("../../../../../../../../lib/validation/ValidationError");

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
	t.context.ajvCoverage = new AjvCoverage(t.context.validator.ajv, {
		includes: ["schema/specVersion/2.0/kind/project/application.json"]
	});
});

test.after.always((t) => {
	t.context.ajvCoverage.createReport("html", {dir: "coverage/ajv-project-application"});
	const thresholds = {
		statements: 75,
		branches: 65,
		functions: 100,
		lines: 75
	};
	t.context.ajvCoverage.verify(thresholds);
});

test("Valid configuration", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "project",
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
			"bundles": [
				{
					"bundleDefinition": {
						"name": "sap-ui-custom.js",
						"defaultFileTypes": [
							".js"
						],
						"sections": [
							{
								"mode": "raw",
								"filters": [
									"ui5loader-autoconfig.js"
								],
								"resolve": true,
								"resolveConditional": true,
								"renderer": true,
								"sort": true
							},
							{
								"mode": "provided",
								"filters": [
									"ui5loader-autoconfig.js"
								],
								"resolve": false,
								"resolveConditional": false,
								"renderer": false,
								"sort": false
							}
						]
					},
					"bundleOptions": {
						"optimize": true,
						"decorateBootstrapModule": true,
						"addTryCatchRestartWrapper": true,
						"usePredefineCalls": true
					}
				},
				{
					"bundleDefinition": {
						"name": "app.js",
						"defaultFileTypes": [
							".js"
						],
						"sections": [
							{
								"mode": "preload",
								"filters": [
									"some/app/Component.js"
								],
								"resolve": true,
								"sort": true
							},
							{
								"mode": "provided",
								"filters": [
									"ui5loader-autoconfig.js"
								],
								"resolve": true
							}
						]
					},
					"bundleOptions": {
						"optimize": true,
						"numberOfParts": 3
					}
				}
			],
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
					"configuration": false
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
				},
				{
					"name": "myCustomMiddleware-2",
					"beforeMiddleware": "myCustomMiddleware",
					"configuration": {
						"debug": true
					}
				}
			]
		}
	});
});

test("Additional property", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "application",
		"metadata": {
			"name": "my-application"
		},
		"notAllowed": true
	}, [{
		dataPath: "",
		keyword: "additionalProperties",
		message: "should NOT have additional properties",
		params: {
			additionalProperty: "notAllowed",
		},
		schemaPath: "#/additionalProperties",
	}]);
});

test("Invalid resources configuration", async (t) => {
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
			},
			schemaPath: "#/additionalProperties",
		},
		{
			dataPath: "/resources/configuration",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "notAllowed",
			},
			schemaPath: "#/properties/configuration/additionalProperties",
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
			},
			schemaPath: "../project.json#/definitions/resources-configuration-propertiesFileSourceEncoding/enum"
		},
		{
			dataPath: "/resources/configuration/paths",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "app",
			},
			schemaPath: "#/properties/configuration/properties/paths/additionalProperties",
		},
		{
			dataPath: "/resources/configuration/paths/webapp",
			keyword: "type",
			message: "should be string",
			params: {
				type: "string"
			},
			schemaPath: "#/properties/configuration/properties/paths/properties/webapp/type"
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
			},
			schemaPath: "#/properties/configuration/properties/paths/type",
		}
	]);
});

test("Invalid builder configuration", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "application",
		"metadata": {
			"name": "com.sap.ui5.test",
			"copyright": "yes"
		},
		"builder": {
			// jsdoc is not supported for type application
			"jsdoc": {
				"excludes": [
					"some/project/name/thirdparty/**"
				]
			},
			"bundles": [
				{
					"bundleDefinition": {
						"name": "sap-ui-custom.js",
						"defaultFileTypes": [
							".js"
						],
						"sections": [
							{
								"mode": "raw",
								"filters": [
									"ui5loader-autoconfig.js"
								],
								"resolve": true,
								"sort": true
							}
						]
					},
					"bundleOptions": {
						"optimize": true
					}
				},
				{
					"bundleDefinition": {
						"defaultFileTypes": [
							".js", true
						],
						"sections": [
							{
								"filters": [
									"some/app/Component.js"
								],
								"resolve": true,
								"sort": true
							},
							{
								"mode": "provide",
								"filters": "*",
								"resolve": true
							}
						]
					},
					"bundleOptions": {
						"optimize": "true",
						"numberOfParts": "3",
						"notAllowed": true
					}
				}
			]
		}
	}, [
		{
			dataPath: "/builder",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "jsdoc"
			},
			schemaPath: "#/additionalProperties"
		},
		{
			dataPath: "/builder/bundles/1/bundleDefinition",
			keyword: "required",
			message: "should have required property 'name'",
			params: {
				missingProperty: "name",
			},
			schemaPath: "../project.json#/definitions/builder-bundles/items/properties/bundleDefinition/required",
		},
		{
			dataPath: "/builder/bundles/1/bundleDefinition/defaultFileTypes/1",
			keyword: "type",
			message: "should be string",
			params: {
				type: "string",
			},
			schemaPath: "../project.json#/definitions/builder-bundles/items/properties/bundleDefinition/properties/defaultFileTypes/items/type",
		},
		{
			dataPath: "/builder/bundles/1/bundleDefinition/sections/0",
			keyword: "required",
			message: "should have required property 'mode'",
			params: {
				missingProperty: "mode",
			},
			schemaPath: "../project.json#/definitions/builder-bundles/items/properties/bundleDefinition/properties/sections/items/required",
		},
		{
			dataPath: "/builder/bundles/1/bundleDefinition/sections/1/mode",
			keyword: "enum",
			message: "should be equal to one of the allowed values",
			params: {
				allowedValues: [
					"raw",
					"preload",
					"provided",
				],
			},
			schemaPath: "../project.json#/definitions/builder-bundles/items/properties/bundleDefinition/properties/sections/items/properties/mode/enum",
		},
		{
			dataPath: "/builder/bundles/1/bundleDefinition/sections/1/filters",
			keyword: "type",
			message: "should be array",
			params: {
				type: "array",
			},
			schemaPath: "../project.json#/definitions/builder-bundles/items/properties/bundleDefinition/properties/sections/items/properties/filters/type",
		},
		{
			dataPath: "/builder/bundles/1/bundleOptions",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "notAllowed",
			},
			schemaPath: "../project.json#/definitions/builder-bundles/items/properties/bundleOptions/additionalProperties",
		},
		{
			dataPath: "/builder/bundles/1/bundleOptions/optimize",
			keyword: "type",
			message: "should be boolean",
			params: {
				type: "boolean",
			},
			schemaPath: "../project.json#/definitions/builder-bundles/items/properties/bundleOptions/properties/optimize/type",
		},
		{
			dataPath: "/builder/bundles/1/bundleOptions/numberOfParts",
			keyword: "type",
			message: "should be number",
			params: {
				type: "number",
			},
			schemaPath: "../project.json#/definitions/builder-bundles/items/properties/bundleOptions/properties/numberOfParts/type",
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
			schemaPath: "../project.json#/definitions/framework/properties/name/enum",
		},
		{
			dataPath: "/framework/version",
			keyword: "errorMessage",
			message: "Not a valid version according to the Semantic Versioning specification (https://semver.org/)",
			params: {
				errors: [
					{
						dataPath: "/framework/version",
						keyword: "pattern",
						message:
							"should match pattern \"^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*" +
							"|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+(" +
							"[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$\"",
						params: {
							pattern: "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-]" +
							"[0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(" +
							"?:\\.[0-9a-zA-Z-]+)*))?$",
						},
						schemaPath: "../project.json#/definitions/framework/properties/version/pattern",
					}
				]
			},
			schemaPath: "../project.json#/definitions/framework/properties/version/errorMessage",
		},
		{
			dataPath: "/framework/libraries/0",
			keyword: "type",
			message: "should be object",
			params: {
				type: "object",
			},
			schemaPath: "../project.json#/definitions/framework/properties/libraries/items/type"

		},
		{
			dataPath: "/framework/libraries/1",
			keyword: "additionalProperties",
			message: "should NOT have additional properties",
			params: {
				additionalProperty: "library",
			},
			schemaPath: "../project.json#/definitions/framework/properties/libraries/items/additionalProperties",
		},
		{
			dataPath: "/framework/libraries/1",
			keyword: "required",
			message: "should have required property 'name'",
			params: {
				missingProperty: "name",
			},
			schemaPath: "../project.json#/definitions/framework/properties/libraries/items/required",
		},
		{
			dataPath: "/framework/libraries/2/optional",
			keyword: "type",
			message: "should be boolean",
			params: {
				type: "boolean"
			},

			schemaPath: "../project.json#/definitions/framework/properties/libraries/items/properties/optional/type",
		},
		{
			dataPath: "/framework/libraries/3/development",
			keyword: "type",
			message: "should be boolean",
			params: {
				type: "boolean"
			},
			schemaPath: "../project.json#/definitions/framework/properties/libraries/items/properties/development/type"
		}
	]);
});
