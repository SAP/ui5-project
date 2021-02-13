const AbstractSpecification = require("./AbstractSpecification");

class Extension extends AbstractSpecification {
	/**
	 * @param {object} parameters Extension parameters
	 * @param {string} parameters.id Unique ID for the extension
	 * @param {string} parameters.version Version of the extension
	 * @param {string} parameters.modulePath File System path to access the extensions resources
	 * @param {module:@ui5/project.specifications.Configuration} parameters.configuration
	 * 						Configuration instance for the extension
	 */
	constructor(parameters) {
		super(parameters);
		if (this.getKind() !== "extension") {
			throw new Error(`Could not create extension: Supplied configuration must be of kind extension but is ` +
				this.getKind());
		}
	}

	/*
	* TODO: Expose extension specific APIs
	*/
}

module.exports = Extension;
