import Specification, {type SpecificationConfiguration, type SpecificationParameters} from "./Specification.js";

/**
 * Extension
 *
 * @hideconstructor
 */
abstract class Extension<Configuration extends SpecificationConfiguration = SpecificationConfiguration>
	extends Specification {
	declare _config: Configuration;

	/**
	 * @param parameters Specification parameters
	 * @param parameters.id Unique ID
	 * @param parameters.version Version
	 * @param parameters.modulePath File System path to access resources
	 * @param parameters.configuration Configuration object
	 */
	async init(parameters: SpecificationParameters) {
		await super.init(parameters);

		try {
			await this._validateConfig();
		} catch (err) {
			if (err instanceof Error) {
				throw new Error(
					`Failed to validate configuration of ${this.getType()} extension ${this.getName()}: ` +
					err.message);
			}
			throw err;
		}

		return this;
	}

	protected abstract _validateConfig(): Promise<void>;
}

export default Extension;
