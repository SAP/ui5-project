function getVersion(pkg) {
	const packageInfo = require(`${pkg}/package.json`);
	return packageInfo.version;
}

module.exports = async function(project, buildConfig) {
	const projectName = project.getName();
	const type = project.getType();

	const pathMapping = {};
	switch (type) {
	case "application":
		pathMapping.webapp = `resources/${project.getNamespace()}`;
		break;
	case "library":
	case "theme-library":
		pathMapping.src = `resources/${project.getNamespace()}`;
		pathMapping.test = `test-resources/${project.getNamespace()}`;
		break;
	case "legacy-library":
		pathMapping.src = `resources`;
		pathMapping.test = `test-resources`;
		break;
	default:
		throw new Error(
			`Unable to create archive metadata for project ${project.getName()}: ` +
			`Project type ${type} is currently not supported`);
	}

	const metadata = {
		specVersion: project.getSpecVersion(),
		type,
		metadata: {
			name: projectName,
		},
		customConfiguration: { // TODO 3.0: Make "_archive" a top-level property
			_archive: {
				archiveSpecVersion: "0.1",
				timestamp: new Date().toISOString(),
				versions: {
					builderVersion: getVersion("@ui5/builder"),
					projectVersion: getVersion("@ui5/project"),
					fsVersion: getVersion("@ui5/fs"),
				},
				buildConfig,
				version: project.getVersion(),
				namespace: project.getNamespace(),
				tags: project.getResourceTagCollection().getAllTags()
			}
		},
		resources: {
			configuration: {
				paths: pathMapping
			}
		}
	};

	return metadata;
};
