import test from "ava";
import sinonGlobal from "sinon";
import esmock from "esmock";

test.beforeEach(async (t) => {
	const sinon = t.context.sinon = sinonGlobal.createSandbox();

	const Ajv = t.context.Ajv = sinon.stub();
	const ajvErrors = t.context.ajvErrors = sinon.stub();

	t.context.validatorModule = await esmock.p("../../../lib/validation/validator.js", {
		"ajv": Ajv,
		"ajv-errors": ajvErrors
	});
	const {validate, _Validator: Validator} = t.context.validatorModule;

	t.context.validate = validate;
	t.context.Validator = Validator;
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
	esmock.purge(t.context.validatorModule);
});

test("validate function calls Validator#validate method", async (t) => {
	const {sinon, Validator, validate} = t.context;
	const config = {config: true};
	const project = {project: true};
	const yaml = {yaml: true};

	const validateStub = sinon.stub(Validator.prototype, "validate");
	validateStub.resolves();

	const result = await validate({config, project, yaml, schemaName: "ui5"});

	t.is(result, undefined, "validate should return undefined");
	t.is(validateStub.callCount, 1, "validate should be called once");
	t.deepEqual(validateStub.getCall(0).args, [{config, project, yaml, schemaName: "ui5"}]);
});

test("Validator requires schemaName", (t) => {
	const {sinon, Validator} = t.context;

	const Ajv = sinon.stub();
	const ajvErrors = sinon.stub();
	const invalidContructor = () => {
		new Validator({Ajv, ajvErrors});
	};

	t.throws(invalidContructor, {
		message:
			"\"schemaName\" is missing or incorrect. The available schemaName variants are ui5,ui5-workspace",
	});
});

test("Validator requires a valid schemaName", (t) => {
	const {sinon, Validator} = t.context;

	const Ajv = sinon.stub();
	const ajvErrors = sinon.stub();
	const invalidContructor = () => {
		new Validator({Ajv, ajvErrors, schemName: "invalid schema name"});
	};

	t.throws(invalidContructor, {
		message:
			"\"schemaName\" is missing or incorrect. The available schemaName variants are ui5,ui5-workspace",
	});
});

test("Validator#_compileSchema cache test", async (t) => {
	const {sinon, Validator} = t.context;

	const schema1 = {schema1: true};

	const loadSchemaStub = sinon.stub(Validator, "loadSchema");
	loadSchemaStub.onCall(0).resolves(schema1);
	loadSchemaStub.resolves({schema2: true});

	const schema1Fn = sinon.stub().named("schema1Fn");

	const compileAsyncStub = sinon.stub().resolves();
	compileAsyncStub.onCall(0).resolves(schema1Fn);
	compileAsyncStub.resolves(sinon.stub().named("schema2Fn"));

	const Ajv = sinon.stub().returns({
		compileAsync: compileAsyncStub
	});
	const ajvErrors = sinon.stub();

	const validator = new Validator({Ajv, ajvErrors, schemaName: "ui5-workspace"});

	const compile1 = validator._compileSchema();
	const compile2 = validator._compileSchema();
	const compile3 = validator._compileSchema();

	const compile1Result = await compile1;
	const compile2Result = await compile2;
	const compile3Result = await compile3;

	t.is(compile1Result, compile2Result);
	t.is(compile2Result, compile3Result);

	t.is(loadSchemaStub.callCount, 1);
	t.deepEqual(loadSchemaStub.getCall(0).args, ["ui5-workspace.json"]);

	t.is(compileAsyncStub.callCount, 1);
	t.deepEqual(compileAsyncStub.getCall(0).args, [schema1]);
});
