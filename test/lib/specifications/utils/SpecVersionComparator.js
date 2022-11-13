import test from "ava";
import sinonGlobal from "sinon";
import SpecVersionComparator from "../../../../lib/specifications/utils/SpecVersionComparator.js";
import {__localFunctions__} from "../../../../lib/specifications/utils/SpecVersionComparator.js";

const unsupportedSpecVersionText = (specVersion) =>
	`Unsupported specification version ${specVersion} defined. Your UI5 CLI installation might be outdated. ` +
	`For details see https://sap.github.io/ui5-tooling/pages/Configuration/#specification-versions`;

test.beforeEach((t) => {
	t.context.sinon = sinonGlobal.createSandbox();
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
});

test.serial("Invalid specVersion", (t) => {
	const {sinon} = t.context;
	const isSupportedSpecVersionStub =
		sinon.stub(SpecVersionComparator, "isSupportedSpecVersion").returns(false);

	t.throws(() => {
		new SpecVersionComparator("2.5");
	}, {
		message: unsupportedSpecVersionText("2.5")
	}, "Threw with expected error message");

	t.is(isSupportedSpecVersionStub.callCount, 1, "Static isSupportedSpecVersionStub has been called once");
	t.deepEqual(isSupportedSpecVersionStub.getCall(0).args, ["2.5"],
		"Static isSupportedSpecVersionStub has been called with expected arguments");
});


function testCallThroughToStatic(functionName, arg) {
	test.serial(functionName, (t) => {
		const {sinon} = t.context;
		const staticFunctionStub =
			sinon.stub(SpecVersionComparator, functionName).returns("return value");

		const specVersionComparator = new SpecVersionComparator("2.5");
		const res = specVersionComparator[functionName](arg);
		t.is(staticFunctionStub.callCount, 1, `Static #${functionName} has been called once`);
		const expectedArgs = ["2.5"];
		if (arg) {
			expectedArgs.push(arg);
		}
		t.deepEqual(staticFunctionStub.getCall(0).args, expectedArgs,
			`Static #${functionName} has been called with expected arguments`);
		t.is(res, "return value", "Returned value of static function");
	});
}

testCallThroughToStatic("major");
testCallThroughToStatic("minor");
testCallThroughToStatic("satisfies");
testCallThroughToStatic("gt", "5.2");
testCallThroughToStatic("gte", "5.2");
testCallThroughToStatic("lt", "5.2");
testCallThroughToStatic("lte", "5.2");
testCallThroughToStatic("eq", "5.2");
testCallThroughToStatic("neq", "5.2");

test("(static) isSupportedSpecVersion", (t) => {
	t.is(SpecVersionComparator.isSupportedSpecVersion("0.1"), true);
	t.is(SpecVersionComparator.isSupportedSpecVersion("1.0"), true);
	t.is(SpecVersionComparator.isSupportedSpecVersion("1.1"), true);
	t.is(SpecVersionComparator.isSupportedSpecVersion("2.0"), true);
	t.is(SpecVersionComparator.isSupportedSpecVersion("2.4"), true);
	t.is(SpecVersionComparator.isSupportedSpecVersion("0.2"), false);
	t.is(SpecVersionComparator.isSupportedSpecVersion("1.2"), false);
	t.is(SpecVersionComparator.isSupportedSpecVersion(1.1), false);
	t.is(SpecVersionComparator.isSupportedSpecVersion("foo"), false);
	t.is(SpecVersionComparator.isSupportedSpecVersion(""), false);
	t.is(SpecVersionComparator.isSupportedSpecVersion(), false);
});

test("(static) major", (t) => {
	t.is(SpecVersionComparator.major("0.1"), 0);
	t.is(SpecVersionComparator.major("1.1"), 1);
	t.is(SpecVersionComparator.major("2.1"), 2);

	t.is(t.throws(() => {
		SpecVersionComparator.major("0.2");
	}).message, unsupportedSpecVersionText("0.2"));
});

test("(static) minor", (t) => {
	t.is(SpecVersionComparator.minor("2.1"), 1);
	t.is(SpecVersionComparator.minor("2.2"), 2);
	t.is(SpecVersionComparator.minor("2.3"), 3);

	t.is(t.throws(() => {
		SpecVersionComparator.minor("1.2");
	}).message, unsupportedSpecVersionText("1.2"));
});

