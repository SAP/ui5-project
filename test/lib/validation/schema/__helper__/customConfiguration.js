import SpecificationVersion from "../../../../../lib/specifications/SpecificationVersion.js";

/**
 * Common test functionality for customConfiguration section in config
 */
export default {
	/**
	 * Executes the tests for different kind of projects,
	 * e.g. "application", "component", "library", "theme-library" and "module"
	 *
	 * @param {Function} test ava test
	 * @param {Function} assertValidation assertion function
	 * @param {string} type one of "project-shim", "server-middleware" "task",
	 *  "application", "component", "library", "theme-library" and "module"
	 * @param {object} additionalConfiguration additional configuration content
	 */
	defineTests: function(test, assertValidation, type, additionalConfiguration) {
		additionalConfiguration = additionalConfiguration || {};
		if (type !== "component") { // Component type only became available with specVersion 3.1
			// version specific tests for customConfiguration
			test(`${type}: Invalid customConfiguration (specVersion 2.0)`, async (t) => {
				await assertValidation(t, Object.assign({
					"specVersion": "2.0",
					"type": type,
					"metadata": {
						"name": "my-" + type
					},
					"customConfiguration": {}
				}, additionalConfiguration), [
					{
						dataPath: "",
						keyword: "additionalProperties",
						message: "should NOT have additional properties",
						params: {
							additionalProperty: "customConfiguration",
						}
					}
				]);
			});
		}

		// Component type only became available with specVersion 3.1
		const range = type === "component" ? ">=5.0" : ">=2.1";
		SpecificationVersion.getVersionsForRange(range).forEach((specVersion) => {
			test(`${type}: Valid customConfiguration (specVersion ${specVersion})`, async (t) => {
				await assertValidation(t, Object.assign( {
					"specVersion": specVersion,
					"type": type,
					"metadata": {
						"name": "my-" + type
					},
					"customConfiguration": {
						"foo": "bar"
					}
				}, additionalConfiguration));
			});
		});
	}
};
