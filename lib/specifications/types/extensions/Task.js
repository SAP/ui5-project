const path = require("path");
const Extension = require("../../Extension");

class Task extends Extension {
	constructor(parameters) {
		super(parameters);
	}

	/* === Attributes === */
	/**
	* @public
	*/
	getTask() {
		const taskPath = path.join(this.getPath(), this._config.task.path);
		return require(taskPath);
	}

	/* === Internals === */
	/**
	 * @private
	 * @param {object} config Configuration object
	*/
	async _parseConfiguration(config) {
		await super._parseConfiguration(config);
	}

	async _validate() {
		await super._validate();
	}
}

module.exports = Task;
