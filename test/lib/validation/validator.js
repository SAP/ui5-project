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

	const result = await validate({config, project, yaml, schemaName: "ui5.json"});

	t.is(result, undefined, "validate should return undefined");
	t.is(validateStub.callCount, 1, "validate should be called once");
	t.deepEqual(validateStub.getCall(0).args, [{config, project, yaml, schemaName: "ui5.json"}]);
});

test("Validator#_compileSchema with two simultaneous calls for different schemas", async (t) => {
	const {sinon, Validator} = t.context;

	const schema1 = {schema1: true};
	const schema2 = {schema2: true};

	const loadSchemaStub = sinon.stub(Validator, "loadSchema");
	loadSchemaStub.withArgs("schema1.json").resolves(schema1);
	loadSchemaStub.withArgs("schema2.json").resolves(schema2);

	const schema1Fn = sinon.stub().named("schema1Fn");
	const schema2Fn = sinon.stub().named("schema2Fn");

	const compileAsyncStub = sinon.stub().resolves();
	compileAsyncStub.withArgs(schema1).resolves(schema1Fn);
	compileAsyncStub.withArgs(schema2).resolves(schema2Fn);

	const Ajv = sinon.stub().returns({
		compileAsync: compileAsyncStub
	});
	const ajvErrors = sinon.stub();

	const validator = new Validator({Ajv, ajvErrors});

	const compile1 = validator._compileSchema("schema1.json");
	const compile2 = validator._compileSchema("schema2.json");

	const compile1Result = await compile1;
	const compile2Result = await compile2;

	t.is(compile1Result, schema1Fn);
	t.is(compile2Result, schema2Fn);

	t.is(loadSchemaStub.callCount, 2);
	t.deepEqual(loadSchemaStub.getCall(0).args, ["schema1.json"]);
	t.deepEqual(loadSchemaStub.getCall(1).args, ["schema2.json"]);

	t.is(compileAsyncStub.callCount, 2);
	t.deepEqual(compileAsyncStub.getCall(0).args, [schema1]);
	t.deepEqual(compileAsyncStub.getCall(1).args, [schema2]);
});
