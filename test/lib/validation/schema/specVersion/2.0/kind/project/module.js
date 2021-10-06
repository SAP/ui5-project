const test = require("ava");
const AjvCoverage = require("../../../../../../../utils/AjvCoverage");
const {_Validator: Validator} = require("../../../../../../../../lib/validation/validator");
const ValidationError = require("../../../../../../../../lib/validation/ValidationError");
const project = require("../../../../__helper__/project");

async function assertValidation(t, config, expectedErrors = undefined) {
	const validation = t.context.validator.validate({config, project: {id: "my-project"}});
	if (expectedErrors) {
		const validationError = await t.throwsAsync(validation, {
			instanceOf: ValidationError,
			name: "ValidationError"
		});
		validationError.errors.forEach((error) => {
			delete error.schemaPath;
		});
		t.deepEqual(validationError.errors, expectedErrors);
	} else {
		await t.notThrowsAsync(validation);
	}
}

test.before((t) => {
	t.context.validator = new Validator();
	t.context.ajvCoverage = new AjvCoverage(t.context.validator.ajv, {
		includes: ["schema/specVersion/2.0/kind/project/module.json"]
	});
});

test.after.always((t) => {
	t.context.ajvCoverage.createReport("html", {dir: "coverage/ajv-project-module"});
	const thresholds = {
		statements: 75,
		branches: 65,
		functions: 100,
		lines: 75
	};
	t.context.ajvCoverage.verify(thresholds);
});

["2.5", "2.4", "2.3", "2.2", "2.1", "2.0"].forEach((specVersion) => {
	test(`Valid configuration (specVersion ${specVersion})`, async (t) => {
		await assertValidation(t, {
			"specVersion": specVersion,
			"kind": "project",
			"type": "module",
			"metadata": {
				"name": "my-module"
			},
			"resources": {
				"configuration": {
					"paths": {
						"/resources/my/library/module-xy/": "lib",
						"/resources/my/library/module-xy-min/": "dist"
					}
				}
			}
		});
	});

	test(`No framework configuration (specVersion ${specVersion})`, async (t) => {
		await assertValidation(t, {
			"specVersion": specVersion,
			"type": "module",
			"metadata": {
				"name": "my-module"
			},
			"framework": {}
		}, [{
			instancePath: "",
			keyword: "additionalProperties",
			message: "must NOT have additional properties",
			params: {
				"additionalProperty": "framework"
			}
		}]);
	});

	test(`No propertiesFileSourceEncoding configuration (specVersion ${specVersion})`, async (t) => {
		await assertValidation(t, {
			"specVersion": specVersion,
			"type": "module",
			"metadata": {
				"name": "my-module"
			},
			"resources": {
				"configuration": {
					"propertiesFileSourceEncoding": "UTF-8"
				}
			}
		}, [{
			instancePath: "/resources/configuration",
			keyword: "additionalProperties",
			message: "must NOT have additional properties",
			params: {
				"additionalProperty": "propertiesFileSourceEncoding"
			}
		}]);
	});
});

["2.4", "2.3", "2.2", "2.1", "2.0"].forEach((specVersion) => {
	test(`No server configuration (specVersion ${specVersion})`, async (t) => {
		await assertValidation(t, {
			"specVersion": specVersion,
			"type": "module",
			"metadata": {
				"name": "my-module"
			},
			"server": {}
		}, [{
			instancePath: "",
			keyword: "additionalProperties",
			message: "must NOT have additional properties",
			params: {
				"additionalProperty": "server"
			}
		}]);
	});

	test(`No builder configuration (specVersion ${specVersion})`, async (t) => {
		await assertValidation(t, {
			"specVersion": specVersion,
			"type": "module",
			"metadata": {
				"name": "my-module"
			},
			"builder": {}
		}, [{
			instancePath: "",
			keyword: "additionalProperties",
			message: "must NOT have additional properties",
			params: {
				"additionalProperty": "builder"
			}
		}]);
	});
});

