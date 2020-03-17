const chalk = require("chalk");
const escapeStringRegExp = require("escape-string-regexp");
const betterAjvErrors = require("better-ajv-errors");

class ValidationError extends Error {
	constructor({errors, schema, data, project, yaml}) {
		super();

		this.name = "ValidationError";

		this.schema = schema;
		this.data = data;
		this.project = project;
		this.yaml = yaml;
		this.errors = ValidationError.filterErrors(errors);
		this.betterErrors = betterAjvErrors(this.schema, this.data, this.errors, {
			format: "js"
		});

		this.message = this.formatErrors();

		Error.captureStackTrace(this, this.constructor);
	}

	formatErrors() {
		let message = `Invalid ui5.yaml configuration for project ${this.project.id}\n\n`;
		message += this.errors.map((error, i) => {
			return this.formatError({error, betterError: this.betterErrors[i]});
		}).join("\n\n");
		return message;
	}

	formatError({error, betterError}) {
		let errorMessage = ValidationError.formatMessage(error, betterError);
		if (this.yaml && this.yaml.path && this.yaml.source) {
			const yamlExtract = ValidationError.getYamlExtract({error, yaml: this.yaml});
			const errorLines = errorMessage.split("\n");
			errorLines.splice(1, 0, "\n" + yamlExtract);
			errorMessage = errorLines.join("\n");
		}
		return errorMessage;
	}

	static formatMessage(error, betterError) {
		let message = "";

		if (error.keyword === "errorMessage") {
			return error.message;
		}

		if (error.keyword === "required") {
			if (error.dataPath === "") {
				message += "Configuration";
			}
			message += betterError.error;
		} else if (error.keyword === "type" && error.dataPath === "") {
			if (error.dataPath === "") {
				message += "Configuration ";
			}
			message += `should be of type '${error.params.type}'`;
		} else if (error.keyword === "enum") {
			message += error.dataPath + " " + error.message + "\n";
			message += "Allowed values: " + error.params.allowedValues.join(", ");
			if (betterError.suggestion) {
				message += "\n" + betterError.suggestion;
			}
		} else {
			message += betterError.error;
			if (betterError.suggestion) {
				message += "\n" + betterError.suggestion;
			}
		}

		return message;
	}

	static _findDuplicateError(error, errorIndex, errors) {
		const foundIndex = errors.findIndex(($) => {
			if ($.dataPath !== error.dataPath) {
				return false;
			} else if ($.keyword !== error.keyword) {
				return false;
			} else if (JSON.stringify($.params) !== JSON.stringify(error.params)) {
				return false;
			} else {
				return true;
			}
		});
		return foundIndex !== errorIndex;
	}

	static filterErrors(allErrors) {
		return allErrors.filter((error, i, errors) => {
			if (error.keyword === "if") {
				return false;
			}

			return !ValidationError._findDuplicateError(error, i, errors);
		});
	}

	static analyzeYamlError({error, yaml}) {
		if (error.dataPath === "" && error.keyword === "required") {
			return {line: -1, column: -1};
		}

		// Skip leading /
		const objectPath = error.dataPath.substr(1).split("/");

		if (error.keyword === "additionalProperties") {
			objectPath.push(error.params.additionalProperty);
		}

		let currentIndex = 0;
		let currentSubstring = yaml.source;
		for (let i = 0; i < objectPath.length; i++) {
			const property = objectPath[i];
			let newIndex;

			if (isNaN(property)) {
				const propertyRegExp = new RegExp(`^[^#]*?${escapeStringRegExp(property)}`, "m");
				const propertyMatch = propertyRegExp.exec(currentSubstring);
				if (!propertyMatch) {
					return {line: -1, column: -1};
				}
				newIndex = propertyMatch.index + propertyMatch[0].length;
			} else {
				const arrayIndex = parseInt(property);
				const matchArrayElement = /(^|\n)([ ]*-[^\n]*)/g;
				const arrayIndicators = currentSubstring.matchAll(matchArrayElement);
				let a = 0;
				let firstIndentation = -1;
				for (const match of arrayIndicators) {
					const indentationMatch = match[2].match(/([ ]*)-/);
					if (!indentationMatch) {
						return {line: -1, column: -1};
					}
					const currentIndentation = indentationMatch[1].length;
					if (firstIndentation === -1) {
						firstIndentation = currentIndentation;
					} else if (currentIndentation !== firstIndentation) {
						continue;
					}
					if (a === arrayIndex) {
						// match[1] might be a line-break
						newIndex = match.index + match[1].length + currentIndentation;
						break;
					}
					a++;
				}
				if (!newIndex) {
					// Could not find array element
					return {line: -1, column: -1};
				}
			}
			currentIndex += newIndex;
			currentSubstring = yaml.source.substring(currentIndex);
		}

		const linesUntilMatch = yaml.source.substring(0, currentIndex).split("\n");
		const line = linesUntilMatch.length;
		let column = linesUntilMatch[line - 1].length + 1;
		const lastPathSegment = objectPath[objectPath.length - 1];
		if (isNaN(lastPathSegment)) {
			column -= lastPathSegment.length;
		}

		return {
			line,
			column
		};
	}

	static getSourceExtract(yamlSource, line, column) {
		let source = "";
		const lines = yamlSource.split("\n");

		// Using line numbers instead of array indices
		const startLine = Math.max(line - 2, 1);
		const endLine = Math.min(line, lines.length);
		const padLength = String(endLine).length;

		for (let currentLine = startLine; currentLine <= endLine; currentLine++) {
			const currentLineContent = lines[currentLine - 1];
			let string = chalk.gray(
				String(currentLine).padStart(padLength, "0") + ":"
			) + " " + currentLineContent + "\n";
			if (currentLine === line) {
				string = chalk.bgRed(string);
			}
			source += string;
		}

		source += " ".repeat(column + padLength + 1) + chalk.red("^");

		return source;
	}

	static getYamlExtract({error, yaml}) {
		const {line, column} = ValidationError.analyzeYamlError({error, yaml});
		if (line !== -1 && column !== -1) {
			return chalk.grey(yaml.path + ":" + line) +
				"\n\n" + ValidationError.getSourceExtract(yaml.source, line, column);
		} else {
			return chalk.grey(yaml.path) + "\n";
		}
	}
}

module.exports = ValidationError;
