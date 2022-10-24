import customConfiguration from "./customConfiguration.js";

/**
 * Common test functionality to be able to run the same tests for different types of kind "extension"
 */
export default {
	/**
	 * Executes the tests for different types of kind extension, e.g. "project-shim", "server-middleware" and "task"
	 *
	 * @param {Function} test ava test
	 * @param {Function} assertValidation assertion function
	 * @param {string} type one of "project-shim", "server-middleware" and "task"
	 * @param {object} additionalConfiguration additional configuration content
	 */
	defineTests: function(test, assertValidation, type, additionalConfiguration) {
		additionalConfiguration = additionalConfiguration || {};
		additionalConfiguration = Object.assign({"kind": "extension"}, additionalConfiguration);

		customConfiguration.defineTests(test, assertValidation, type, additionalConfiguration);

		["2.6", "2.5", "2.4", "2.3", "2.2", "2.1", "2.0"].forEach((specVersion) => {
			test(`kind: extension / type: ${type} basic (${specVersion})`, async (t) => {
				await assertValidation(t, Object.assign({
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type
					}
				}, additionalConfiguration));
			});

			test(`kind: extension / type: ${type} additionalProperties (${specVersion})`, async (t) => {
				await assertValidation(t, Object.assign({
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type
					},
					"resources": {}
				}, additionalConfiguration), [{
					dataPath: "",
					keyword: "additionalProperties",
					message: "should NOT have additional properties",
					params: {
						"additionalProperty": "resources"
					}
				}]);
			});

			test(`kind: extension / type: ${type} Invalid configuration: Additional property (${specVersion})`,
				async (t) => {
					await assertValidation(t, Object.assign( {
						"specVersion": specVersion,
						"type": type,
						"metadata": {
							"name": "my-" + type
						},
						"notAllowed": true
					}, additionalConfiguration), [{
						dataPath: "",
						keyword: "additionalProperties",
						message: "should NOT have additional properties",
						params: {
							additionalProperty: "notAllowed",
						}
					}]);
				});
		});
	}
};
