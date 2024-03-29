import test from "ava";
import sinonGlobal from "sinon";
import esmock from "esmock";
import path from "node:path";

const __dirname = import.meta.dirname;

// Use path within project as mocking base directory to reduce chance of side effects
// in case mocks/stubs do not work and real fs is used
const fakeBaseDir = path.join(__dirname, "fake-tmp");

test.beforeEach(async (t) => {
	const sinon = t.context.sinon = sinonGlobal.createSandbox();

	t.context.logStub = {
		info: sinon.stub(),
		verbose: sinon.stub(),
		silly: sinon.stub(),
		warn: sinon.stub(),
		error: sinon.stub(),
		isLevelEnabled: sinon.stub().returns(false),
		_getLogger: sinon.stub()
	};
	const ui5Logger = {
		getLogger: sinon.stub().returns(t.context.logStub)
	};

	t.context.pacote = {
		packument: sinon.stub().callsFake(async (...args) => {
			throw new Error(`pacote.packument stub called with unknown args: ${args}`);
		})
	};

	t.context.NpmcliConfig = sinon.stub().returns({
		load: sinon.stub().resolves(),
		flat: {
			registry: "https://registry.fake"
		}
	});

	t.context.Registry = await esmock.p("../../../lib/ui5Framework/npm/Registry.js", {
		"@ui5/logger": ui5Logger,
		"pacote": t.context.pacote,
		"@npmcli/config": {
			"default": t.context.NpmcliConfig
		}
	});

	const AbstractInstaller = await esmock.p("../../../lib/ui5Framework/AbstractInstaller.js", {
		"@ui5/logger": ui5Logger,
		"../../../lib/utils/fs.js": {
			mkdirp: sinon.stub().resolves()
		},
		"lockfile": {
			lock: sinon.stub().yieldsAsync(),
			unlock: sinon.stub().yieldsAsync()
		}
	});

	t.context.Installer = await esmock.p("../../../lib/ui5Framework/npm/Installer.js", {
		"@ui5/logger": ui5Logger,
		"graceful-fs": {
			rename: sinon.stub().yieldsAsync(),
		},
		"../../../lib/utils/fs.js": {
			mkdirp: sinon.stub().resolves()
		},
		"../../../lib/ui5Framework/npm/Registry.js": t.context.Registry,
		"../../../lib/ui5Framework/AbstractInstaller.js": AbstractInstaller
	});

	t.context.AbstractResolver = await esmock.p("../../../lib/ui5Framework/AbstractResolver.js", {
		"@ui5/logger": ui5Logger,
		"node:os": {
			homedir: sinon.stub().returns(path.join(fakeBaseDir, "datadir"))
		},
	});

	t.context.Sapui5Resolver = await esmock.p("../../../lib/ui5Framework/Sapui5Resolver.js", {
		"@ui5/logger": ui5Logger,
		"node:os": {
			homedir: sinon.stub().returns(path.join(fakeBaseDir, "datadir"))
		},
		"../../../lib/ui5Framework/AbstractResolver.js": t.context.AbstractResolver,
		"../../../lib/ui5Framework/npm/Installer.js": t.context.Installer
	});
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
	esmock.purge(t.context.Registry);
	esmock.purge(t.context.Installer);
	esmock.purge(t.context.AbstractResolver);
	esmock.purge(t.context.Sapui5Resolver);
});

