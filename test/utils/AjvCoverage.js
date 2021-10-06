// Inspired by https://github.com/epoberezkin/ajv-istanbul

const crypto = require("crypto");
const beautify = require("js-beautify").js_beautify;
const libReport = require("istanbul-lib-report");
const reports = require("istanbul-reports");
const libCoverage = require("istanbul-lib-coverage");
const {createInstrumenter} = require("istanbul-lib-instrument");

const rRootDataUndefined = /\n(?:\s)*if \(rootData === undefined\) rootData = data;/g;
const rEnsureErrorArray = /\n(?:\s)*if \(vErrors === null\) {(?:\s)*vErrors = \[err[0-9]*\];(?:\s)*} else {(?:\s)*vErrors\.push\(err[0-9]*\);/g;

function hash(content) {
	return crypto.createHash("sha1").update(content).digest("hex").substr(0, 16);
}

function randomCoverageVar() {
	return "__ajv-coverage__" + hash((String(Date.now()) + Math.random()));
}

class AjvCoverage {
	constructor(ajv, options = {}) {
		this.ajv = ajv;
		this.ajv.opts.code.process = this._processCode.bind(this);
		if (options.meta === true) {
			this.ajv._metaOpts.code.process = this._processCode.bind(this);
		}
		this._processFileName = options.processFileName;
		this._includes = options.includes;
		this._sources = {};
		this._globalCoverageVar = options.globalCoverage === true ? "__coverage__" : randomCoverageVar();
		this._instrumenter = createInstrumenter({
			coverageVariable: this._globalCoverageVar
		});
	}
	getSummary() {
		const coverageMap = this._createCoverageMap();
		const summary = libCoverage.createCoverageSummary();

		const files = coverageMap.files();
		files.forEach(function(file) {
			const fileCoverageSummary = coverageMap.fileCoverageFor(file).toSummary();
			summary.merge(fileCoverageSummary);
			return;
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
	verify(thresholds) {
		const thresholdEntries = Object.entries(thresholds);
		if (thresholdEntries.length === 0) {
			throw new Error("AjvCoverage#verify: No thresholds defined!");
		}

		const summary = this.getSummary();
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
	createReport(name, contextOptions = {}, reportOptions = {}) {
		const coverageMap = this._createCoverageMap();
		const context = libReport.createContext(Object.assign({}, contextOptions, {
			coverageMap,
			sourceFinder: (filePath) => {
				if (this._sources[filePath]) {
					return this._sources[filePath];
				}
				const sourceFinder = contextOptions.sourceFinder;
				if (typeof sourceFinder === "function") {
					return sourceFinder(filePath);
				}
			}
		}));
		const report = reports.create(name, reportOptions);
		report.execute(context);
	}
	_createCoverageMap() {
		return libCoverage.createCoverageMap(global[this._globalCoverageVar]);
	}
	_processCode(originalCode, schemaEnv) {
		let fileName = schemaEnv.baseId + "-" + schemaEnv.validateName.str;

		if (typeof this._processFileName === "function") {
			fileName = this._processFileName.call(null, fileName);
		}

		if (this._includes && this._includes.every((pattern) => !fileName.includes(pattern))) {
			return originalCode;
		}

		const code = AjvCoverage.insertIgnoreComments(beautify(originalCode, {indent_size: 2}));
		const instrumentedCode = this._instrumenter.instrumentSync(code, fileName);
		this._sources[fileName] = code;
		return instrumentedCode;
	}
	static insertIgnoreComments(code) {
		code = code.replace(rRootDataUndefined, "\n/* istanbul ignore next */$&");
		code = code.replace(rEnsureErrorArray, "\n/* istanbul ignore next */$&");
		return code;
	}
}

module.exports = AjvCoverage;
