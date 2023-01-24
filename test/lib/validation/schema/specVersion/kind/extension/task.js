import test from "ava";
import Ajv from "ajv";
import ajvErrors from "ajv-errors";
import AjvCoverage from "../../../../../../utils/AjvCoverage.js";
import {_Validator as Validator} from "../../../../../../../lib/validation/validator.js";
import ValidationError from "../../../../../../../lib/validation/ValidationError.js";
import extension from "../../../__helper__/extension.js";

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
	t.context.validator = new Validator({Ajv, ajvErrors, schemaName: "ui5"});
	t.context.ajvCoverage = new AjvCoverage(t.context.validator.ajv, {
		includes: ["schema/specVersion/kind/extension/task.json"]
	});
});

test.after.always((t) => {
	t.context.ajvCoverage.createReport("html", {dir: "coverage/ajv-extension-task"});
	const thresholds = {
		statements: 70,
		branches: 55,
		functions: 100,
		lines: 70
	};
	t.context.ajvCoverage.verify(thresholds);
});

["3.0"].forEach(function(specVersion) {
	test(`Invalid project name (specVersion ${specVersion})`, async (t) => {
		await assertValidation(t, {
			"specVersion": specVersion,
			"kind": "extension",
			"type": "task",
			"metadata": {
				"name": "illegal-🦜"
			},
			"task": {
				"path": "/bar"
			}
		}, [{
			dataPath: "/metadata/name",
			keyword: "pattern",
			message: `should match pattern "^(?:@[0-9a-z-_.]+/)?[a-z][0-9a-z-_.]*$"`,
			params: {
				pattern: `^(?:@[0-9a-z-_.]+/)?[a-z][0-9a-z-_.]*$`,
			},
		}]);
		await assertValidation(t, {
			"specVersion": specVersion,
			"kind": "extension",
			"type": "task",
			"metadata": {
				"name": "a"
			},
			"task": {
				"path": "/bar"
			}
		}, [{
			dataPath: "/metadata/name",
			keyword: "minLength",
			message: `should NOT be shorter than 3 characters`,
			params: {
				limit: 3,
			},
		}]);
		await assertValidation(t, {
			"specVersion": specVersion,
			"kind": "extension",
			"type": "task",
			"metadata": {
				"name": "a".repeat(51)
			},
			"task": {
				"path": "/bar"
			}
		}, [{
			dataPath: "/metadata/name",
			keyword: "maxLength",
			message: `should NOT be longer than 50 characters`,
			params: {
				limit: 50,
			},
		}]);
	});
});

const additionalConfiguration = {
	"task": {
		"path": "/foo"
	}
};

extension.defineTests(test, assertValidation, "task", additionalConfiguration);
