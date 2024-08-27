import Specification from "./Specification.js";

/**
 * Extension
 *
 * @alias @ui5/project/specifications/Extension
 * @hideconstructor
 */
class Extension extends Specification {
	constructor(parameters) {
		super(parameters);
		if (new.target === Extension) {
			throw new TypeError("Class 'Extension' is abstract. Please use one of the 'types' subclasses");
		}
	}

	/**
	 * @param parameters Specification parameters
	 * @param parameters.id Unique ID
	 * @param parameters.version Version
	 * @param parameters.modulePath File System path to access resources
	 * @param parameters.configuration Configuration object
	 */
	async init(parameters: {
		id: string;
		version: string;
		modulePath: string;
		configuration: object;
	}) {
		await super.init(parameters);

		try {
			await this._validateConfig();
		} catch (err) {
			throw new Error(
				`Failed to validate configuration of ${this.getType()} extension ${this.getName()}: ` +
				err.message);
		}

		return this;
	}

	async _validateConfig() {}
}

export default Extension;
