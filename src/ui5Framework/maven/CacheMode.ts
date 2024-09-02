/**
 * Cache modes for maven consumption
 *
 * Default Cache everything, invalidate after 9 hours
 *
 * Force Use cache only. Do not send any requests to the repository
 *
 * Off Invalidate the cache and update from the repository
 *
 */
export default {
	Default: "Default",
	Force: "Force",
	Off: "Off",
};
