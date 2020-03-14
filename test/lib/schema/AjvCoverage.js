// Inspired by https://github.com/epoberezkin/ajv-istanbul

const path = require("path");
const crypto = require("crypto");
const beautify = require("js-beautify").js_beautify;
const libReport = require("istanbul-lib-report");
const reports = require("istanbul-reports");
const libCoverage = require("istanbul-lib-coverage");
const {createInstrumenter} = require("istanbul-lib-instrument");
const rFileName = new RegExp(/sourceURL=http:\/\/ui5\.sap\/schema\/([^\s]*)/);
const basePath = path.join(__dirname, "..", "..", "..", "lib", "schema");


const rRootDataUndefined = /\n(?:\s)*if \(rootData === undefined\) rootData = data;/g;
const rEnsureErrorArray = /\n(?:\s)*if \(vErrors === null\) vErrors = \[err\];(?:\s)*else vErrors\.push\(err\);/g;
const rDataPathOrEmptyString = /dataPath: \(dataPath \|\| ''\)/g;

function insertIgnoreComments(code) {
	code = code.replace(rRootDataUndefined, "\n/* istanbul ignore next */$&");
	code = code.replace(rEnsureErrorArray, "\n/* istanbul ignore next */$&");
	code = code.replace(rDataPathOrEmptyString, "dataPath: (dataPath || /* istanbul ignore next */ '')");
	return code;
}

module.exports = function(Ajv, options) {
	const instrumenter = createInstrumenter({});
	const sources = {};

	function processCode(originalCode) {
		if (originalCode.includes("sourceURL=http://json-schema.org/draft-07/schema#")) {
			// Don't instrument JSON Schema
			return originalCode;
		}

		const beautifiedCode = insertIgnoreComments(beautify(originalCode, {indent_size: 2}));

		let fileName;
		const fileNameMatch = rFileName.exec(beautifiedCode);
		if (fileNameMatch) {
			fileName = fileNameMatch[1].replace(/\.json$/, ".js");
		} else {
			fileName = crypto.createHash("sha1").update(originalCode).digest("hex").substr(0, 16) + ".js";
		}

		fileName = path.join(basePath, fileName);

		const instrumentedCode = instrumenter.instrumentSync(beautifiedCode, fileName);

		sources[fileName] = beautifiedCode;

		return instrumentedCode;
	}

	function createReport(globalCoverageVar) {
		const coverageMap = libCoverage.createCoverageMap(globalCoverageVar);

		const context = libReport.createContext({
			dir: "coverage/ajv",
			coverageMap,
			sourceFinder: function(filePath) {
				return sources[filePath];
			}
		});

		const report = reports.create("html", {});

		report.execute(context);
	}


	function getSummary(globalCoverageVar, thresholds) {
		const coverageMap = libCoverage.createCoverageMap(globalCoverageVar);
		const summary = libCoverage.createCoverageSummary();

		const files = coverageMap.files();
		files.forEach(function(file) {
			const fileCoverageSummary = coverageMap.fileCoverageFor(file).toSummary();
			summary.merge(fileCoverageSummary);
		});

		if (files.length === 0 || summary.lines.covered === 0) {
			throw new Error("AjvCoverage#getSummary: No coverage data found!");
		}

		return {
			branches: summary.branches.pct,
			lines: summary.lines.pct,
			statements: summary.statements.pct,
			functions: summary.functions.pct
		};
	}

	function verify(globalCoverageVar, thresholds) {
		const thresholdEntries = Object.entries(thresholds);
		if (thresholdEntries.length === 0) {
			throw new Error("AjvCoverage#verify: No thresholds defined!");
		}

		const summary = getSummary(globalCoverageVar);
		const errors = [];

		thresholdEntries.forEach(function([threshold, expectedPct]) {
			const pct = summary[threshold];
			if (pct === undefined) {
				errors.push(`Invalid coverage threshold '${threshold}'`);
			} else if (pct < expectedPct) {
				errors.push(
					`Coverage for '${threshold}' (${pct}%) ` +
					`does not meet global threshold (${expectedPct}%)`);
			}
		});

		if (errors.length > 0) {
			const errorMessage = "ERROR:\n" + errors.join("\n");
			throw new Error(errorMessage);
		}
	}

	const ajv = new Ajv(Object.assign({}, options, {
		processCode
	}));

	return {ajv, createReport, getSummary, verify};
};
