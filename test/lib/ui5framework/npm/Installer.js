const test = require("ava");
const sinon = require("sinon");

const Installer = require("../../../../lib/ui5Framework/npm/Installer");

test.beforeEach((t) => {
	t.context.mkdirpStub = sinon.stub(Installer, "_mkdirp");
	t.context.lockStub = sinon.stub(Installer, "_lock");
	t.context.unlockStub = sinon.stub(Installer, "_unlock");
});

test.afterEach.always(() => {
	sinon.restore();
});

test.serial("Installer: constructor", (t) => {
	const installer = new Installer({
		cwd: "/cwd/",
		ui5HomeDir: "/ui5Home/"
	});
	t.true(installer instanceof Installer, "Constructor returns instance of class");
	t.is(installer._baseDir, "/ui5Home/framework/packages");
	t.is(installer._lockDir, "/ui5Home/framework/locks");
});

test.serial("Installer: constructor requires 'cwd'", (t) => {
	t.throws(() => {
		new Installer({});
	}, `Installer: Missing parameter "cwd"`);
});

test.serial("Installer: constructor requires 'ui5HomeDir'", (t) => {
	t.throws(() => {
		new Installer({
			cwd: "/cwd/"
		});
	}, `Installer: Missing parameter "ui5HomeDir"`);
});

test.serial("Installer: _getLockPath", async (t) => {
	const installer = new Installer({
		cwd: "/cwd/",
		ui5HomeDir: "/ui5Home/"
	});

	const lockPath = installer._getLockPath({
		pkgName: "@openui5/sap.ui.lib1",
		version: "1.2.3"
	});

	t.is(lockPath, "/ui5Home/framework/locks/package-@openui5-sap.ui.lib1@1.2.3.lock");
});

test.serial("Installer: _synchronize", async (t) => {
	const installer = new Installer({
		cwd: "/cwd/",
		ui5HomeDir: "/ui5Home/"
	});

	t.context.mkdirpStub.resolves();
	t.context.lockStub.resolves();
	t.context.unlockStub.resolves();

	const getLockPathStub = sinon.stub(installer, "_getLockPath").returns("/locks/lockfile.lock");

	const callback = sinon.stub().resolves();

	await installer._synchronize({
		pkgName: "@openui5/sap.ui.lib1",
		version: "1.2.3"
	}, callback);

	t.is(getLockPathStub.callCount, 1, "_getLockPath should be called once");
	t.deepEqual(getLockPathStub.getCall(0).args, [{pkgName: "@openui5/sap.ui.lib1", version: "1.2.3"}],
		"_getLockPath should be called with expected args");

	t.is(t.context.mkdirpStub.callCount, 1, "_mkdirp should be called once");
	t.deepEqual(t.context.mkdirpStub.getCall(0).args, ["/ui5Home/framework/locks"],
		"_mkdirp should be called with expected args");

	t.is(t.context.lockStub.callCount, 1, "_lock should be called once");
	t.deepEqual(t.context.lockStub.getCall(0).args, [
		"/locks/lockfile.lock", {wait: 10000, stale: 60000, retries: 10}
	], "_lock should be called with expected args");

	t.is(t.context.unlockStub.callCount, 1, "_unlock should be called once");
	t.deepEqual(t.context.unlockStub.getCall(0).args, ["/locks/lockfile.lock"],
		"_unlock should be called with expected args");

	t.is(callback.callCount, 1, "callback should be called once");

	t.true(t.context.lockStub.calledBefore(callback), "Lock should be called before invoking the callback");
	t.true(t.context.unlockStub.calledAfter(callback), "Unlock should be called after invoking the callback");
});

test.serial("Installer: _synchronize should unlock when callback promise has resolved", async (t) => {
	t.plan(4);

	const installer = new Installer({
		cwd: "/cwd/",
		ui5HomeDir: "/ui5Home/"
	});

	t.context.mkdirpStub.resolves();
	t.context.lockStub.resolves();
	t.context.unlockStub.resolves();

	sinon.stub(installer, "_getLockPath").returns("/locks/lockfile.lock");

	const callback = sinon.stub().callsFake(() => {
		t.is(t.context.lockStub.callCount, 1, "_lock should have been called when the callback is invoked");
		return Promise.resolve().then(() => {
			t.is(t.context.unlockStub.callCount, 0,
				"_unlock should not be called when the callback did not fully resolve, yet");
		});
	});

	await installer._synchronize({
		pkgName: "@openui5/sap.ui.lib1",
		version: "1.2.3"
	}, callback);

	// Ensure to wait for the callback promise to be resolved
	t.is(callback.callCount, 1, "callback should be called once");
	await callback.getCall(0).returnValue;

	t.is(t.context.unlockStub.callCount, 1, "_unlock should be called when the callback has resolved");
});

test.serial("Installer: _synchronize should throw when locking fails", async (t) => {
	const installer = new Installer({
		cwd: "/cwd/",
		ui5HomeDir: "/ui5Home/"
	});

	t.context.mkdirpStub.resolves();
	t.context.lockStub.throws(new Error("Locking error"));

	sinon.stub(installer, "_getLockPath").returns("/locks/lockfile.lock");

	const callback = sinon.stub();

	await t.throwsAsync(async () => {
		await installer._synchronize({
			pkgName: "@openui5/sap.ui.lib1",
			version: "1.2.3"
		}, callback);
	}, "Locking error");

	t.is(callback.callCount, 0, "callback should not be called");
	t.is(t.context.unlockStub.callCount, 0, "_unlock should not be called");
});

test.serial("Installer: _synchronize should still unlock when callback throws an error", async (t) => {
	const installer = new Installer({
		cwd: "/cwd/",
		ui5HomeDir: "/ui5Home/"
	});

	t.context.mkdirpStub.resolves();
	t.context.lockStub.resolves();
	t.context.unlockStub.resolves();

	sinon.stub(installer, "_getLockPath").returns("/locks/lockfile.lock");

	const callback = sinon.stub().throws(new Error("Callback error"));

	await t.throwsAsync(async () => {
		await installer._synchronize({
			pkgName: "@openui5/sap.ui.lib1",
			version: "1.2.3"
		}, callback);
	}, "Callback error");

	t.is(callback.callCount, 1, "callback should be called once");
	t.is(t.context.lockStub.callCount, 1, "_lock should be called once");
	t.is(t.context.unlockStub.callCount, 1, "_unlock should be called once");
});
