import test from "ava";
import sinonGlobal from "sinon";
import esmock from "esmock";

test.beforeEach(async (t) => {
	const sinon = t.context.sinon = sinonGlobal.createSandbox();

	t.context.homedirStub = sinon.stub().returns("~");
	t.context.promisifyStub = sinon.stub();
	t.context.resolveStub = sinon.stub().callsFake((path) => path);
	t.context.joinStub = sinon.stub().callsFake((...args) => args.join("/"));
	t.context.Configuration = await esmock.p("../../../lib/config/Configuration.js", {
		"node:path": {
			resolve: t.context.resolveStub,
			join: t.context.joinStub
		},
		"node:util": {
			"promisify": t.context.promisifyStub
		},
		"node:os": {
			"homedir": t.context.homedirStub
		}
	});
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
	esmock.purge(t.context.Configuration);
});

test.serial("Available configuration settings", (t) => {
	const {Configuration} = t.context;
	t.deepEqual(Configuration.SETTINGS, [
		"mavenSnapshotEndpointUrl",
		"ui5DataDir"
	]);
});

test.serial("Build configuration with defaults", (t) => {
	const {Configuration} = t.context;

	const config = new Configuration({});

	t.deepEqual(config.toJson(), {
		mavenSnapshotEndpointUrl: undefined,
		ui5DataDir: undefined,
	});
});

test.serial("Overwrite defaults defaults", (t) => {
	const {Configuration} = t.context;

	const params = {
		mavenSnapshotEndpointUrl: "https://snapshot.url",
		ui5DataDir: "/custom/data/dir"
	};

	const config = new Configuration(params);

	t.deepEqual(config.toJson(), params);
});

test.serial("Check getters", (t) => {
	const {Configuration} = t.context;

	const params = {
		mavenSnapshotEndpointUrl: "https://snapshot.url",
		ui5DataDir: "/custom/data/dir"
	};

	const config = new Configuration(params);

	t.is(config.getMavenSnapshotEndpointUrl(), params.mavenSnapshotEndpointUrl);
	t.is(config.getUi5DataDir(), params.ui5DataDir);
});


test.serial("fromFile", async (t) => {
	const fromFile = t.context.Configuration.fromFile;
	const {promisifyStub, sinon} = t.context;

	const ui5rcContents = {
		mavenSnapshotEndpointUrl: "https://snapshot.url",
		ui5DataDir: "/custom/data/dir"
	};
	const responseStub = sinon.stub().resolves(JSON.stringify(ui5rcContents));
	promisifyStub.callsFake(() => responseStub);

	const config = await fromFile("/custom/path/.ui5rc");

	t.deepEqual(config.toJson(), ui5rcContents);
});

test.serial("fromFile: configuration file not found - fallback to default config", async (t) => {
	const {promisifyStub, sinon, Configuration} = t.context;
	const fromFile = Configuration.fromFile;

	const responseStub = sinon.stub().throws({code: "ENOENT"});
	promisifyStub.callsFake(() => responseStub);

	const config = await fromFile("/non-existing/path/.ui5rc");

	t.is(config instanceof Configuration, true, "Created a default configuration");
	t.is(config.getMavenSnapshotEndpointUrl(), undefined, "Default settings");
	t.is(config.getUi5DataDir(), undefined, "Default settings");
});


test.serial("fromFile: empty configuration file - fallback to default config", async (t) => {
	const {promisifyStub, sinon, Configuration} = t.context;
	const fromFile = Configuration.fromFile;

	const responseStub = sinon.stub().resolves("");
	promisifyStub.callsFake(() => responseStub);

	const config = await fromFile("/non-existing/path/.ui5rc");

	t.is(config instanceof Configuration, true, "Created a default configuration");
	t.is(config.getMavenSnapshotEndpointUrl(), undefined, "Default settings");
	t.is(config.getUi5DataDir(), undefined, "Default settings");
});

test.serial("fromFile: throws", async (t) => {
	const fromFile = t.context.Configuration.fromFile;
	const {promisifyStub, sinon} = t.context;

	const responseStub = sinon.stub().throws(new Error("Error"));
	promisifyStub.callsFake(() => responseStub);

	await t.throwsAsync(fromFile(), {
		message: `Failed to read UI5 Tooling configuration from ~/.ui5rc: Error`
	});
});

test.serial("toFile", async (t) => {
	const {promisifyStub, sinon, Configuration} = t.context;
	const toFile = Configuration.toFile;

	const writeStub = sinon.stub().resolves();
	promisifyStub.callsFake(() => writeStub);

	const config = new Configuration({mavenSnapshotEndpointUrl: "https://registry.corp/vendor/build-snapshots/"});
	await toFile(config, "/path/to/save/.ui5rc");

	t.deepEqual(
		writeStub.getCall(0).args,
		["/path/to/save/.ui5rc", JSON.stringify(config.toJson())],
		"Write config to path"
	);
});

test.serial("toFile: throws", async (t) => {
	const {promisifyStub, sinon, Configuration} = t.context;
	const toFile = Configuration.toFile;

	const responseStub = sinon.stub().throws(new Error("Error"));
	promisifyStub.callsFake(() => responseStub);

	await t.throwsAsync(toFile(new Configuration({})), {
		message: "Failed to write UI5 Tooling configuration to ~/.ui5rc: Error"
	});
});