test.serial("resolveVersion", async (t) => {
	const {Sapui5Resolver, pacote, logStub, NpmcliConfig} = t.context;

	pacote.packument
		.withArgs("@sapui5/distribution-metadata")
		.resolves({
			"versions": {
				"1.120.1": "",
				"1.120.0": "",
				"1.119.0": "",
				"1.118.0": "",
				"2.0.0-rc.1": "",
				"1.123.4-SNAPSHOT": ""
			},
			"dist-tags": {
				// NOTE: latest does not correspond to highest version in order to verify
				// that this tag is used instead of picking the highest version
				"latest": "1.120.0",

				"next": "2.0.0-rc.1",

				// NOTE: Tag ends with "-snapshot" in order to verify that the special handling
				// of that
				"not-a-snapshot": "1.118.0"
			}
		});

	const defaultCwd = process.cwd();
	const defaultUi5DataDir = path.join(fakeBaseDir, "datadir", ".ui5");

	// Generic testing without and with options argument
	const optionsArguments = [
		undefined,
		{
			cwd: path.join(fakeBaseDir, "custom-cwd"),
			ui5DataDir: path.join(fakeBaseDir, "custom-datadir", ".ui5")
		}
	];
	for (const options of optionsArguments) {
		// Reset calls to be able to check them per for-loop run
		NpmcliConfig.resetHistory();
		pacote.packument.resetHistory();

		// Ranges
		t.is(await Sapui5Resolver.resolveVersion("1", options), "1.120.1");
		t.is(await Sapui5Resolver.resolveVersion("1.120", options), "1.120.1");
		t.is(await Sapui5Resolver.resolveVersion("1.x", options), "1.120.1");
		t.is(await Sapui5Resolver.resolveVersion("1.x.x", options), "1.120.1");
		t.is(await Sapui5Resolver.resolveVersion("^1", options), "1.120.1");
		t.is(await Sapui5Resolver.resolveVersion("*", options), "1.120.1");

		// Tags
		t.is(await Sapui5Resolver.resolveVersion("latest", options), "1.120.0");
		t.is(await Sapui5Resolver.resolveVersion("next", options), "2.0.0-rc.1");
		t.is(await Sapui5Resolver.resolveVersion("not-a-snapshot", options), "1.118.0");

		// Exact versions
		t.is(await Sapui5Resolver.resolveVersion("1.118.0", options), "1.118.0");
		t.is(await Sapui5Resolver.resolveVersion("2.0.0-rc.1", options), "2.0.0-rc.1");
		t.is(await Sapui5Resolver.resolveVersion("1.123.4-SNAPSHOT", options), "1.123.4-SNAPSHOT");

		// SNAPSHOT ranges
		t.is(await Sapui5Resolver.resolveVersion("1-SNAPSHOT", options), "1.123.4-SNAPSHOT");
		t.is(await Sapui5Resolver.resolveVersion("1.123-SNAPSHOT", options), "1.123.4-SNAPSHOT");

		// Error cases
		await t.throwsAsync(Sapui5Resolver.resolveVersion("", options), {
			message: `Framework version specifier "" is incorrect or not supported`
		});
		await t.throwsAsync(Sapui5Resolver.resolveVersion("tag-does-not-exist", options), {
			message: `Could not resolve framework version via tag 'tag-does-not-exist'. ` +
				`Make sure the tag is available in the configured registry.`
		});
		await t.throwsAsync(Sapui5Resolver.resolveVersion("invalid-tag-%20", options), {
			message: `Framework version specifier "invalid-tag-%20" is incorrect or not supported`
		});

		await t.throwsAsync(Sapui5Resolver.resolveVersion("1.999.9", options), {
			message: `Could not resolve framework version 1.999.9. ` +
				`Make sure the version is valid and available in the configured registry.`
		});
		await t.throwsAsync(Sapui5Resolver.resolveVersion("1.0.0", options), {
			message: `Could not resolve framework version 1.0.0. ` +
				`Note that SAPUI5 framework libraries can only be consumed by the UI5 Tooling ` +
				`starting with SAPUI5 v1.76.0`
		});
		await t.throwsAsync(Sapui5Resolver.resolveVersion("^999", options), {
			message: `Could not resolve framework version ^999. ` +
				`Make sure the version is valid and available in the configured registry.`
		});

		// Check whether options have been passed as expected
		t.true(NpmcliConfig.alwaysCalledWithNew());
		t.true(NpmcliConfig.alwaysCalledWithMatch(sinonGlobal.match({
			cwd: options?.cwd ?? defaultCwd
		})));
		t.true(pacote.packument.alwaysCalledWithMatch("@sapui5/distribution-metadata", {
			cache: path.join(options?.ui5DataDir ?? defaultUi5DataDir, "framework", "cacache")
		}));
	}

	t.is(logStub.warn.callCount, 0);
	t.is(logStub.error.callCount, 0);
});
