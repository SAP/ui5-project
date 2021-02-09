const test = require("ava");
const AjvCoverage = require("../../../../../../utils/AjvCoverage");
const {_Validator: Validator} = require("../../../../../../../lib/validation/validator");
const ValidationError = require("../../../../../../../lib/validation/ValidationError");

async function assertValidation(t, config, expectedErrors = undefined) {
	const validation = t.context.validator.validate({config, project: {id: "my-project"}});
	if (expectedErrors) {
		const validationError = await t.throwsAsync(validation, {
			instanceOf: ValidationError,
			name: "ValidationError"
		});
		t.deepEqual(validationError.errors, expectedErrors);
	} else {
		await t.notThrowsAsync(validation);
	}
}

test.before((t) => {
	t.context.validator = new Validator();
	t.context.ajvCoverage = new AjvCoverage(t.context.validator.ajv, {
		includes: ["schema/specVersion/2.0/kind/project.json"]
	});
});

test.after.always((t) => {
	t.context.ajvCoverage.createReport("html", {dir: "coverage/ajv-project"});
	const thresholds = {
		statements: 85,
		branches: 75,
		functions: 100,
		lines: 88
	};
	t.context.ajvCoverage.verify(thresholds);
});

test("Type application", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "project",
		"type": "application",
		"metadata": {
			"name": "my-application"
		}
	});
});

test("Type application (no kind)", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "application",
		"metadata": {
			"name": "my-application"
		}
	});
});
test("Type application (kind null)", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "application",
		"kind": null,
		"metadata": {
			"name": "my-application"
		}
	});
});

test("Type library", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "project",
		"type": "library",
		"metadata": {
			"name": "my-library"
		}
	});
});

test("Type library (no kind)", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "library",
		"metadata": {
			"name": "my-library"
		}
	});
});

test("Type theme-library", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "project",
		"type": "theme-library",
		"metadata": {
			"name": "my-theme-library"
		}
	});
});

test("Type theme-library (no kind)", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "theme-library",
		"metadata": {
			"name": "my-theme-library"
		}
	});
});

test("Type module", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "project",
		"type": "module",
		"metadata": {
			"name": "my-module"
		}
	});
});

test("Type module (no kind)", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"type": "module",
		"metadata": {
			"name": "my-module"
		}
	});
});

test("No type", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "project",
		"metadata": {
			"name": "my-project"
		}
	}, [{
		dataPath: "",
		keyword: "required",
		message: "should have required property 'type'",
		params: {
			missingProperty: "type",
		},
		schemaPath: "#/required",
	}]);
});

test("No type, no kind", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"metadata": {
			"name": "my-project"
		}
	}, [{
		dataPath: "",
		keyword: "required",
		message: "should have required property 'type'",
		params: {
			missingProperty: "type",
		},
		schemaPath: "#/required",
	}]);
});

test("Invalid type", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "project",
		"type": "foo",
		"metadata": {
			"name": "my-project"
		}
	}, [{
		dataPath: "/type",
		keyword: "enum",
		message: "should be equal to one of the allowed values",
		params: {
			allowedValues: [
				"application",
				"library",
				"theme-library",
				"module",
			],
		},
		schemaPath: "#/properties/type/enum",
	}]);
});

test("Invalid kind", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"kind": "foo",
		"metadata": {
			"name": "my-project"
		}
	}, [{
		dataPath: "/kind",
		keyword: "enum",
		message: "should be equal to one of the allowed values",
		params: {
			allowedValues: [
				"project",
				"extension",
				null
			],
		},
		schemaPath: "#/properties/kind/enum",
	}]);
});

test("No specVersion", async (t) => {
	await assertValidation(t, {
		"kind": "project",
		"type": "library",
		"metadata": {
			"name": "my-library"
		}
	}, [{
		dataPath: "",
		keyword: "required",
		message: "should have required property 'specVersion'",
		params: {
			missingProperty: "specVersion",
		},
		schemaPath: "#/required",
	}]);
});
