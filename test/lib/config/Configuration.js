import test from "ava";
import sinonGlobal from "sinon";
import esmock from "esmock";
import path from "node:path";

test.beforeEach(async (t) => {
	const sinon = t.context.sinon = sinonGlobal.createSandbox();

	t.context.homedirStub = sinon.stub().returns("~/");
	t.context.promisifyStub = sinon.stub();
	t.context.yesnoStub = sinon.stub();
	t.context.Configuration = await esmock.p("../../../lib/config/Configuration.js", {
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
		artifactsDir: path.join("~", ".ui5", "framework", "artifacts"),
		cacheDir: path.join("~", ".ui5", "framework", "cacache"),
		cacheMode: "default",
		cwd: path.join("/"),
		frameworkDir: path.join("~", ".ui5", "framework"),
		lockDir: path.join("~", ".ui5", "framework", "locks"),
		metadataDir: path.join("~", ".ui5", "framework", "metadata"),
		packagesDir: path.join("~", ".ui5", "framework", "packages"),
		snapshotEndpointUrl: undefined,
		sources: false,
		stagingDir: path.join("~", ".ui5", "framework", "staging"),
		ui5HomeDir: path.join("~", ".ui5"),
		version: undefined,
	});
});


test.serial("Overwrite defaults defaults", (t) => {
	const {Configuration} = t.context.Configuration;

	const params = {
		artifactsDir: path.join("/", "custom-location", "artifacts"),
		cacheDir: path.join("/", "custom-location", "cacache"),
		cacheMode: "force",
		cwd: path.join("/"),
		frameworkDir: path.join("/", "custom-location", "framework"),
		lockDir: path.join("/", "custom-location", "locks"),
		metadataDir: path.join("/", "custom-location", "metadata"),
		packagesDir: path.join("/", "custom-location", "packages"),
		snapshotEndpointUrl: undefined,
		sources: true,
		stagingDir: path.join("/", "custom-location", "staging"),
		ui5HomeDir: path.join("/", "custom-location"),
		version: "1.99.0-SNAPSHOT"
	};

	const config = new Configuration(params);

	t.deepEqual(config.toJSON(), params);
});

test.serial("Check getters", (t) => {
	const {Configuration} = t.context.Configuration;

	const params = {
		artifactsDir: path.join("/", "custom-location", "artifacts"),
		cacheDir: path.join("/", "custom-location", "cacache"),
		cacheMode: "force",
		cwd: path.join("/"),
		frameworkDir: path.join("/", "custom-location", "framework"),
		lockDir: path.join("/", "custom-location", "locks"),
		metadataDir: path.join("/", "custom-location", "metadata"),
		packagesDir: path.join("/", "custom-location", "packages"),
		snapshotEndpointUrl: undefined,
		sources: true,
		stagingDir: path.join("/", "custom-location", "staging"),
		ui5HomeDir: path.join("/", "custom-location"),
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
		artifactsDir: path.join("/", "custom-location", "artifacts"),
		cacheDir: path.join("/", "custom-location", "cacache"),
		cacheMode: "force",
		cwd: path.join("/"),
		frameworkDir: path.join("/", "custom-location", "framework"),
		lockDir: path.join("/", "custom-location", "locks"),
		metadataDir: path.join("/", "custom-location", "metadata"),
		packagesDir: path.join("/", "custom-location", "packages"),
		snapshotEndpointUrl: undefined,
		sources: true,
		stagingDir: path.join("/", "custom-location", "staging"),
		ui5HomeDir: path.join("/", "custom-location"),
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
	t.is(config.getUi5HomeDir(), path.join("~/", ".ui5"), "Dafault settings");
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

test.serial("saveConfig", async (t) => {
	const {saveConfig, Configuration} = t.context.Configuration;
	const {promisifyStub, sinon} = t.context;

	const writeStub = sinon.stub().resolves();
	promisifyStub.callsFake(() => writeStub);

	const config = new Configuration({});
	await saveConfig("/path/to/save/.ui5rc", config);

	t.deepEqual(
		writeStub.getCall(0).args,
		["/path/to/save/.ui5rc", JSON.stringify(config.toJSON())],
		"Write config to path"
	);
});

test.serial("resolveSnapshotEndpointUrl", async (t) => {
	const {resolveSnapshotEndpointUrl} = t.context.Configuration;
	const {promisifyStub, yesnoStub, sinon} = t.context;

	const readStub = sinon.stub().resolves(`<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 http://maven.apache.org/xsd/settings-1.0.0.xsd">
	  <profiles>
		<profile>
		  <id>snapshot.build</id>
		  <pluginRepositories>
			<pluginRepository>
			  <id>artifactory</id>
			  <url>/build-snapshots/</url>
			</pluginRepository>
		  </pluginRepositories>
		</profile>
	  </profiles>
	</settings>`);
	promisifyStub.callsFake(() => readStub);
	yesnoStub.resolves(true);

	const endpoint = await resolveSnapshotEndpointUrl();

	t.is(endpoint, "/build-snapshots/", "URL Extracted from settings.xml");
});

test.serial("resolveSnapshotEndpointUrl throws", async (t) => {
	const {resolveSnapshotEndpointUrl} = t.context.Configuration;
	const {promisifyStub, yesnoStub, sinon} = t.context;

	const readStub = sinon.stub()
		.onFirstCall().throws({code: "ENOENT"})
		.onSecondCall().throws(new Error("Error"));
	promisifyStub.callsFake(() => readStub);
	yesnoStub.resolves(true);

	await t.throwsAsync(resolveSnapshotEndpointUrl(), {
		message: "SnapshotURL not resolved",
	});

	await t.throwsAsync(resolveSnapshotEndpointUrl(), {
		message: "Error",
	});
});
