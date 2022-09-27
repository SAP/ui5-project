import test from "ava";
import {createRequire} from "node:module";

// Using CommonsJS require as importing json files causes an ExperimentalWarning
const require = createRequire(import.meta.url);

// package.json should be exported to allow reading version (e.g. from @ui5/cli)
test("export of package.json", (t) => {
	t.truthy(require("@ui5/project/package.json").version);
});

// Public API contract (exported modules)
test.skip("@ui5/project", (t) => {
	// TODO
});

[
	{
		exportedSpecifier: "@ui5/project/ui5Framework/Openui5Resolver",
		mappedModule: "../../lib/ui5Framework/Openui5Resolver.js"
	},
	{
		exportedSpecifier: "@ui5/project/ui5Framework/Sapui5Resolver",
		mappedModule: "../../lib/ui5Framework/Sapui5Resolver.js"
	},
	{
		exportedSpecifier: "@ui5/project/validation/validator",
		mappedModule: "../../lib/validation/validator.js"
	},
	{
		exportedSpecifier: "@ui5/project/validation/ValidationError",
		mappedModule: "../../lib/validation/ValidationError.js"
	},
	{
		exportedSpecifier: "@ui5/project/graph/ProjectGraph",
		mappedModule: "../../lib/graph/ProjectGraph.js"
	},
	{
		exportedSpecifier: "@ui5/project/graph/projectGraphBuilder",
		mappedModule: "../../lib/graph/projectGraphBuilder.js"
	},
].forEach(({exportedSpecifier, mappedModule}) => {
	test(`${exportedSpecifier}`, async (t) => {
		const actual = await import(exportedSpecifier);
		const expected = await import(mappedModule);
		t.is(actual, expected, "Correct module exported");
	});
});
