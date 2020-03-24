/* eslint-disable no-console */

const path = require("path");
const {promisify} = require("util");
const fs = require("fs");
const writeFile = promisify(fs.writeFile);
const mkdirp = require("mkdirp");
const $RefParser = require("@apidevtools/json-schema-ref-parser");

const SOURCE_SCHEMA_PATH = path.join(__dirname, "..", "lib", "validation", "schema", "ui5.json");
const TARGET_SCHEMA_PATH = path.join(__dirname, "..", "dist", "schema", "ui5.yaml.json");

async function main() {
	const parser = new $RefParser();
	const schema = await parser.dereference(SOURCE_SCHEMA_PATH);

	await mkdirp(path.dirname(TARGET_SCHEMA_PATH));
	await writeFile(TARGET_SCHEMA_PATH, JSON.stringify(schema, null, 2));

	console.log("Wrote self contained schema file to " + TARGET_SCHEMA_PATH);
}

main().catch((error) => {
	console.log(error);
	process.exit(1);
});

