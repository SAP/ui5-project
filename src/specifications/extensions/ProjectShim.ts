import Extension from "../Extension.js";
import {type SpecificationConfiguration} from "../Specification.js";

interface ShimConfiguration extends SpecificationConfiguration {
	shims: {
		dependencies?: Record<string, string>;
		configurations?: Record<string, string>;
		collections?: Record<string, {
			modules: Record<string, string>;
		}>;
	};
}

/**
 * ProjectShim
 *
 * @hideconstructor
 */
class ProjectShim extends Extension<ShimConfiguration> {
	/* === Attributes === */
	/**
	 */
	public getDependencyShims() {
		return this._config.shims.dependencies ?? {};
	}

	/**
	 */
	public getConfigurationShims() {
		return this._config.shims.configurations ?? {};
	}

	/**
	 */
	public getCollectionShims() {
		return this._config.shims.collections ?? {};
	}

	protected async _validateConfig() {
		if (this._config.shims.collections) {
			const {
				default: path,
			} = await import("path");
			for (const dependencyDefinition of Object.values(this._config.shims.collections)) {
				Object.values(dependencyDefinition.modules).forEach((depPath) => {
					if (path.isAbsolute(depPath)) {
						throw new Error("All module paths of collections defined in a project-shim must be relative");
					}
				});
			}
		}
	}
}

export default ProjectShim;
