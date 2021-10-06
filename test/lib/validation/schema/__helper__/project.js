const framework = require("./framework");
const customConfiguration = require("./customConfiguration");

/**
 * Common test functionality to be able to run the same tests for different types of kind "project"
 */
module.exports = {
	/**
	 * Executes the tests for different types of kind project,
	 *  e.g. "application", "library", "theme-library" and "module"
	 *
	 * @param {Function} test ava test
	 * @param {Function} assertValidation assertion function
	 * @param {string} type one of "application", "library", "theme-library" and "module"
	 */
	defineTests: function(test, assertValidation, type) {
		// framework tests
		if (["application", "library", "theme-library"].includes(type)) {
			framework.defineTests(test, assertValidation, type);
		}

		// customConfiguration tests
		customConfiguration.defineTests(test, assertValidation, type);

		// version specific tests
		["2.5", "2.4", "2.3", "2.2", "2.1", "2.0"].forEach((specVersion) => {
			// tests for all kinds and version 2.0 and above
			test(`${type} (specVersion ${specVersion}): No metadata`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type
				}, [{
					instancePath: "",
					keyword: "required",
					message: "must have required property 'metadata'",
					params: {
						missingProperty: "metadata",
					}
				}]);
			});

			test(`${type} (specVersion ${specVersion}): Metadata not type object`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type,
					"metadata": "foo"
				}, [{
					instancePath: "/metadata",
					keyword: "type",
					message: "must be object",
					params: {
						type: "object",
					}
				}]);
			});

			test(`${type} (specVersion ${specVersion}): No metadata.name`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type,
					"metadata": {}
				}, [{
					instancePath: "/metadata",
					keyword: "required",
					message: "must have required property 'name'",
					params: {
						missingProperty: "name",
					}
				}]);
			});

			test(`${type} (specVersion ${specVersion}): Invalid metadata.name`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": {}
					}
				}, [
					{
						instancePath: "/metadata/name",
						keyword: "type",
						message: "must be string",
						params: {
							type: "string"
						}
					}
				]);
			});

			test(`${type} (specVersion ${specVersion}): Invalid metadata.copyright`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "foo",
						"copyright": 123
					}
				}, [
					{
						instancePath: "/metadata/copyright",
						keyword: "type",
						message: "must be string",
						params: {
							type: "string"
						}
					}
				]);
			});

			test(`${type} (specVersion ${specVersion}): Additional metadata property`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "foo",
						"copyrihgt": "typo"
					}
				}, [
					{
						instancePath: "/metadata",
						keyword: "additionalProperties",
						message: "must NOT have additional properties",
						params: {
							additionalProperty: "copyrihgt"
						}
					}
				]);
			});

			test(`${type} (specVersion ${specVersion}): metadata.deprecated: true`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type,
						"deprecated": true
					}
				});
			});

			test(`${type} (specVersion ${specVersion}): metadata.deprecated: false`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type,
						"deprecated": false
					}
				});
			});

			test(`${type} (specVersion ${specVersion}): Invalid metadata.deprecated`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type,
						"deprecated": "Yes"
					}
				}, [
					{
						instancePath: "/metadata/deprecated",
						keyword: "type",
						message: "must be boolean",
						params: {
							type: "boolean",
						}
					}
				]);
			});

			test(`${type} (specVersion ${specVersion}): metadata.sapInternal: true`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type,
						"sapInternal": true
					}
				});
			});

			test(`${type} (specVersion ${specVersion}): metadata.sapInternal: false`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type,
						"sapInternal": false
					}
				});
			});

			test(`${type} (specVersion ${specVersion}): Invalid metadata.sapInternal`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type,
						"sapInternal": "Yes"
					}
				}, [
					{
						instancePath: "/metadata/sapInternal",
						keyword: "type",
						message: "must be boolean",
						params: {
							type: "boolean",
						}
					}
				]);
			});

			test(`${type} (specVersion ${specVersion}): metadata.allowSapInternal: true`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type,
						"allowSapInternal": true
					}
				});
			});

			test(`${type} (specVersion ${specVersion}): metadata.allowSapInternal: false`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type,
						"allowSapInternal": false
					}
				});
			});

			test(`${type} (specVersion ${specVersion}): Invalid metadata.allowSapInternal`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type,
						"allowSapInternal": "Yes"
					}
				}, [
					{
						instancePath: "/metadata/allowSapInternal",
						keyword: "type",
						message: "must be boolean",
						params: {
							type: "boolean",
						}
					}
				]);
			});

			test(`${type} (specVersion ${specVersion}) Invalid configuration: Additional property`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type
					},
					"notAllowed": true
				}, [{
					instancePath: "",
					keyword: "additionalProperties",
					message: "must NOT have additional properties",
					params: {
						additionalProperty: "notAllowed",
					},
				}]);
			});
		});
	}
};
