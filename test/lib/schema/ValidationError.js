const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");
const chalk = require("chalk");

const ValidationError = require("../../../lib/schema/ValidationError");

test.afterEach.always((t) => {
	sinon.restore();
	mock.stopAll();
});

test.serial("ValidationError constructor", (t) => {
	const errors = [
		{dataPath: "", keyword: "", message: "error1", params: {}},
		{dataPath: "", keyword: "", message: "error2", params: {}}
	];
	const project = {id: "id"};
	const schema = {schema: "schema"};
	const data = {data: "data"};
	const yaml = {path: "path", source: "source", documentIndex: 0};

	const betterAjvErrors = [{error: "error1", path: "/path"}];

	const betterAjvErrorsStub = sinon.stub();
	mock("better-ajv-errors", betterAjvErrorsStub);
	betterAjvErrorsStub.returns(betterAjvErrors);

	// Re-require tested module
	const ValidationError = mock.reRequire("../../../lib/schema/ValidationError");

	const filteredErrors = [{dataPath: "", keyword: "", message: "error1", params: {}}];

	const filterErrorsStub = sinon.stub(ValidationError, "filterErrors");
	filterErrorsStub.returns(filteredErrors);

	const formatErrorsStub = sinon.stub(ValidationError.prototype, "formatErrors");
	formatErrorsStub.returns("Formatted Message");

	const validationError = new ValidationError({errors, schema, data, project, yaml});

	t.true(validationError instanceof ValidationError, "ValidationError constructor returns instance");
	t.true(validationError instanceof Error, "ValidationError inherits from Error");
	t.is(validationError.name, "ValidationError", "ValidationError should have 'name' property");

	t.deepEqual(validationError.errors, filteredErrors,
		"ValidationError should have 'errors' property with filtered errors");
	t.deepEqual(validationError.project, project, "ValidationError should have 'project' property");
	t.deepEqual(validationError.yaml, yaml, "≈ should have 'yaml' property");
	t.is(validationError.message, "Formatted Message", "ValidationError should have 'message' property");

	t.is(betterAjvErrorsStub.callCount, 1, "better-ajv-errors should be called once");
	t.deepEqual(betterAjvErrorsStub.getCall(0).args, [schema, data, filteredErrors, {format: "js"}],
		"better-ajv-errors should be called with expected args");

	t.is(filterErrorsStub.callCount, 1, "ValidationError.filterErrors should be called once");
	t.deepEqual(filterErrorsStub.getCall(0).args, [errors],
		"ValidationError.filterErrors should be called with errors, project and yaml");

	t.is(formatErrorsStub.callCount, 1, "ValidationError#formatErrors should be called once");
	t.deepEqual(formatErrorsStub.getCall(0).args, [],
		"ValidationError.formatErrors should be called without args");
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

test.serial("ValidationError.formatErrors", (t) => {
	const fakeValidationErrorInstance = {
		errors: [{}, {}],
		betterErrors: [{}, {}],
		project: {id: "my-project"}
	};

	const formatErrorStub = sinon.stub();
	formatErrorStub.onFirstCall().returns("Error message 1");
	formatErrorStub.onSecondCall().returns("Error message 2");
	fakeValidationErrorInstance.formatError = formatErrorStub;

	const message = ValidationError.prototype.formatErrors.apply(fakeValidationErrorInstance);

	const expectedMessage =
`Invalid ui5.yaml configuration for project my-project

Error message 1

Error message 2`;

	t.is(message, expectedMessage);

	t.is(formatErrorStub.callCount, 2, "formatErrorStub should be called once");
	t.deepEqual(formatErrorStub.getCall(0).args, [{
		error: fakeValidationErrorInstance.errors[0],
		betterError: fakeValidationErrorInstance.betterErrors[0]
	}], "formatErrorStub should be called with first error and first betterError");
	t.deepEqual(formatErrorStub.getCall(1).args, [{
		error: fakeValidationErrorInstance.errors[1],
		betterError: fakeValidationErrorInstance.betterErrors[1]
	}], "formatErrorStub should be called with second error and second betterError");
});

test.todo("ValidationError.formatError");

test.serial("ValidationError.getYamlExtract", (t) => {
	const error = {};
	const yaml = {
		path: "/my-project/ui5.yaml",
		source:
`property1: value1
property2: value2
property3: value3
property4: value4
property5: value5
`,
		documentIndex: 0
	};

	const analyzeYamlErrorStub = sinon.stub(ValidationError, "analyzeYamlError");
	analyzeYamlErrorStub.returns({line: 3, column: 12});

	const expectedYamlExtract =
		chalk.grey("/my-project/ui5.yaml:3") +
		"\n\n" +
		chalk.grey("1:") + " property1: value1\n" +
		chalk.grey("2:") + " property2: value2\n" +
		chalk.bgRed(chalk.grey("3:") + " property3: value3\n") +
		" ".repeat(14) + chalk.red("^");

	const yamlExtract = ValidationError.getYamlExtract({error, yaml});

	t.is(yamlExtract, expectedYamlExtract);
});

test.serial("ValidationError.getSourceExtract", (t) => {
	const yamlSource =
`property1: value1
property2: value2
`;
	const line = 2;
	const column = 1;

	const expected =
		chalk.grey("1:") + " property1: value1\n" +
		chalk.bgRed(chalk.grey("2:") + " property2: value2\n") +
		" ".repeat(3) + chalk.red("^");

	const sourceExtract = ValidationError.getSourceExtract(yamlSource, line, column);

	t.is(sourceExtract, expected, "getSourceExtract should return expected string");
});

test.serial("ValidationError.analyzeYamlError: Property", (t) => {
	const error = {dataPath: "/property3"};
	const yaml = {
		path: "/my-project/ui5.yaml",
		source:
`property1: value1
property2: value2
property3: value3
property4: value4
property5: value5
`,
		documentIndex: 0
	};

	const info = ValidationError.analyzeYamlError({error, yaml});

	t.deepEqual(info, {line: 3, column: 1},
		"analyzeYamlError should return expected results");
});

test.serial("ValidationError.analyzeYamlError: Nested property", (t) => {
	const error = {dataPath: "/property2/property3"};
	const yaml = {
		path: "/my-project/ui5.yaml",
		source:
`property1: value1
property2:
  property3: value3
property3: value3
`,
		documentIndex: 0
	};

	const info = ValidationError.analyzeYamlError({error, yaml});

	t.deepEqual(info, {line: 3, column: 3},
		"analyzeYamlError should return expected results");
});

test.serial("ValidationError.analyzeYamlError: Array", (t) => {
	const error = {dataPath: "/property/list/2/name"};
	const yaml = {
		path: "/my-project/ui5.yaml",
		source:
`property:
  list:
    - name: ' - -   -   -  -'
    - name: other - name- with- hyphens
    - name: name3
`,
		documentIndex: 0
	};

	const info = ValidationError.analyzeYamlError({error, yaml});

	t.deepEqual(info, {line: 5, column: 7},
		"analyzeYamlError should return expected results");
});


test.serial("ValidationError.analyzeYamlError: Nested array", (t) => {
	const error = {dataPath: "/items/2/subItems/1"};
	const yaml = {
		path: "/my-project/ui5.yaml",
		source:
`items:
  - subItems:
      - foo
      - bar
  - subItems:
      - foo
      - bar
  - subItems:
      - foo
      - bar
`,
		documentIndex: 0
	};

	const info = ValidationError.analyzeYamlError({error, yaml});

	t.deepEqual(info, {line: 10, column: 7},
		"analyzeYamlError should return expected results");
});

test.serial("ValidationError.analyzeYamlError: Nested property with comments", (t) => {
	const error = {dataPath: "/property1/property2/property3/property4"};
	const yaml = {
		path: "/my-project/ui5.yaml",
		source:
`property1:
  property2:
    property3:
      # property4: value4444
      property4: value4
`,
		documentIndex: 0
	};

	const info = ValidationError.analyzeYamlError({error, yaml});

	t.deepEqual(info, {line: 5, column: 7},
		"analyzeYamlError should return expected results");
});

test.serial("ValidationError.analyzeYamlError: Nested properties with same name", (t) => {
	const error = {dataPath: "/property/property/property/property"};
	const yaml = {
		path: "/my-project/ui5.yaml",
		source:
`property:
  property:
    property:
      # property: foo
      property: bar
`,
		documentIndex: 0
	};

	const info = ValidationError.analyzeYamlError({error, yaml});

	t.deepEqual(info, {line: 5, column: 7},
		"analyzeYamlError should return expected results");
});

test.serial("ValidationError.analyzeYamlError: Error keyword=required, no dataPath", (t) => {
	const error = {dataPath: "", keyword: "required"};
	const yaml = {
		path: "/my-project/ui5.yaml",
		source: ``,
		documentIndex: 0
	};

	const info = ValidationError.analyzeYamlError({error, yaml});

	t.deepEqual(info, {line: -1, column: -1},
		"analyzeYamlError should return expected results");
});

test.serial("ValidationError.analyzeYamlError: Error keyword=required", (t) => {
	const error = {dataPath: "/property2", keyword: "required"};
	const yaml = {
		path: "/my-project/ui5.yaml",
		source:
`property1: true
property2:
  property3: true
`,
		documentIndex: 0
	};

	const info = ValidationError.analyzeYamlError({error, yaml});

	t.deepEqual(info, {line: 2, column: 1},
		"analyzeYamlError should return expected results");
});

test.serial("ValidationError.analyzeYamlError: Error keyword=additionalProperties", (t) => {
	const error = {
		dataPath: "/property2",
		keyword: "additionalProperties",
		params: {
			additionalProperty: "property3"
		}
	};
	const yaml = {
		path: "/my-project/ui5.yaml",
		source:
`property1: true
property2:
  property3: true
`,
		documentIndex: 0
	};

	const info = ValidationError.analyzeYamlError({error, yaml});

	t.deepEqual(info, {line: 3, column: 3},
		"analyzeYamlError should return expected results");
});

test.serial("ValidationError.formatMessage: keyword=type dataPath=", (t) => {
	const error = {
		dataPath: "",
		keyword: "type",
		message: "should be object",
		params: {
			type: "object",
		},
		schemaPath: "#/type",
	};

	const expectedErrorMessage = "Configuration should be of type 'object'";

	const errorMessage = ValidationError.formatMessage(error);
	t.is(errorMessage, expectedErrorMessage);
});

test.serial("ValidationError.formatMessage: keyword=required w/o dataPath", (t) => {
	const error = {
		dataPath: "",
		keyword: "required",
		message: "should have required property 'specVersion'",
		params: {
			missingProperty: "specVersion",
		},
		schemaPath: "#/required",
	};
	const betterError = {
		error: " should have required property 'specVersion'",
		path: ""
	};

	const expectedErrorMessage = "Configuration should have required property 'specVersion'";

	const errorMessage = ValidationError.formatMessage(error, betterError);
	t.is(errorMessage, expectedErrorMessage);
});

test.serial("ValidationError.formatMessage: keyword=required", (t) => {
	const error = {
		keyword: "required",
		dataPath: "/metadata",
		schemaPath: "../ui5.json#/definitions/metadata/required",
		params: {missingProperty: "name"},
		message: "should have required property 'name'"
	};
	const betterError = {
		error: "/metadata should have required property 'name'",
		path: "/metadata"
	};

	const expectedErrorMessage = "/metadata should have required property 'name'";

	const errorMessage = ValidationError.formatMessage(error, betterError);
	t.is(errorMessage, expectedErrorMessage);
});

test.serial("ValidationError.formatMessage: keyword=errorMessage", (t) => {
	const error = {
		dataPath: "/specVersion",
		keyword: "errorMessage",
		message:
`Unsupported "specVersion"
Your UI5 CLI installation might be outdated.
Supported specification versions: "2.0", "1.1", "1.0", "0.1"
For details see: https://sap.github.io/ui5-tooling/pages/Configuration/#specification-versions`,
		params: {
			errors: [
				{
					dataPath: "/specVersion",
					keyword: "enum",
					message: "should be equal to one of the allowed values",
					params: {
						allowedValues: [
							"2.0",
							"1.1",
							"1.0",
							"0.1",
						],
					},
					schemaPath: "#/properties/specVersion/enum",
				},
			],
		},
		schemaPath: "#/properties/specVersion/errorMessage",
	};

	const expectedErrorMessage =
`Unsupported "specVersion"
Your UI5 CLI installation might be outdated.
Supported specification versions: "2.0", "1.1", "1.0", "0.1"
For details see: https://sap.github.io/ui5-tooling/pages/Configuration/#specification-versions`;

	const errorMessage = ValidationError.formatMessage(error, {});
	t.is(errorMessage, expectedErrorMessage);
});

test.serial("ValidationError.formatMessage: keyword=additionalProperties", (t) => {
	const error = {
		keyword: "additionalProperties",
		dataPath: "/resources/configuration",
		schemaPath: "#/properties/configuration/additionalProperties",
		params: {additionalProperty: "propertiesFileEncoding"},
		message: "should NOT have additional properties"
	};
	const betterError = {
		error: "/resources/configuration Property propertiesFileEncoding is not expected to be here",
		path: "/resources/configuration"
	};

	const expectedErrorMessage =
`/resources/configuration Property propertiesFileEncoding is not expected to be here`;

	const errorMessage = ValidationError.formatMessage(error, betterError);
	t.is(errorMessage, expectedErrorMessage);
});

test.serial("ValidationError.formatMessage: keyword=enum", (t) => {
	const error = {
		keyword: "enum",
		dataPath: "/type",
		schemaPath: "#/properties/type/enum",
		params: {
			allowedValues: ["application", "library", "theme-library", "module"]
		},
		message: "should be equal to one of the allowed values"
	};
	const betterError = {
		error: "/type should be equal to one of the allowed values: application, library, theme-library, module",
		path: "/type",
		suggestion: "Did you mean library?"
	};

	const expectedErrorMessage =
`/type should be equal to one of the allowed values
Allowed values: application, library, theme-library, module
Did you mean library?`;

	const errorMessage = ValidationError.formatMessage(error, betterError);
	t.is(errorMessage, expectedErrorMessage);
});

test.serial.skip("ValidationError.formatMessage: keyword=pattern", (t) => {
	const error = {};
	const betterError = {};

	const expectedErrorMessage =
``;

	const errorMessage = ValidationError.formatMessage(error, betterError);
	t.is(errorMessage, expectedErrorMessage);
});

/*
test.serial("ValidationError.formatMessage: keyword=pattern", (t) => {
	const error = {};
	const betterError = {};

	const expectedErrorMessage =
``;

	const errorMessage = ValidationError.formatMessage(error, betterError);
	t.is(errorMessage, expectedErrorMessage);
});
*/