["2.5"].forEach(function(specVersion) {
	test(`Server configuration (specVersion ${specVersion})`, async (t) => {
		await assertValidation(t, {
			"specVersion": specVersion,
			"type": "module",
			"metadata": {
				"name": "my-module"
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
	});

	test(`module (specVersion ${specVersion}): builder/settings/includeDependency*`, async (t) => {
		await assertValidation(t, {
			"specVersion": specVersion,
			"kind": "project",
			"type": "module",
			"metadata": {
				"name": "my-module"
			},
			"builder": {
				"settings": {
					"includeDependency": [
						"sap.a",
						"sap.b"
					],
					"includeDependencyRegExp": [
						".ui.[a-z]+",
						"^sap.[mf]$"
					],
					"includeDependencyTree": [
						"sap.c",
						"sap.d"
					]
				}
			}
		});
	});

	test(`Invalid builder/settings/includeDependency* configuration (specVersion ${specVersion})`, async (t) => {
		await assertValidation(t, {
			"specVersion": specVersion,
			"type": "module",
			"metadata": {
				"name": "my-module"
			},
			"builder": {
				"settings": {
					"includeDependency": "a",
					"includeDependencyRegExp": "b",
					"includeDependencyTree": "c"
				}
			}
		}, [
			{
				instancePath: "/builder/settings/includeDependency",
				keyword: "type",
				message: "must be array",
				params: {
					type: "array",
				},
			},
			{
				instancePath: "/builder/settings/includeDependencyRegExp",
				keyword: "type",
				message: "must be array",
				params: {
					type: "array",
				},
			},
			{
				instancePath: "/builder/settings/includeDependencyTree",
				keyword: "type",
				message: "must be array",
				params: {
					type: "array",
				},
			},
		]);
		await assertValidation(t, {
			"specVersion": specVersion,
			"type": "module",
			"metadata": {
				"name": "my-module"
			},
			"builder": {
				"settings": {
					"includeDependency": [
						true,
						1,
						{}
					],
					"includeDependencyRegExp": [
						true,
						1,
						{}
					],
					"includeDependencyTree": [
						true,
						1,
						{}
					],
					"notAllowed": true
				}
			}
		}, [
			{
				instancePath: "/builder/settings",
				keyword: "additionalProperties",
				message: "must NOT have additional properties",
				params: {
					additionalProperty: "notAllowed",
				},
			},
			{
				instancePath: "/builder/settings/includeDependency/0",
				keyword: "type",
				message: "must be string",
				params: {
					type: "string",
				},
			},
			{
				instancePath: "/builder/settings/includeDependency/1",
				keyword: "type",
				message: "must be string",
				params: {
					type: "string",
				},
			},
			{
				instancePath: "/builder/settings/includeDependency/2",
				keyword: "type",
				message: "must be string",
				params: {
					type: "string",
				},
			},
			{
				instancePath: "/builder/settings/includeDependencyRegExp/0",
				keyword: "type",
				message: "must be string",
				params: {
					type: "string",
				},
			},
			{
				instancePath: "/builder/settings/includeDependencyRegExp/1",
				keyword: "type",
				message: "must be string",
				params: {
					type: "string",
				},
			},
			{
				instancePath: "/builder/settings/includeDependencyRegExp/2",
				keyword: "type",
				message: "must be string",
				params: {
					type: "string",
				},
			},
			{
				instancePath: "/builder/settings/includeDependencyTree/0",
				keyword: "type",
				message: "must be string",
				params: {
					type: "string",
				},
			},
			{
				instancePath: "/builder/settings/includeDependencyTree/1",
				keyword: "type",
				message: "must be string",
				params: {
					type: "string",
				},
			},
			{
				instancePath: "/builder/settings/includeDependencyTree/2",
				keyword: "type",
				message: "must be string",
				params: {
					type: "string",
				},
			},
		]);
	});
});

project.defineTests(test, assertValidation, "module");
