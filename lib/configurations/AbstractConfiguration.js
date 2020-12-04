class AbstractConfiguration {
	/**
	 * @param {object} config Configuration object
	 */
	constructor(config) {
		if (new.target === AbstractConfiguration) {
			throw new TypeError("Class 'AbstractConfiguration' is abstract");
		}
		this._config = config;
	}

	getName() {
		if (!this._config.metadata) {
			console.log("No metadata:");
			console.log(this._config);
		}
		return this._config.metadata.name;
	}

	getType() {
		return this._config.type;
	}

	_gimmeConfAndRenameMe() {
		return this._config;
	}
}

module.exports = AbstractConfiguration;
