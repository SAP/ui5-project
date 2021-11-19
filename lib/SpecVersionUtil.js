const semver = require("semver");

const SPEC_VERSION_PATTERN = /^\d+\.\d+$/;
const SUPPORTED_VERSIONS = [
	"0.1", "1.0", "1.1",
	"2.0", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6"
];

function isSupportedSpecVersion(specVersion) {
	return SUPPORTED_VERSIONS.includes(specVersion);
}

function getSemverCompatibleVersion(specVersion) {
	if (isSupportedSpecVersion(specVersion)) {
		return specVersion + ".0";
	}
	// TODO 3.0: sync error text with error of projectPreprocessor.js
	throw new Error(
		`Unsupported specification version ${specVersion} defined. Your UI5 CLI installation might be outdated. ` +
		`For details see https://sap.github.io/ui5-tooling/pages/Configuration/#specification-versions`);
}

function major(specVersion) {
	const version = getSemverCompatibleVersion(specVersion);
	return semver.major(version);
}

function minor(specVersion) {
	const version = getSemverCompatibleVersion(specVersion);
	return semver.minor(version);
}

function satisfies(specVersion, range) {
	const version = getSemverCompatibleVersion(specVersion);
	return semver.satisfies(version, range);
}

function handleSemverComparator(comparator, specVersion, expectedVersion) {
	if (SPEC_VERSION_PATTERN.test(expectedVersion)) {
		const a = getSemverCompatibleVersion(specVersion);
		const b = expectedVersion + ".0";
		return comparator(a, b);
	}
	throw new Error("Invalid spec version expectation given in comparator: " + expectedVersion);
}
const gt = (specVersion, expectedVersion) => handleSemverComparator(semver.gt, specVersion, expectedVersion);
const gte = (specVersion, expectedVersion) => handleSemverComparator(semver.gte, specVersion, expectedVersion);
const lt = (specVersion, expectedVersion) => handleSemverComparator(semver.lt, specVersion, expectedVersion);
const lte = (specVersion, expectedVersion) => handleSemverComparator(semver.lte, specVersion, expectedVersion);
const eq = (specVersion, expectedVersion) => handleSemverComparator(semver.eq, specVersion, expectedVersion);
const neq = (specVersion, expectedVersion) => handleSemverComparator(semver.neq, specVersion, expectedVersion);

module.exports = {
	isSupportedSpecVersion,
	// semver functions
	major,
	minor,
	satisfies,
	gt,
	gte,
	lt,
	lte,
	eq,
	neq
};

// Export local function for testing only
if (process.env.NODE_ENV === "test") {
	module.exports._getSemverCompatibleVersion = getSemverCompatibleVersion;
	module.exports._handleSemverComparator = handleSemverComparator;
}
