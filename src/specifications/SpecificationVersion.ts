import semver from "semver";

const SPEC_VERSION_PATTERN = /^\d+\.\d+$/;
const SUPPORTED_VERSIONS = [
	"0.1", "1.0", "1.1",
	"2.0", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6",
	"3.0", "3.1", "3.2",
	"4.0",
];

/**
 * Helper class representing a Specification Version. Featuring helper functions for easy comparison
 * of versions.
 *
 * @alias @ui5/project/specifications/utils/SpecificationVersion
 */
class SpecificationVersion {
	#specVersion;
	#semverVersion;

	/**
	 * @param specVersion Specification Version to use for all comparison operations
	 * @throws {Error} Throws if provided Specification Version is not supported by this version of @ui5/project
	 */
	constructor(specVersion: string) {
		this.#specVersion = specVersion;
		this.#semverVersion = getSemverCompatibleVersion(specVersion); // Throws for unsupported versions
	}

	/**
	 * Returns the Specification Version
	 *
	 * @returns Specification Version
	 */
	public toString() {
		return this.#specVersion;
	}

	/**
	 * Returns the major-version of the instance's Specification Version
	 *
	 * @returns Major version
	 */
	public major() {
		return semver.major(this.#semverVersion);
	}

	/**
	 * Returns the minor-version of the instance's Specification Version
	 *
	 * @returns Minor version
	 */
	public minor() {
		return semver.minor(this.#semverVersion);
	}

	/**
	 * Test whether the instance's Specification Version falls into the provided range
	 *
	 * @param range [Semver]{@link https://www.npmjs.com/package/semver}-style version range,
	 * for example <code>2.2 - 2.4</code> or <code>=3.0</code>
	 * @returns True if the instance's Specification Version falls into the provided range
	 */
	public satisfies(range: string) {
		return semver.satisfies(this.#semverVersion, range);
	}

	/**
	 * Test whether the instance's Specification Version is greater than the provided test version
	 *
	 * @param testVersion A Specification Version to compare the instance's Specification Version to
	 * @returns True if the instance's Specification Version is greater than the provided version
	 */
	public gt(testVersion: string) {
		return handleSemverComparator(semver.gt, this.#semverVersion, testVersion);
	}

	/**
	 * Test whether the instance's Specification Version is greater than or equal to the provided test version
	 *
	 * @param testVersion A Specification Version to compare the instance's Specification Version to
	 * @returns True if the instance's Specification Version is greater than or equal to the provided version
	 */
	public gte(testVersion: string) {
		return handleSemverComparator(semver.gte, this.#semverVersion, testVersion);
	}

	/**
	 * Test whether the instance's Specification Version is smaller than the provided test version
	 *
	 * @param testVersion A Specification Version to compare the instance's Specification Version to
	 * @returns True if the instance's Specification Version is smaller than the provided version
	 */
	public lt(testVersion: string) {
		return handleSemverComparator(semver.lt, this.#semverVersion, testVersion);
	}

	/**
	 * Test whether the instance's Specification Version is smaller than or equal to the provided test version
	 *
	 * @param testVersion A Specification Version to compare the instance's Specification Version to
	 * @returns True if the instance's Specification Version is smaller than or equal to the provided version
	 */
	public lte(testVersion: string) {
		return handleSemverComparator(semver.lte, this.#semverVersion, testVersion);
	}

	/**
	 * Test whether the instance's Specification Version is equal to the provided test version
	 *
	 * @param testVersion A Specification Version to compare the instance's Specification Version to
	 * @returns True if the instance's Specification Version is equal to the provided version
	 */
	public eq(testVersion: string) {
		return handleSemverComparator(semver.eq, this.#semverVersion, testVersion);
	}

	/**
	 * Test whether the instance's Specification Version is not equal to the provided test version
	 *
	 * @param testVersion A Specification Version to compare the instance's Specification Version to
	 * @returns True if the instance's Specification Version is not equal to the provided version
	 */
	public neq(testVersion: string) {
		return handleSemverComparator(semver.neq, this.#semverVersion, testVersion);
	}

	public static isSupportedSpecVersion(testVersion: string) {
		return SUPPORTED_VERSIONS.includes(testVersion);
	}

	public static major(specVersion: string) {
		const comparator = new SpecificationVersion(specVersion);
		return comparator.major();
	}

	public static minor(specVersion: string) {
		const comparator = new SpecificationVersion(specVersion);
		return comparator.minor();
	}

	public static satisfies(specVersion: string, range: string) {
		const comparator = new SpecificationVersion(specVersion);
		return comparator.satisfies(range);
	}

	public static gt(specVersion: string, testVersion: string) {
		const comparator = new SpecificationVersion(specVersion);
		return comparator.gt(testVersion);
	}

	public static gte(specVersion: string, testVersion: string) {
		const comparator = new SpecificationVersion(specVersion);
		return comparator.gte(testVersion);
	}

	public static lt(specVersion: string, testVersion: string) {
		const comparator = new SpecificationVersion(specVersion);
		return comparator.lt(testVersion);
	}

	public static lte(specVersion: string, testVersion: string) {
		const comparator = new SpecificationVersion(specVersion);
		return comparator.lte(testVersion);
	}

	public static eq(specVersion: string, testVersion: string) {
		const comparator = new SpecificationVersion(specVersion);
		return comparator.eq(testVersion);
	}

	public static neq(specVersion: string, testVersion: string) {
		const comparator = new SpecificationVersion(specVersion);
		return comparator.neq(testVersion);
	}

	public static getVersionsForRange(range: string) {
		return SUPPORTED_VERSIONS.filter((specVersion) => {
			const comparator = new SpecificationVersion(specVersion);
			return comparator.satisfies(range);
		});
	}
}

/**
 *
 * @param specVersion
 */
function getUnsupportedSpecVersionMessage(specVersion) {
	return `Unsupported Specification Version ${specVersion} defined. Your UI5 CLI installation might be outdated. ` +
		`For details, see https://sap.github.io/ui5-tooling/pages/Configuration/#specification-versions`;
}

/**
 *
 * @param specVersion
 */
function getSemverCompatibleVersion(specVersion) {
	if (SpecificationVersion.isSupportedSpecVersion(specVersion)) {
		return specVersion + ".0";
	}
	throw new Error(getUnsupportedSpecVersionMessage(specVersion));
}

/**
 *
 * @param comparator
 * @param baseVersion
 * @param testVersion
 */
function handleSemverComparator(comparator, baseVersion, testVersion) {
	if (SPEC_VERSION_PATTERN.test(testVersion)) {
		const a = baseVersion;
		const b = testVersion + ".0";
		return comparator(a, b);
	}
	throw new Error("Invalid spec version expectation given in comparator: " + testVersion);
}

export default SpecificationVersion;

// Export local function for testing only
export const __localFunctions__ = (process.env.NODE_ENV === "test") ?
		{getSemverCompatibleVersion, handleSemverComparator} : /* istanbul ignore next */ undefined;
