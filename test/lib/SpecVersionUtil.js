const test = require("ava");
const sinon = require("sinon");
const SpecVersionUtil = require("../../lib/SpecVersionUtil");

const unsupportedSpecVersionText = (specVersion) =>
	`Unsupported specification version ${specVersion} defined. Your UI5 CLI installation might be outdated. ` +
	`For details see https://sap.github.io/ui5-tooling/pages/Configuration/#specification-versions`;

test("isSupportedSpecVersion", (t) => {
	t.is(SpecVersionUtil.isSupportedSpecVersion("0.1"), true);
	t.is(SpecVersionUtil.isSupportedSpecVersion("1.0"), true);
	t.is(SpecVersionUtil.isSupportedSpecVersion("1.1"), true);
	t.is(SpecVersionUtil.isSupportedSpecVersion("2.0"), true);
	t.is(SpecVersionUtil.isSupportedSpecVersion("2.4"), true);
	t.is(SpecVersionUtil.isSupportedSpecVersion("0.2"), false);
	t.is(SpecVersionUtil.isSupportedSpecVersion("1.2"), false);
	t.is(SpecVersionUtil.isSupportedSpecVersion(1.1), false);
	t.is(SpecVersionUtil.isSupportedSpecVersion("foo"), false);
	t.is(SpecVersionUtil.isSupportedSpecVersion(""), false);
	t.is(SpecVersionUtil.isSupportedSpecVersion(), false);
});

test("major", (t) => {
	t.is(SpecVersionUtil.major("0.1"), 0);
	t.is(SpecVersionUtil.major("1.1"), 1);
	t.is(SpecVersionUtil.major("2.1"), 2);

	t.is(t.throws(() => {
		SpecVersionUtil.major("0.2");
	}).message, unsupportedSpecVersionText("0.2"));
});

test("minor", (t) => {
	t.is(SpecVersionUtil.minor("2.1"), 1);
	t.is(SpecVersionUtil.minor("2.2"), 2);
	t.is(SpecVersionUtil.minor("2.3"), 3);

	t.is(t.throws(() => {
		SpecVersionUtil.minor("1.2");
	}).message, unsupportedSpecVersionText("1.2"));
});

test("satisfies", (t) => {
	// range: 1.x
	t.is(SpecVersionUtil.satisfies("1.0", "1.x"), true);
	t.is(SpecVersionUtil.satisfies("1.1", "1.x"), true);
	t.is(SpecVersionUtil.satisfies("2.0", "1.x"), false);

	// range: ^2.2
	t.is(SpecVersionUtil.satisfies("2.1", "^2.2"), false);
	t.is(SpecVersionUtil.satisfies("2.2", "^2.2"), true);
	t.is(SpecVersionUtil.satisfies("2.3", "^2.2"), true);

	// range: > 1.0
	t.is(SpecVersionUtil.satisfies("1.0", "> 1.0"), false);
	t.is(SpecVersionUtil.satisfies("1.1", "> 1.0"), true);
	t.is(SpecVersionUtil.satisfies("2.2", "> 1.0"), true);

	// range: 2.2 - 2.4
	t.is(SpecVersionUtil.satisfies("2.1", "2.2 - 2.4"), false);
	t.is(SpecVersionUtil.satisfies("2.2", "2.2 - 2.4"), true);
	t.is(SpecVersionUtil.satisfies("2.3", "2.2 - 2.4"), true);
	t.is(SpecVersionUtil.satisfies("2.4", "2.2 - 2.4"), true);
	t.is(SpecVersionUtil.satisfies("2.5", "2.2 - 2.4"), false);

	// range: 0.1 || 1.0 - 1.1 || ^2.5
	t.is(SpecVersionUtil.satisfies("0.1", "0.1 || 1.0 - 1.1 || ^2.5"), true);
	t.is(SpecVersionUtil.satisfies("1.0", "0.1 || 1.0 - 1.1 || ^2.5"), true);
	t.is(SpecVersionUtil.satisfies("1.1", "0.1 || 1.0 - 1.1 || ^2.5"), true);
	t.is(SpecVersionUtil.satisfies("2.4", "0.1 || 1.0 - 1.1 || ^2.5"), false);
	t.is(SpecVersionUtil.satisfies("2.5", "0.1 || 1.0 - 1.1 || ^2.5"), true);
	t.is(SpecVersionUtil.satisfies("2.6", "0.1 || 1.0 - 1.1 || ^2.5"), true);

	// unsupported spec version
	t.is(t.throws(() => {
		SpecVersionUtil.satisfies("0.2", "1.x");
	}).message, unsupportedSpecVersionText("0.2"));
});

test("low level comparator", (t) => {
	t.is(SpecVersionUtil.gt("2.1", "2.2"), false);
	t.is(SpecVersionUtil.gt("2.2", "2.2"), false);
	t.is(SpecVersionUtil.gt("2.3", "2.2"), true);

	t.is(SpecVersionUtil.gte("2.1", "2.2"), false);
	t.is(SpecVersionUtil.gte("2.2", "2.2"), true);
	t.is(SpecVersionUtil.gte("2.3", "2.2"), true);

	t.is(SpecVersionUtil.lt("2.1", "2.2"), true);
	t.is(SpecVersionUtil.lt("2.2", "2.2"), false);
	t.is(SpecVersionUtil.lt("2.3", "2.2"), false);

	t.is(SpecVersionUtil.lte("2.1", "2.2"), true);
	t.is(SpecVersionUtil.lte("2.2", "2.2"), true);
	t.is(SpecVersionUtil.lte("2.3", "2.2"), false);

	t.is(SpecVersionUtil.eq("2.0", "2.2"), false);
	t.is(SpecVersionUtil.eq("2.2", "2.2"), true);

	t.is(SpecVersionUtil.neq("2.0", "2.2"), true);
	t.is(SpecVersionUtil.neq("2.2", "2.2"), false);
});

test("getSemverCompatibleVersion", (t) => {
	t.is(SpecVersionUtil._getSemverCompatibleVersion("0.1"), "0.1.0");
	t.is(SpecVersionUtil._getSemverCompatibleVersion("1.1"), "1.1.0");
	t.is(SpecVersionUtil._getSemverCompatibleVersion("2.0"), "2.0.0");

	t.is(t.throws(() => {
		SpecVersionUtil._getSemverCompatibleVersion("1.2.3");
	}).message, unsupportedSpecVersionText("1.2.3"));
	t.is(t.throws(() => {
		SpecVersionUtil._getSemverCompatibleVersion("0.99");
	}).message, unsupportedSpecVersionText("0.99"));
	t.is(t.throws(() => {
		SpecVersionUtil._getSemverCompatibleVersion("foo");
	}).message, unsupportedSpecVersionText("foo"));
	t.is(t.throws(() => {
		SpecVersionUtil._getSemverCompatibleVersion();
	}).message, unsupportedSpecVersionText("undefined"));
});

test("handleSemverComparator", (t) => {
	const comparatorStub = sinon.stub().returns("foobar");
	t.is(SpecVersionUtil._handleSemverComparator(comparatorStub, "1.1", "2.2"), "foobar");
	t.deepEqual(comparatorStub.getCall(0).args, ["1.1.0", "2.2.0"]);

	t.is(t.throws(() => {
		SpecVersionUtil._handleSemverComparator(undefined, "a.b", "2.2");
	}).message, unsupportedSpecVersionText("a.b"));

	t.is(t.throws(() => {
		SpecVersionUtil._handleSemverComparator(undefined, undefined, "a.b");
	}).message, "Invalid spec version expectation given in comparator: a.b");
});
