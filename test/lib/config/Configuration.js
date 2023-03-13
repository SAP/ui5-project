import test from "ava";
import sinonGlobal from "sinon";
import esmock from "esmock";

test.beforeEach(async (t) => {
	const sinon = t.context.sinon = sinonGlobal.createSandbox();

	t.context.homedirStub = sinon.stub().returns("~");
	t.context.promisifyStub = sinon.stub();
	t.context.yesnoStub = sinon.stub();
	t.context.resolveStub = sinon.stub().callsFake((path) => path);
	t.context.joinStub = sinon.stub().callsFake((...args) => args.join("/"));
	t.context.Configuration = await esmock.p("../../../lib/config/Configuration.js", {
		"node:path": {
			resolve: t.context.resolveStub,
			join: t.context.joinStub
		},
		"yesno": t.context.yesnoStub,
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

test.serial("Build configuration with defaults", (t) => {
	const {Configuration} = t.context.Configuration;

	const config = new Configuration({cwd: "/"});

	t.deepEqual(config.toJSON(), {
		artifactsDir: "~/.ui5/framework/artifacts",
		cacheDir: "~/.ui5/framework/cacache",
		cacheMode: "default",
		cwd: "/",
		frameworkDir: "~/.ui5/framework",
		lockDir: "~/.ui5/framework/locks",
		metadataDir: "~/.ui5/framework/metadata",
		packagesDir: "~/.ui5/framework/packages",
		snapshotEndpointUrl: undefined,
		sources: false,
		stagingDir: "~/.ui5/framework/staging",
		ui5HomeDir: "~/.ui5",
		version: undefined,
	});
});


test.serial("Overwrite defaults defaults", (t) => {
	const {Configuration} = t.context.Configuration;

	const params = {
		artifactsDir: "/custom-location/artifacts",
		cacheDir: "/custom-location/cacache",
		cacheMode: "force",
		cwd: "/",
		frameworkDir: "/custom-location/framework",
		lockDir: "/custom-location/locks",
		metadataDir: "/custom-location/metadata",
		packagesDir: "/custom-location/packages",
		snapshotEndpointUrl: undefined,
		sources: true,
		stagingDir: "/custom-location/staging",
		ui5HomeDir: "/custom-location",
		version: "1.99.0-SNAPSHOT"
	};

	const config = new Configuration(params);

	t.deepEqual(config.toJSON(), params);
});

test.serial("Check getters", (t) => {
	const {Configuration} = t.context.Configuration;

	const params = {
		artifactsDir: "/custom-location/artifacts",
		cacheDir: "/custom-location/cacache",
		cacheMode: "force",
		cwd: "/",
		frameworkDir: "/custom-location/framework",
		lockDir: "/custom-location/locks",
		metadataDir: "/custom-location/metadata",
		packagesDir: "/custom-location/packages",
		snapshotEndpointUrl: undefined,
		sources: true,
		stagingDir: "/custom-location/staging",
		ui5HomeDir: "/custom-location",
		version: "1.99.0-SNAPSHOT"
	};

	const config = new Configuration(params);

	t.is(config.getArtifactsDir(), params.artifactsDir);
	t.is(config.getCacheDir(), params.cacheDir);
	t.is(config.getCacheMode(), params.cacheMode);
	t.is(config.getCwd(), params.cwd);
	t.is(config.getFrameworkDir(), params.frameworkDir);
	t.is(config.getLockDir(), params.lockDir);
	t.is(config.getMetadataDir(), params.metadataDir);
	t.is(config.getPackagesDir(), params.packagesDir);
	t.is(config.getSnapshotEndpointUrl(), params.snapshotEndpointUrl);
	t.is(config.getSources(), params.sources);
	t.is(config.getStagingDir(), params.stagingDir);
	t.is(config.getUi5HomeDir(), params.ui5HomeDir);
	t.is(config.getVersion(), params.version);
});


test.serial("fromFile", async (t) => {
	const {fromFile} = t.context.Configuration;
	const {promisifyStub, sinon} = t.context;

	const ui5rcContents = {
		artifactsDir: "/custom-location/artifacts",
		cacheDir: "/custom-location/cacache",
		cacheMode: "force",
		cwd: "/",
		frameworkDir: "/custom-location/framework",
		lockDir: "/custom-location/locks",
		metadataDir: "/custom-location/metadata",
		packagesDir: "/custom-location/packages",
		snapshotEndpointUrl: undefined,
		sources: true,
		stagingDir: "/custom-location/staging",
		ui5HomeDir: "/custom-location",
		version: "1.99.0-SNAPSHOT",
	};
	const responseStub = sinon.stub().resolves(JSON.stringify(ui5rcContents));
	promisifyStub.callsFake(() => responseStub);

	const config = await fromFile("/custom/path/.ui5rc");

	t.deepEqual(config.toJSON(), ui5rcContents);
});

test.serial("fromFile: configuration file not found- fallback to default config", async (t) => {
	const {fromFile, Configuration} = t.context.Configuration;
	const {promisifyStub, sinon} = t.context;

	const responseStub = sinon.stub().throws({code: "ENOENT"});
	promisifyStub.callsFake(() => responseStub);

	const config = await fromFile("/non-existing/path/.ui5rc");

	t.is(config instanceof Configuration, true, "Created a default configuration");
	t.is(config.getUi5HomeDir(), "~/.ui5", "Dafault settings");
});

test.serial("fromFile: throws", async (t) => {
	const {fromFile} = t.context.Configuration;
	const {promisifyStub, sinon} = t.context;

	const responseStub = sinon.stub().throws(new Error("Error"));
	promisifyStub.callsFake(() => responseStub);

	await t.throwsAsync(fromFile("/non-existing/path/.ui5rc"), {
		message: "Error"
	});
});
