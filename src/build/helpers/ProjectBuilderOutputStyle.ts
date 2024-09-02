/**
 * Processes build results into a specific directory structure.
 *
 * Default The default directory structure for every project type.
 * For applications this is identical to "Flat" and for libraries to "Namespace".
 * Other types have a more distinct default output style.
 *
 * Flat Omits the project namespace and the "resources" directory.
 *
 * Namespace Respects project namespace and the "resources" directory.
 *
 */
export default {
	Default: "Default",
	Flat: "Flat",
	Namespace: "Namespace",
};
