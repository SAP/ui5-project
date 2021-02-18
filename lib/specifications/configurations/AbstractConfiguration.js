/*
* Private configuration class for use in specifications
*/

class AbstractConfiguration {
	/**
	 * @param {object} parameters
	 * @param {object} parameters.specification Specification instance
	 * @param {object} parameters.configObject Configuration object
	 */
	constructor({configObject, specification}) {
		this._config = configObject;
		this._specification = specification;
	}

	async init() {
		/* to be implemented by subclasses where needed*/
		return this;
	}

	getName() {
		return this._config.metadata.name;
	}

	getKind() {
		return this._config.kind;
	}

	getType() {
		return this._config.type;
	}

	getObject() {
		return this._config;
	}
}

module.exports = AbstractConfiguration;
