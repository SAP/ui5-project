class AbstractSpecification {
	/**
	 * @param {object} config Configuration object
	 */
	constructor(config) {
		if (new.target === AbstractSpecification) {
			throw new TypeError("Class 'AbstractSpecification' is abstract");
		}
		this._config = config;
	}

}

module.exports = AbstractSpecification;
