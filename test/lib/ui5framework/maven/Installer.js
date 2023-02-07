import test from "ava";
import sinon from "sinon";
import esmock from "esmock";
import path from "node:path";

test.beforeEach(async (t) => {
	t.context.mkdirpStub = sinon.stub().resolves();
	t.context.rimrafStub = sinon.stub().yieldsAsync();

	t.context.lockStub = sinon.stub();
	t.context.unlockStub = sinon.stub();
	t.context.renameStub = sinon.stub().yieldsAsync();
	t.context.statStub = sinon.stub().yieldsAsync();

	t.context.AbstractResolver = await esmock.p("../../../../lib/ui5Framework/AbstractInstaller.js", {
		"mkdirp": t.context.mkdirpStub,
		"rimraf": t.context.rimrafStub,
		"lockfile": {
			lock: t.context.lockStub,
			unlock: t.context.unlockStub
		}
	});

	t.context.Installer = await esmock.p("../../../../lib/ui5Framework/maven/Installer.js", {
		"../../../../lib/ui5Framework/AbstractInstaller.js": t.context.AbstractResolver,
		"mkdirp": t.context.mkdirpStub,
		"rimraf": t.context.rimrafStub,
		"graceful-fs": {
			rename: t.context.renameStub,
			stat: t.context.statStub
		}
	});
});

test.afterEach.always((t) => {
	sinon.restore();
	esmock.purge(t.context.Installer);
});

test.serial("Installer: constructor", (t) => {
	const {Installer} = t.context;

	const installer = new Installer({
		cwd: "/cwd/",
		ui5HomeDir: "/ui5Home/",
		snapshotEndpointUrl: "some-url"
	});
	t.true(installer instanceof Installer, "Constructor returns instance of class");
	t.is(installer._artifactsDir, path.join("/ui5Home/", "framework", "artifacts"));
	t.is(installer._packagesDir, path.join("/ui5Home/", "framework", "packages"));
	t.is(installer._lockDir, path.join("/ui5Home/", "framework", "locks"));
	t.is(installer._stagingDir, path.join("/ui5Home/", "framework", "staging"));
	t.is(installer._metadataDir, path.join("/ui5Home/", "framework", "metadata"));
});

test.serial("Installer: constructor requires 'cwd'", (t) => {
	const {Installer} = t.context;

	t.throws(() => {
		new Installer({
			ui5HomeDir: "/ui5Home/"
		});
	}, {message: `Installer: Missing parameter "cwd"`});
});

test.serial("Installer: constructor requires 'ui5HomeDir'", (t) => {
	const {Installer} = t.context;

	t.throws(() => {
		new Installer({
			cwd: "/cwd/"
		});
	}, {message: `Installer: Missing parameter "ui5HomeDir"`});
});

test.serial("Installer: constructor requires 'snapshotEndpointUrl' or ENV variable", (t) => {
	const {Installer} = t.context;

	t.throws(() => {
		new Installer({
			cwd: "/cwd/",
			ui5HomeDir: "/ui5Home"
		});
	}, {message: `Installer: Missing Snapshot-Endpoint URL`});
});

test.serial("Installer: fetchPackageVersions", async (t) => {
	const {Installer} = t.context;

	const installer = new Installer({
		cwd: "/cwd/",
		ui5HomeDir: "/ui5Home/",
		snapshotEndpointUrl: "endpoint-url"
	});

	const registry = installer.getRegistry();
	const requestMavenMetadataStub = sinon.stub(registry, "requestMavenMetadata")
		.resolves({
			versioning: {
				versions: {
					version: ["1.0.0", "2.0.0", "2.0.0-SNAPSHOT", "3.0.0", "5.0.0-SNAPSHOT"]
				}
			}
		});

	const packageVersions = await installer.fetchPackageVersions({groupId: "ui5.corp", artifactId: "great-thing"});

	t.deepEqual(packageVersions, ["2.0.0-SNAPSHOT", "5.0.0-SNAPSHOT"], "Should resolve with expected versions");

	t.is(requestMavenMetadataStub.callCount, 1, "requestPackagePackument should be called once");
	t.deepEqual(requestMavenMetadataStub.getCall(0).args[0], {groupId: "ui5.corp", artifactId: "great-thing"},
		"requestMavenMetadata was called with correct arguments");
});

test("Installer: _getLockPath", (t) => {
	const {Installer} = t.context;

	const installer = new Installer({
		cwd: "/cwd/",
		ui5HomeDir: "/ui5Home/",
		snapshotEndpointUrl: "endpoint-url"
	});

	const lockPath = installer._getLockPath("package-@openui5/sap.ui.lib1@1.2.3-SNAPSHOT");

	t.is(lockPath, path.join("/ui5Home/", "framework", "locks", "package-@openui5-sap.ui.lib1@1.2.3-SNAPSHOT.lock"));
});
