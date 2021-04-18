const projectGraphBuilder = require("./projectGraphBuilder");
const DependencyTreeProvider = require("./providers/DependencyTree");

module.exports = async function(tree) {
	const dependencyTreeProvider = new DependencyTreeProvider(tree);
	return projectGraphBuilder(dependencyTreeProvider);
};
