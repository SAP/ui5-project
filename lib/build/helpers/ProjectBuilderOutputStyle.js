/**
 * Processes build results into a specific directory structure.
 *
 * @public
 * @readonly
 * @enum {string}
 * @property {string} Default Default directory structure for every project type.
 *     For applications: "Flat", for libraries: "Namespace", for theme-libraries: "Namespace", etc.
 * @property {string} Flat Omits the project namespace and the "resources" directory.
 * @property {string} Namespace Respects project namespace and the "resources" directory.
 *     Not applicable for projects of type 'application'.
 * @module @ui5/project/build/ProjectBuilderOutputStyle
 */
export default {
	Default: "Default",
	Flat: "Flat",
	Namespace: "Namespace"
};
