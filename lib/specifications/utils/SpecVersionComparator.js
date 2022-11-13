import semver from "semver";

const SPEC_VERSION_PATTERN = /^\d+\.\d+$/;
const SUPPORTED_VERSIONS = [
	"0.1", "1.0", "1.1",
	"2.0", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6",
	"3.0"
];

class SpecVersionComparator {
	constructor(specVersion) {
		this._specVersion = specVersion;

		if (!SpecVersionComparator.isSupportedSpecVersion(specVersion)) {
			throw new Error(getUnsupportedSpecVersionMessage(specVersion));
		}
	}

	major() {
		return SpecVersionComparator.major(this._specVersion);
	}

	minor() {
		return SpecVersionComparator.minor(this._specVersion);
	}

	satisfies(range) {
		return SpecVersionComparator.satisfies(this._specVersion);
	}

	// Test whether project's specVersion is greater than testVersion
	gt(testVersion) {
		return SpecVersionComparator.gt(this._specVersion, testVersion);
	}

	gte(testVersion) {
		return SpecVersionComparator.gte(this._specVersion, testVersion);
	}

	lt(testVersion) {
		return SpecVersionComparator.lt(this._specVersion, testVersion);
	}

	lte(testVersion) {
		return SpecVersionComparator.lte(this._specVersion, testVersion);
	}

	eq(testVersion) {
		return SpecVersionComparator.eq(this._specVersion, testVersion);
	}

	neq(testVersion) {
		return SpecVersionComparator.neq(this._specVersion, testVersion);
	}

	static isSupportedSpecVersion(specVersion) {
		return SUPPORTED_VERSIONS.includes(specVersion);
	}

	static major(specVersion) {
		const version = getSemverCompatibleVersion(specVersion);
		return semver.major(version);
	}
	static minor(specVersion) {
		const version = getSemverCompatibleVersion(specVersion);
		return semver.minor(version);
	}
	static satisfies(specVersion, range) {
		const version = getSemverCompatibleVersion(specVersion);
		return semver.satisfies(version, range);
	}
	static gt(specVersion, expectedVersion) {
		return handleSemverComparator(semver.gt, specVersion, expectedVersion);
	}
	static gte(specVersion, expectedVersion) {
		return handleSemverComparator(semver.gte, specVersion, expectedVersion);
	}
	static lt(specVersion, expectedVersion) {
		return handleSemverComparator(semver.lt, specVersion, expectedVersion);
	}
	static lte(specVersion, expectedVersion) {
		return handleSemverComparator(semver.lte, specVersion, expectedVersion);
	}
	static eq(specVersion, expectedVersion) {
		return handleSemverComparator(semver.eq, specVersion, expectedVersion);
	}
	static neq(specVersion, expectedVersion) {
		return handleSemverComparator(semver.neq, specVersion, expectedVersion);
	}
}

function getUnsupportedSpecVersionMessage(specVersion) {
	return `Unsupported specification version ${specVersion} defined. Your UI5 CLI installation might be outdated. ` +
		`For details see https://sap.github.io/ui5-tooling/pages/Configuration/#specification-versions`;
}

function getSemverCompatibleVersion(specVersion) {
	if (SpecVersionComparator.isSupportedSpecVersion(specVersion)) {
		return specVersion + ".0";
	}
	throw new Error(getUnsupportedSpecVersionMessage(specVersion));
}

function handleSemverComparator(comparator, specVersion, expectedVersion) {
	if (SPEC_VERSION_PATTERN.test(expectedVersion)) {
		const a = getSemverCompatibleVersion(specVersion);
		const b = expectedVersion + ".0";
		return comparator(a, b);
	}
	throw new Error("Invalid spec version expectation given in comparator: " + expectedVersion);
}

export default SpecVersionComparator;

// Export local function for testing only
export const __localFunctions__ = (process.env.NODE_ENV === "test") ?
	{getSemverCompatibleVersion, handleSemverComparator} : /* istanbul ignore next */ undefined;
