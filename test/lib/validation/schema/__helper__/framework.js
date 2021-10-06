/**
 * Common test functionality for framework section in config
 */
module.exports = {
	/**
	 * Executes the tests for different types of kind project, e.g. "application", "library" and "theme-library"
	 *
	 * @param {Function} test ava test
	 * @param {Function} assertValidation assertion function
	 * @param {string} type one of "application", "library" and "theme-library"
	 */
	defineTests: function(test, assertValidation, type) {
		["2.5", "2.4", "2.3", "2.2", "2.1", "2.0"].forEach((specVersion) => {
			test(`${type} (specVersion ${specVersion}): framework configuration: OpenUI5`, async (t) => {
				const config = {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type
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
				};
				await assertValidation(t, config);
			});

			test(`${type} (specVersion ${specVersion}): framework configuration: SAPUI5`, async (t) => {
				const config = {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type
					},
					"framework": {
						"name": "SAPUI5",
						"version": "1.75.0",
						"libraries": [
							{"name": "sap.ui.core"},
							{"name": "sap.m"},
							{"name": "sap.f", "optional": true},
							{"name": "sap.ui.support", "development": true},
							{"name": "sap.ui.comp", "development": true, "optional": false},
							{"name": "sap.fe", "development": false, "optional": true},
							{
								"name": "sap.ui.export",
								"development": false,
								"optional": false
							}
						]
					}
				};
				await assertValidation(t, config);
			});

			test(`${type} (specVersion ${specVersion}): framework configuration: Invalid`, async (t) => {
				const config = {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type
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
				};

				await assertValidation(t, config, [
					{
						instancePath: "/framework/name",
						keyword: "enum",
						message: "must be equal to one of the allowed values",
						params: {
							allowedValues: [
								"OpenUI5",
								"SAPUI5",
							],
						}
					},
					{
						instancePath: "/framework/version",
						keyword: "errorMessage",
						message: "Not a valid version according to the Semantic Versioning specification (https://semver.org/)",
						params: {
							errors: [
								{
									emUsed: true,
									instancePath: "/framework/version",
									keyword: "pattern",
									message:
										"must match pattern \"^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)" +
										"(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*" +
										"[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$\"",
									params: {
										pattern:
											"^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*" +
											"[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-]" +
											"[0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$",
									}
								}
							]
						}
					},
					{
						instancePath: "/framework/libraries/0",
						keyword: "type",
						message: "must be object",
						params: {
							type: "object",
						}
					},
					{
						instancePath: "/framework/libraries/1",
						keyword: "required",
						message: "must have required property 'name'",
						params: {
							missingProperty: "name",
						}
					},
					{
						instancePath: "/framework/libraries/1",
						keyword: "additionalProperties",
						message: "must NOT have additional properties",
						params: {
							additionalProperty: "library",
						}
					},
					{
						instancePath: "/framework/libraries/2/optional",
						keyword: "type",
						message: "must be boolean",
						params: {
							type: "boolean"
						}
					},
					{
						instancePath: "/framework/libraries/3/development",
						keyword: "type",
						message: "must be boolean",
						params: {
							type: "boolean"
						}
					}
				]);
			});

			test(`${type} (specVersion ${specVersion}): framework configuration: Missing 'name'`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type
					},
					"framework": {}
				}, [
					{
						instancePath: "/framework",
						keyword: "required",
						message: "must have required property 'name'",
						params: {
							missingProperty: "name"
						}
					}
				]);
			});

			test(
				`${type} (specVersion ${specVersion}): framework configuration: library with optional and development`,
				async (t) => {
					await assertValidation(t, {
						"specVersion": specVersion,
						"type": type,
						"metadata": {
							"name": "my-" + type
						},
						"framework": {
							"name": "OpenUI5",
							"libraries": [
								{
									name: "sap.ui.lib1",
									development: true,
									optional: true
								},
								{
									// This should only complain about wrong types, not that both are true
									name: "sap.ui.lib2",
									development: "true",
									optional: "true"
								}
							]
						}
					}, [
						{
							instancePath: "/framework/libraries/0",
							keyword: "errorMessage",
							message: "Either \"development\" or \"optional\" can be true, but not both",
							params: {
								errors: [
									{
										emUsed: true,
										instancePath: "/framework/libraries/0",
										keyword: "additionalProperties",
										message: "must NOT have additional properties",
										params: {
											additionalProperty: "development",
										}
									},
									{
										emUsed: true,
										instancePath: "/framework/libraries/0",
										keyword: "additionalProperties",
										message: "must NOT have additional properties",
										params: {
											additionalProperty: "optional",
										}
									},
								],
							}
						},
						{
							instancePath: "/framework/libraries/1/optional",
							keyword: "type",
							message: "must be boolean",
							params: {
								type: "boolean",
							}
						},
						{
							instancePath: "/framework/libraries/1/development",
							keyword: "type",
							message: "must be boolean",
							params: {
								type: "boolean",
							}
						},
					]);
				});
		});
	}
};
