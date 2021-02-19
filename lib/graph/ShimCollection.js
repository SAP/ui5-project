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
		this._projectConfigShims = {};
		this._dependencyShims = {};
		this._collectionShims = {};
	}

	addProjectShim(shimExtension) {
		const name = shimExtension.getName();
		log.verbose(`Adding new shim ${name}...`);
		// TODO: Move this into a dedicated ShimConfiguration class?
		const {configurations, dependencies, collections} = shimExtension.getShimConfiguration();
		if (configurations) {
			addToMap(name, configurations, this._projectConfigShims);
		}
		if (dependencies) {
			addToMap(name, dependencies, this._dependencyShims);
		}
		if (collections) {
			addToMap(name, collections, this._collectionShims);
		}
	}

	getProjectConfigurationShims(moduleId) {
		return this._projectConfigShims[moduleId];
	}

	getAllDependencyShims() {
		return this._dependencyShims;
	}

	getCollectionShims(moduleId) {
		return this._collectionShims[moduleId];
	}
}

module.exports = ShimCollection;
