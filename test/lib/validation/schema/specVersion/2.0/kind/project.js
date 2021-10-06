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
		validationError.errors.forEach((error) => {
			delete error.schemaPath;
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
		lines: 90
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
		instancePath: "",
		keyword: "required",
		message: "must have required property 'type'",
		params: {
			missingProperty: "type",
		}
	}]);
});

test("No type, no kind", async (t) => {
	await assertValidation(t, {
		"specVersion": "2.0",
		"metadata": {
			"name": "my-project"
		}
	}, [{
		instancePath: "",
		keyword: "required",
		message: "must have required property 'type'",
		params: {
			missingProperty: "type",
		}
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
		instancePath: "/type",
		keyword: "enum",
		message: "must be equal to one of the allowed values",
		params: {
			allowedValues: [
				"application",
				"library",
				"theme-library",
				"module",
			],
		}
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
		instancePath: "",
		keyword: "required",
		message: "must have required property 'specVersion'",
		params: {
			missingProperty: "specVersion",
		}
	}]);
});
