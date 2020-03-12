const test = require("ava");

const validate = require("../../../lib/schema/validate");

function assertValidation(t, data, expectedErrors = undefined) {
	const errors = validate(data);
	if (expectedErrors) {
		t.is(errors.length, expectedErrors.length);
		t.deepEqual(errors, expectedErrors);
	} else {
		t.is(errors, undefined);
	}
}

test("Missing specVersion, type, metadata", (t) => {
	assertValidation(t, {}, [
		{
			dataPath: "",
			keyword: "required",
			message: "should have required property 'specVersion'",
			params: {
				missingProperty: "specVersion",
			},
			schemaPath: "#/required"
		},
		{
			dataPath: "",
			keyword: "required",
			message: "should have required property 'metadata'",
			params: {
				missingProperty: "metadata",
			},
			schemaPath: "#/required"
		},
		{
			dataPath: "",
			keyword: "required",
			message: "should have required property 'type'",
			params: {
				missingProperty: "type",
			},
			schemaPath: "#/required"
		}

	]);
});

test("type: library", (t) => {
	assertValidation(t, {
		"specVersion": "2.0",
		"type": "library",
		"metadata": {
			"name": "my-library"
		}
	});
});

