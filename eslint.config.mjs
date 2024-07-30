import {fixupConfigRules, fixupPluginRules} from "@eslint/compat";
import jsdoc from "eslint-plugin-jsdoc";
import ava from "eslint-plugin-ava";
import globals from "globals";
import path from "node:path";
import {fileURLToPath} from "node:url";
import js from "@eslint/js";
import {FlatCompat} from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all
});

export default [{
	ignores: [
		"**/coverage/",
		"test/tmp/",
		"test/expected/",
		"test/fixtures/",
		"**/docs/",
		"**/jsdocs/",
	],
}, ...fixupConfigRules(compat.extends("eslint:recommended", "plugin:ava/recommended", "google")), {
	plugins: {
		jsdoc,
		ava: fixupPluginRules(ava),
	},

	languageOptions: {
		globals: {
			...globals.node,
		},

		ecmaVersion: 2023,
		sourceType: "module",
	},

	settings: {
		jsdoc: {
			mode: "jsdoc",

			tagNamePreference: {
				return: "returns",
				augments: "extends",
			},
		},
	},

	rules: {
		"indent": ["error", "tab"],
		"linebreak-style": ["error", "unix"],

		"quotes": ["error", "double", {
			allowTemplateLiterals: true,
		}],

		"semi": ["error", "always"],
		"no-negated-condition": "off",
		"require-jsdoc": "off",
		"no-mixed-requires": "off",

		"max-len": ["error", {
			code: 120,
			ignoreUrls: true,
			ignoreRegExpLiterals: true,
		}],

		"no-implicit-coercion": [2, {
			allow: ["!!"],
		}],

		"comma-dangle": "off",
		"no-tabs": "off",
		"valid-jsdoc": 0,
		"jsdoc/check-examples": 0,
		"jsdoc/check-param-names": 2,
		"jsdoc/check-tag-names": 2,
		"jsdoc/check-types": 2,
		"jsdoc/no-undefined-types": 0,
		"jsdoc/require-description": 0,
		"jsdoc/require-description-complete-sentence": 0,
		"jsdoc/require-example": 0,
		"jsdoc/require-hyphen-before-param-description": 0,
		"jsdoc/require-param": 2,
		"jsdoc/require-param-description": 0,
		"jsdoc/require-param-name": 2,
		"jsdoc/require-param-type": 2,
		"jsdoc/require-returns": 0,
		"jsdoc/require-returns-description": 0,
		"jsdoc/require-returns-type": 2,

		"jsdoc/tag-lines": [2, "any", {
			startLines: 1,
		}],

		"jsdoc/valid-types": 0,
		"ava/assertion-arguments": 0,
	},
}];
