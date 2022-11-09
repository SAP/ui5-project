import path from "node:path";
import {fileURLToPath} from "node:url";
import test from "ava";
import sinonGlobal from "sinon";
import esmock from "esmock";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libraryD = path.join(__dirname, "..", "..", "fixtures", "library.d");
const libraryE = path.join(__dirname, "..", "..", "fixtures", "library.e");

function createWorkspaceConfig({dependencyManagement}) {
	return {
		specVersion: "2.3",
		metadata: {
			name: "workspace-name"
		},
		dependencyManagement
	};
}

test.beforeEach(async (t) => {
	const sinon = t.context.sinon = sinonGlobal.createSandbox();

	t.context.log = {
		warn: sinon.stub(),
		verbose: sinon.stub(),
		error: sinon.stub(),
		info: sinon.stub(),
		isLevelEnabled: () => true
	};

	t.context.Workspace = await esmock.p("../../../lib/graph/Workspace.js", {
		"@ui5/logger": {
			getLogger: sinon.stub().withArgs("graph:Workspace").returns(t.context.log)
		}
	});
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
	esmock.purge(t.context.ProjectGraph);
});

test("Basic resolution", async (t) => {
	const workspace = new t.context.Workspace({
		cwd: __dirname,
		workspaceConfiguration: createWorkspaceConfig({
			dependencyManagement: {
				resolutions: [{
					path: "../../fixtures/library.d"
				}, {
					path: "../../fixtures/library.e"
				}]
			}
		})
	});

	const nodes = await workspace.getNodes();
	t.deepEqual(Array.from(nodes.keys()), ["library.d", "library.e"], "Correct node keys");
	t.deepEqual(Array.from(nodes.values()), [{
		id: "library.d",
		path: libraryD,
		version: "1.0.0",
	}, {
		id: "library.e",
		path: libraryE,
		version: "1.0.0",
	}], "Correct node configuration");
});
