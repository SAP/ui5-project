const chalk = require("chalk");

class ValidationError extends Error {
	constructor({errors, project, yaml}) {
		super();

		this.name = "ValidationError";

		this.errors = ValidationError.filterErrors(errors);
		this.project = project;
		this.yaml = yaml;

		this.message = ValidationError.formatMessage({
			errors: this.errors,
			project: this.project,
			yaml: this.yaml
		});

		Error.captureStackTrace(this, this.constructor);
	}

	static formatMessage({errors, project, yaml}) {
		let message = `Invalid ui5.yaml configuration for project ${project.id}\n`;
		message += errors.map((error) => {
			let errorMessage = error.message;
			if (yaml && yaml.path && yaml.source) {
				const errorLines = errorMessage.split("\n");
				const yamlExtract = ValidationError.getYamlExtract({error, yaml});
				errorLines.splice(1, 0, "\n" + yamlExtract);
				errorMessage = errorLines.join("\n");
			}
			return "\n" + errorMessage;
		}).join("\n");
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
		if (!error.dataPath) {
			throw new Error("TODO: no dataPath");
		}

		// Skip leading /
		const objectPath = error.dataPath.substr(1).split("/");

		if (error.keyword === "additionalProperties") {
			objectPath.push(error.params.additionalProperty);
		}

		let currentIndex = 0;
		for (let i = 0; i < objectPath.length; i++) {
			const property = objectPath[i];
			let newIndex;

			if (isNaN(property)) {
				newIndex = yaml.source.indexOf(property, currentIndex);
				if (newIndex === -1) {
					throw new Error(`Unable to find "${property}" within yaml:\n${yaml.source.substr(currentIndex)}`);
				}
			} else {
				const arrayIndex = parseInt(property);
				const matchArrayElement = /(^|\n)([ ]*-[^\n]*)/g;
				const yamlSubstring = yaml.source.substr(currentIndex);
				const arrayIndicators = yamlSubstring.matchAll(matchArrayElement);
				let a = 0;
				let firstIndentation = -1;
				for (const match of arrayIndicators) {
					const indentationMatch = match[2].match(/([ ]*)-/);
					if (!indentationMatch) {
						throw new Error("Unable to find indentation!");
					}
					const currentIndentation = indentationMatch[1].length;
					if (firstIndentation === -1) {
						firstIndentation = currentIndentation;
					} else if (currentIndentation !== firstIndentation) {
						continue;
					}
					if (a === arrayIndex) {
						// match[1] might be a line-break
						newIndex = currentIndex + match.index + match[1].length + currentIndentation;
						break;
					}
					a++;
				}
				if (!newIndex) {
					throw new Error("Could not find array element!");
				}
			}
			currentIndex = newIndex;
		}

		const linesUntilMatch = yaml.source.substring(0, currentIndex).split("\n");
		const line = linesUntilMatch.length;
		const column = linesUntilMatch[line - 1].length + 1;

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
		const sourceExtract = ValidationError.getSourceExtract(yaml.source, line, column);
		return chalk.grey(yaml.path + ":" + line) +
			"\n\n" +
			sourceExtract;
	}
}

module.exports = ValidationError;
