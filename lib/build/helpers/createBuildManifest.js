import {pathToFileURL} from "node:url";
import {createRequire} from "node:module";
import {readFile} from "node:fs/promises";

// Using CommonsJS require.resolve as long as import.meta.resolve is experimental
const require = createRequire(import.meta.url);

async function getVersion(pkg) {
	// TODO: This solution relies on the fact that the entrypoint of each package is
	// located within the package root directory (./index.js).
	// A better solution would be to have a dedicated '/version' module export which provides the version.
	// e.g. const {default: version} = await import("@ui5/builder/version");
	// Or maybe some general name to allow providing more metadata:
	// const {version} = await import("@ui5/builder/metadata");
	const pkgJsonPath = new URL("./package.json", pathToFileURL(require.resolve(pkg)));
	const packageInfo = JSON.parse(await readFile(pkgJsonPath, {encoding: "utf-8"}));
	return packageInfo.version;
}

export default async function(project, buildConfig) {
	const projectName = project.getName();
	const type = project.getType();

	const pathMapping = {};
	switch (type) {
	case "application":
		pathMapping.webapp = `resources/${project.getNamespace()}`;
		break;
	case "library":
	case "theme-library":
		pathMapping.src = `resources`;
		pathMapping.test = `test-resources`;
		break;
	default:
		throw new Error(
			`Unable to create archive metadata for project ${project.getName()}: ` +
			`Project type ${type} is currently not supported`);
	}

	const metadata = {
		project: {
			specVersion: project.getSpecVersion(),
			type,
			metadata: {
				name: projectName,
			},
			resources: {
				configuration: {
					paths: pathMapping
				}
			}
		},
		buildManifest: {
			manifestVersion: "0.1",
			timestamp: new Date().toISOString(),
			versions: {
				builderVersion: await getVersion("@ui5/builder"),
				projectVersion: await getVersion("../../../"),
				fsVersion: await getVersion("@ui5/fs"),
			},
			buildConfig,
			version: project.getVersion(),
			namespace: project.getNamespace(),
			tags: Object.fromEntries(Object.entries(project.getResourceTagCollection().getAllTags()).sort())
		}
	};

	return metadata;
}
