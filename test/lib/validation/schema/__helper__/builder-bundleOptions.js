import SpecificationVersion from "../../../../../lib/specifications/SpecificationVersion.js";

/**
 * Common test functionality for builder/bundles/bundleOptions section in config
 */
export default {
	/**
	 * Executes the tests for different kind of projects, e.g. "application", "component", "library"
	 *
	 * @param {Function} test ava test
	 * @param {Function} assertValidation assertion function
	 * @param {string} type one of "application", "component" and "library"
	 */
	defineTests: function(test, assertValidation, type) {
		// Version specific tests (component type only became available with specVersion 3.1)
		const range = type === "component" ? ">=3.1" : ">=3.0";
		SpecificationVersion.getVersionsForRange(range).forEach(function(specVersion) {
			test(`${type} (specVersion ${specVersion}): builder/bundles/bundleOptions`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"kind": "project",
					"type": type,
					"metadata": {
						"name": "com.sap.ui5.test",
						"copyright": "yes"
					},
					"builder": {
						"bundles": [{
							"bundleOptions": {
								"optimize": false,
								"decorateBootstrapModule": false,
								"addTryCatchRestartWrapper": true,
								"usePredefineCalls": true,
								"numberOfParts": 8,
								"sourceMap": false
							}
						}]
					}
				});
			});

			test(`${type} (specVersion ${specVersion}): builder/bundles/bundleOptions properties removal`,
				async (t) => {
					await assertValidation(t, {
						"specVersion": specVersion,
						"kind": "project",
						"type": type,
						"metadata": {
							"name": "com.sap.ui5.test",
							"copyright": "yes"
						},
						"builder": {
							"bundles": [{
								"bundleOptions": {
									"debugMode": true
								}
							}]
						}
					}, [
						{
							keyword: "additionalProperties",
							dataPath: "/builder/bundles/0/bundleOptions",
							params: {
								additionalProperty: "debugMode",
							},
							message: "should NOT have additional properties",
						},
					]);
				});

			test(`${type} invalid (specVersion ${specVersion}): builder/bundles/bundleOptions config`, async (t) => {
				await assertValidation(t, {
					"specVersion": specVersion,
					"kind": "project",
					"type": type,
					"metadata": {
						"name": "com.sap.ui5.test",
						"copyright": "yes"
					},
					"builder": {
						"bundles": [{
							"bundleOptions": {
								"optimize": "invalid value",
								"decorateBootstrapModule": {"invalid": "value"},
								"addTryCatchRestartWrapper": ["invalid value"],
								"usePredefineCalls": 12,
								"numberOfParts": true,
								"sourceMap": 55
							}
						}]
					}
				}, [
					{
						keyword: "type",
						dataPath: "/builder/bundles/0/bundleOptions/optimize",
						params: {
							type: "boolean",
						},
						message: "should be boolean"
					},
					{
						keyword: "type",
						dataPath:
							"/builder/bundles/0/bundleOptions/decorateBootstrapModule",
						params: {
							type: "boolean",
						},
						message: "should be boolean"
					},
					{
						keyword: "type",
						dataPath:
							"/builder/bundles/0/bundleOptions/addTryCatchRestartWrapper",
						params: {
							type: "boolean",
						},
						message: "should be boolean"
					},
					{
						keyword: "type",
						dataPath:
							"/builder/bundles/0/bundleOptions/usePredefineCalls",
						params: {
							type: "boolean",
						},
						message: "should be boolean"
					},
					{
						keyword: "type",
						dataPath:
							"/builder/bundles/0/bundleOptions/numberOfParts",
						params: {
							type: "number",
						},
						message: "should be number"
					},
					{
						keyword: "type",
						dataPath: "/builder/bundles/0/bundleOptions/sourceMap",
						params: {
							type: "boolean",
						},
						message: "should be boolean"
					}
				]);
			});
		});
	}
};