test("(static) satisfies", (t) => {
	// range: 1.x
	t.is(SpecVersionComparator.satisfies("1.0", "1.x"), true);
	t.is(SpecVersionComparator.satisfies("1.1", "1.x"), true);
	t.is(SpecVersionComparator.satisfies("2.0", "1.x"), false);

	// range: ^2.2
	t.is(SpecVersionComparator.satisfies("2.1", "^2.2"), false);
	t.is(SpecVersionComparator.satisfies("2.2", "^2.2"), true);
	t.is(SpecVersionComparator.satisfies("2.3", "^2.2"), true);

	// range: > 1.0
	t.is(SpecVersionComparator.satisfies("1.0", "> 1.0"), false);
	t.is(SpecVersionComparator.satisfies("1.1", "> 1.0"), true);
	t.is(SpecVersionComparator.satisfies("2.2", "> 1.0"), true);

	// range: 2.2 - 2.4
	t.is(SpecVersionComparator.satisfies("2.1", "2.2 - 2.4"), false);
	t.is(SpecVersionComparator.satisfies("2.2", "2.2 - 2.4"), true);
	t.is(SpecVersionComparator.satisfies("2.3", "2.2 - 2.4"), true);
	t.is(SpecVersionComparator.satisfies("2.4", "2.2 - 2.4"), true);
	t.is(SpecVersionComparator.satisfies("2.5", "2.2 - 2.4"), false);

	// range: 0.1 || 1.0 - 1.1 || ^2.5
	t.is(SpecVersionComparator.satisfies("0.1", "0.1 || 1.0 - 1.1 || ^2.5"), true);
	t.is(SpecVersionComparator.satisfies("1.0", "0.1 || 1.0 - 1.1 || ^2.5"), true);
	t.is(SpecVersionComparator.satisfies("1.1", "0.1 || 1.0 - 1.1 || ^2.5"), true);
	t.is(SpecVersionComparator.satisfies("2.4", "0.1 || 1.0 - 1.1 || ^2.5"), false);
	t.is(SpecVersionComparator.satisfies("2.5", "0.1 || 1.0 - 1.1 || ^2.5"), true);
	t.is(SpecVersionComparator.satisfies("2.6", "0.1 || 1.0 - 1.1 || ^2.5"), true);

	// unsupported spec version
	t.is(t.throws(() => {
		SpecVersionComparator.satisfies("0.2", "1.x");
	}).message, unsupportedSpecVersionText("0.2"));
});

test("(static) low level comparator", (t) => {
	t.is(SpecVersionComparator.gt("2.1", "2.2"), false);
	t.is(SpecVersionComparator.gt("2.2", "2.2"), false);
	t.is(SpecVersionComparator.gt("2.3", "2.2"), true);

	t.is(SpecVersionComparator.gte("2.1", "2.2"), false);
	t.is(SpecVersionComparator.gte("2.2", "2.2"), true);
	t.is(SpecVersionComparator.gte("2.3", "2.2"), true);

	t.is(SpecVersionComparator.lt("2.1", "2.2"), true);
	t.is(SpecVersionComparator.lt("2.2", "2.2"), false);
	t.is(SpecVersionComparator.lt("2.3", "2.2"), false);

	t.is(SpecVersionComparator.lte("2.1", "2.2"), true);
	t.is(SpecVersionComparator.lte("2.2", "2.2"), true);
	t.is(SpecVersionComparator.lte("2.3", "2.2"), false);

	t.is(SpecVersionComparator.eq("2.0", "2.2"), false);
	t.is(SpecVersionComparator.eq("2.2", "2.2"), true);

	t.is(SpecVersionComparator.neq("2.0", "2.2"), true);
	t.is(SpecVersionComparator.neq("2.2", "2.2"), false);
});

test("(static) getSemverCompatibleVersion", (t) => {
	t.is(__localFunctions__.getSemverCompatibleVersion("0.1"), "0.1.0");
	t.is(__localFunctions__.getSemverCompatibleVersion("1.1"), "1.1.0");
	t.is(__localFunctions__.getSemverCompatibleVersion("2.0"), "2.0.0");

	t.is(t.throws(() => {
		__localFunctions__.getSemverCompatibleVersion("1.2.3");
	}).message, unsupportedSpecVersionText("1.2.3"));
	t.is(t.throws(() => {
		__localFunctions__.getSemverCompatibleVersion("0.99");
	}).message, unsupportedSpecVersionText("0.99"));
	t.is(t.throws(() => {
		__localFunctions__.getSemverCompatibleVersion("foo");
	}).message, unsupportedSpecVersionText("foo"));
	t.is(t.throws(() => {
		__localFunctions__.getSemverCompatibleVersion();
	}).message, unsupportedSpecVersionText("undefined"));
});

test("(static) handleSemverComparator", (t) => {
	const comparatorStub = t.context.sinon.stub().returns("foobar");
	t.is(__localFunctions__.handleSemverComparator(comparatorStub, "1.1", "2.2"), "foobar");
	t.deepEqual(comparatorStub.getCall(0).args, ["1.1.0", "2.2.0"]);

	t.is(t.throws(() => {
		__localFunctions__.handleSemverComparator(undefined, "a.b", "2.2");
	}).message, unsupportedSpecVersionText("a.b"));

	t.is(t.throws(() => {
		__localFunctions__.handleSemverComparator(undefined, undefined, "a.b");
	}).message, "Invalid spec version expectation given in comparator: a.b");
});
