const test = require("ava");
const sinon = require("sinon");
const {safeDump: dumpYaml} = require("js-yaml");
const validate = require("../../../lib/schema/validate");
const {_Validator: Validator, ValidationError} = validate;

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

test.serial("ValidationError constructor", (t) => {
	const errors = [
		{dataPath: "", keyword: "", message: "error1", params: {}},
		{dataPath: "", keyword: "", message: "error2", params: {}}
	];
	const project = {id: "id"};
	const yaml = {path: "path", source: "source", documentIndex: 0};

	const filteredErrors = [{dataPath: "", keyword: "", message: "error1", params: {}}];

	const filterErrorsStub = sinon.stub(ValidationError, "filterErrors");
	filterErrorsStub.returns(filteredErrors);

	const formatMessageStub = sinon.stub(ValidationError, "formatMessage");
	formatMessageStub.returns("Formatted Message");

	const validationError = new ValidationError({errors, project, yaml});

	t.true(validationError instanceof ValidationError, "ValidationError constructor returns instance");
	t.true(validationError instanceof Error, "ValidationError inherits from Error");
	t.is(validationError.name, "ValidationError", "ValidationError should have 'name' property");

	t.deepEqual(validationError.errors, filteredErrors,
		"ValidationError should have 'errors' property with filtered errors");
	t.deepEqual(validationError.project, project, "ValidationError should have 'project' property");
	t.deepEqual(validationError.yaml, yaml, "≈ should have 'yaml' property");
	t.is(validationError.message, "Formatted Message", "ValidationError should have 'message' property");

	t.is(filterErrorsStub.callCount, 1, "ValidationError.filterErrors should be called once");
	t.deepEqual(filterErrorsStub.getCall(0).args, [errors],
		"ValidationError.filterErrors should be called with errors, project and yaml");

	t.is(formatMessageStub.callCount, 1, "ValidationError.formatMessage should be called once");
	t.deepEqual(formatMessageStub.getCall(0).args, [{errors: filteredErrors, project, yaml}],
		"ValidationError.formatMessage should be called with errors, project and yaml");
});

test.serial("ValidationError.filterErrors", (t) => {
	const allErrors = [
		{
			keyword: "if"
		},
		{
			dataPath: "dataPath1",
			keyword: "keyword1"
		},
		{
			dataPath: "dataPath1",
			keyword: "keyword2"
		},
		{
			dataPath: "dataPath3",
			keyword: "keyword2"
		},
		{
			dataPath: "dataPath1",
			keyword: "keyword1"
		},
		{
			dataPath: "dataPath1",
			keyword: "keyword1",
			params: {
				type: "foo"
			}
		},
		{
			dataPath: "dataPath4",
			keyword: "keyword5",
			params: {
				type: "foo"
			}
		},
		{
			dataPath: "dataPath6",
			keyword: "keyword6",
			params: {
				errors: [
					{
						"type": "foo"
					},
					{
						"type": "bar"
					}
				]
			}
		},
		{
			dataPath: "dataPath6",
			keyword: "keyword6",
			params: {
				errors: [
					{
						"type": "foo"
					},
					{
						"type": "bar"
					}
				]
			}
		},
		{
			dataPath: "dataPath6",
			keyword: "keyword6",
			params: {
				errors: [
					{
						"type": "foo"
					},
					{
						"type": "foo"
					}
				]
			}
		}
	];

	const expectedErrors = [
		{
			dataPath: "dataPath1",
			keyword: "keyword1"
		},
		{
			dataPath: "dataPath1",
			keyword: "keyword2"
		},
		{
			dataPath: "dataPath3",
			keyword: "keyword2"
		},
		{
			dataPath: "dataPath1",
			keyword: "keyword1",
			params: {
				type: "foo"
			}
		},
		{
			dataPath: "dataPath4",
			keyword: "keyword5",
			params: {
				type: "foo"
			}
		},
		{
			dataPath: "dataPath6",
			keyword: "keyword6",
			params: {
				errors: [
					{
						"type": "foo"
					},
					{
						"type": "bar"
					}
				]
			}
		},
		{
			dataPath: "dataPath6",
			keyword: "keyword6",
			params: {
				errors: [
					{
						"type": "foo"
					},
					{
						"type": "foo"
					}
				]
			}
		}
	];

	const filteredErrors = ValidationError.filterErrors(allErrors);

	t.deepEqual(filteredErrors, expectedErrors, "filterErrors should return expected errors");
});

test.serial("ValidationError.formatMessage", (t) => {
	const options = {
		errors: [{
			dataPath: "/property3",
			keyword: "errorMessage",
			message: `Error message for property3
This is just an example for an error message with multiple lines.`
		}, {
			dataPath: "/property5",
			keyword: "errorMessage",
			message: `Error message for property5
This is just an example for an error message with multiple lines.`
		}],
		project: {id: "my-project"},
		yaml: {
			path: "/my-project/ui5.yaml",
			source: dumpYaml({
				property1: "property1",
				property2: "property2",
				property3: "property3",
				property4: "property4",
				property5: "property5",
			}),
			documentIndex: 0
		}
	};

	const getYamlExtractStub = sinon.stub(ValidationError, "getYamlExtract");
	getYamlExtractStub.onFirstCall().returns(
		`/my-project/ui5.yaml:3

2: property2: property2
3: property3: property3
              ^
`
	).onSecondCall().returns(
		`/my-project/ui5.yaml:5

4: property4: property4
5: property5: property5
              ^
`
	);

	const formattedMessage = ValidationError.formatMessage(options);

	const expectedMessage =
`Invalid ui5.yaml configuration for project my-project

Error message for property3

/my-project/ui5.yaml:3

2: property2: property2
3: property3: property3
              ^

This is just an example for an error message with multiple lines.

Error message for property5

/my-project/ui5.yaml:5

4: property4: property4
5: property5: property5
              ^

This is just an example for an error message with multiple lines.`;

	t.is(formattedMessage, expectedMessage, "formatMessage should return expected string");

	t.is(getYamlExtractStub.callCount, 2, "ValidationError.getYamlExtract should be called for each error");
	t.deepEqual(getYamlExtractStub.getCall(0).args, [{error: options.errors[0], yaml: options.yaml}],
		"ValidationError.getYamlExtract should be called with error and yaml");
	t.deepEqual(getYamlExtractStub.getCall(1).args, [{error: options.errors[1], yaml: options.yaml}],
		"ValidationError.getYamlExtract should be called with error and yaml");
});
