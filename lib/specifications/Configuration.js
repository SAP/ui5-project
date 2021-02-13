/*
* Private configuration class for use in Module and specifications
*/

class Configuration {
	/**
	 * @param {object} config Configuration object
	 */
	constructor(config) {
		this._config = config;
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

module.exports = Configuration;
