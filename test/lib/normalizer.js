const test = require("ava");
const sinon = require("sinon");
const normalizer = require("../..").normalizer;
const projectPreprocessor = require("../../lib/projectPreprocessor");
const ui5Framework = require("../../lib/translators/ui5Framework");

test.beforeEach((t) => {
	t.context.npmTranslatorStub = sinon.stub(require("../..").translators.npm);
	t.context.staticTranslatorStub = sinon.stub(require("../..").translators.static);
});

test.afterEach.always(() => {
	sinon.restore();
});

test.serial("Uses npm translator as default strategy", (t) => {
	normalizer.generateDependencyTree();
	t.truthy(t.context.npmTranslatorStub.generateDependencyTree.called);
});

test.serial("Uses static translator as strategy", (t) => {
	normalizer.generateDependencyTree({
		translatorName: "static"
	});
	t.truthy(t.context.staticTranslatorStub.generateDependencyTree.called);
});

test.serial("Generate project tree using with overwritten config path", async (t) => {
	sinon.stub(normalizer, "generateDependencyTree").resolves({configPath: "defaultPath/config.json"});
	const projectPreprocessorStub = sinon.stub(projectPreprocessor, "processTree").resolves(true);
	await normalizer.generateProjectTree({configPath: "newPath/config.json"});
	t.deepEqual(projectPreprocessorStub.getCall(0).args[0], {
		configPath: "newPath/config.json"
	}, "Process tree with config loaded from custom path");
});

test.serial("Pass frameworkOptions to ui5Framework translator", async (t) => {
	const options = {
		frameworkOptions: {
			versionOverride: "1.2.3"
		}
	};
	const tree = {
		metadata: {
			name: "test"
		},
		framework: {}
	};

	sinon.stub(normalizer, "generateDependencyTree").resolves({configPath: "defaultPath/config.json"});
	sinon.stub(projectPreprocessor, "processTree").resolves(tree);

	const ui5FrameworkGenerateDependencyTreeStub = sinon.stub(ui5Framework, "generateDependencyTree").resolves(null);

	await normalizer.generateProjectTree(options);

	t.is(ui5FrameworkGenerateDependencyTreeStub.callCount, 1,
		"ui5Framework.generateDependencyTree should be called once");
	t.deepEqual(ui5FrameworkGenerateDependencyTreeStub.getCall(0).args, [tree, {versionOverride: "1.2.3"}],
		"ui5Framework.generateDependencyTree should be called with expected args");
});

test.serial("Error: Throws if unknown translator should be used as strategy", async (t) => {
	const translatorName = "notExistingTranslator";
	return normalizer.generateDependencyTree({
		translatorName
	}).catch((error) => {
		t.is(error.message, `Unknown translator ${translatorName}`);
	});
});

test.serial("Parse translator options correctly (unix path)", async (t) => {
	normalizer.generateDependencyTree({
		translatorName: "static:/mypath/myfile"
	});
	const args = t.context.staticTranslatorStub.generateDependencyTree.args[0];
	t.truthy(args[1], "The translator is called correctly with arguments");
	t.is(args[1].parameters.length, 1, "The number of parameters are correct.");
	t.is(args[1].parameters[0], "/mypath/myfile", "The parameters entry is correct '/mypath/myfile'");
});

test.serial("Parse translator options correctly (windows path)", async (t) => {
	normalizer.generateDependencyTree({
		translatorName: "static:C:/mypath/myfile"
	});
	const args = t.context.staticTranslatorStub.generateDependencyTree.args[0];
	t.truthy(args[1], "The translator is called correctly with arguments");
	t.is(args[1].parameters.length, 1, "The number of parameters are correct.");
	t.is(args[1].parameters[0], "C:/mypath/myfile", "The parameters entry is correct '/mypath/myfile'");
});

test.serial("Parse translator options correctly (multiple parameters)", async (t) => {
	normalizer.generateDependencyTree({
		translatorName: "static:mypath/myfile,mypath2/myfile2"
	});
	const args = t.context.staticTranslatorStub.generateDependencyTree.args[0];
	t.truthy(args[1], "The translator is called correctly with arguments");
	t.is(args[1].parameters.length, 2, "The number of parameters are correct.");
	t.is(args[1].parameters[0], "mypath/myfile", "The parameters entry is correct '/mypath/myfile'");
	t.is(args[1].parameters[1], "mypath2/myfile2", "The parameters entry is correct '/mypath2/myfile2'");
});
