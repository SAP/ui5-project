const test = require("ava");
const path = require("path");
const createArchiveMetadata = require("../../../lib/buildHelpers/createArchiveMetadata");
const Specification = require("../../../lib/specifications/Specification");

const applicationAPath = path.join(__dirname, "..", "..", "fixtures", "application.a");
const basicProjectInput = {
	id: "application.a.id",
	version: "1.0.0",
	modulePath: applicationAPath,
	configuration: {
		specVersion: "2.3",
		kind: "project",
		type: "application",
		metadata: {name: "application.a"}
	}
};

test("Create archive from project", async (t) => {
	const project = await Specification.create(basicProjectInput);
	project.getResourceTagCollection().setTag("/resources/id1/foo.js", "ui5:HasDebugVariant");

	const metadata = await createArchiveMetadata(project, "buildConfig");
	t.truthy(new Date(metadata.customConfiguration._archive.timestamp), "Timestamp is valid");
	metadata.customConfiguration._archive.timestamp = "<timestamp>";

	t.deepEqual(metadata, {
		specVersion: "2.3",
		type: "application",
		metadata: {
			name: "application.a",
		},
		customConfiguration: {
			_archive: {
				archiveSpecVersion: "0.1",
				buildConfig: "buildConfig",
				namespace: "id1",
				timestamp: "<timestamp>",
				version: "1.0.0",
				versions: {
					builderVersion: require("@ui5/builder/package.json").version,
					fsVersion: require("@ui5/fs/package.json").version,
					projectVersion: require("@ui5/project/package.json").version,
				},
				tags: {
					"/resources/id1/foo.js": {
						"ui5:HasDebugVariant": true,
					},
				}
			},
		},
		resources: {
			configuration: {
				paths: {
					webapp: "resources/id1",
				},
			},
		}
	}, "Returned correct metadata");
});
