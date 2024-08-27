/**
 * Appends the list of 'excludes' to the list of 'patterns'. To harmonize both lists, the 'excludes'
 * are negated and the 'patternPrefix' is added to make them absolute.
 *
 * @param patterns
 *   List of absolute default patterns.
 * @param excludes
 *   List of relative patterns to be excluded. Excludes with a leading "!" are meant to be re-included.
 * @param patternPrefix
 *   Prefix to be added to the excludes to make them absolute. The prefix must have a leading and a
 *   trailing "/".
 */
export function enhancePatternWithExcludes(patterns: string[], excludes: string[], patternPrefix: string) {
	excludes.forEach((exclude) => {
		if (exclude.startsWith("!")) {
			patterns.push(`${patternPrefix}${exclude.slice(1)}`);
		} else {
			patterns.push(`!${patternPrefix}${exclude}`);
		}
	});
}
