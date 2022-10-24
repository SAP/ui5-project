import test from "ava";
import sinon from "sinon";
import {validate, _Validator as Validator} from "../../../lib/validation/validator.js";

test.afterEach.always((t) => {
	sinon.restore();
});

test.serial("validate function calls Validator#validate method", async (t) => {
	const config = {config: true};
	const project = {project: true};
	const yaml = {yaml: true};

	const validateStub = sinon.stub(Validator.prototype, "validate");
	validateStub.resolves();

	const result = await validate({config, project, yaml});

	t.is(result, undefined, "validate should return undefined");
	t.is(validateStub.callCount, 1, "validate should be called once");
	t.deepEqual(validateStub.getCall(0).args, [{config, project, yaml}]);
});
