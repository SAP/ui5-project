const {test} = require("ava");
const sinon = require("sinon");
const normalizer = require("../..").normalizer;
const npmTranslatorStub = sinon.stub(require("../..").translators.npm);
const staticTranslatorStub = sinon.stub(require("../..").translators.static);

test("Uses npm translator as default strategy", (t) => {
	normalizer.generateDependencyTree();
	t.truthy(npmTranslatorStub.generateDependencyTree.called);
});

test("Uses static translator as strategy", (t) => {
	normalizer.generateDependencyTree({
		translator: "static"
	});
	t.truthy(staticTranslatorStub.generateDependencyTree.called);
});


test("Error: Throws if unknown translator should be used as strategy", async (t) => {
	const translator = "notExistingTranslator";
	return normalizer.generateDependencyTree({
		translator
	}).catch((error) => {
		t.is(error.message, `Unknown translator ${translator}`);
	});
});
