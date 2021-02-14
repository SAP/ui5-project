const log = require("@ui5/logger").getLogger("graph:ShimCollection");

function addToMap(name, fromMap, toMap) {
	for (const [moduleId, shim] of Object.entries(fromMap)) {
		if (!toMap[moduleId]) {
			toMap[moduleId] = [];
		}
		toMap[moduleId].push({
			name,
			shim
		});
	}
}

class ShimCollection {
	constructor() {
		this._configShims = {};
		this._dependencyShims = {};
		this._collectionShims = {};
	}

	addShim(shimExtension) {
		const name = shimExtension.getName();
		log.verbose(`Adding new shim ${name}...`);
		// TODO: Move this into a dedicated ShimConfiguration class?
		const config = shimExtension.getConfigurationObject();
		const {configurations, dependencies, collections} = config.shims;
		if (configurations) {
			addToMap(name, configurations, this._configShims);
		}
		if (dependencies) {
			addToMap(name, dependencies, this._dependencyShims);
		}
		if (collections) {
			addToMap(name, collections, this._collectionShims);
		}
	}

	getConfigurationShims(moduleId) {
		return this._configShims[moduleId];
	}

	getAllDependencyShims() {
		return this._dependencyShims;
	}

	getCollectionShims(moduleId) {
		return this._collectionShims[moduleId];
	}
}

module.exports = ShimCollection;