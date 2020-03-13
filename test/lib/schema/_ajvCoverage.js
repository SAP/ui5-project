// Inspired by https://github.com/epoberezkin/ajv-istanbul

const beautify = require("js-beautify").js_beautify;
const libReport = require("istanbul-lib-report");
const reports = require("istanbul-reports");
const libCoverage = require("istanbul-lib-coverage");
const {createInstrumenter} = require("istanbul-lib-instrument");
const rFileName = new RegExp(/sourceURL=http:\/\/ui5\.sap\/([^\s]*)/);

module.exports = function(Ajv, options) {
	const instrumenter = createInstrumenter({});
	const sources = {};

	function processCode(originalCode) {
		if (originalCode.includes("sourceURL=http://json-schema.org/draft-07/schema#")) {
			// Don't instrument JSON Schema
			return originalCode;
		}

		const beautifiedCode = beautify(originalCode, {indent_size: 2});

		let fileName;
		const fileNameMatch = rFileName.exec(beautifiedCode);
		if (fileNameMatch) {
			fileName = fileNameMatch[1].replace(/\//g, "_") + ".js";
		}

		const instrumentedCode = instrumenter.instrumentSync(beautifiedCode, fileName);

		const sourceMap = instrumenter.lastSourceMap();
		if (!fileName) {
			fileName = sourceMap.sources[0];
		}

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

	const ajv = new Ajv(Object.assign({}, options, {
		processCode
	}));

	return {ajv, createReport};
};
