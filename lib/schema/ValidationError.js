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

			if (isNaN(property)) {
				const propertyIndex = yaml.source.indexOf(property, currentIndex);
				if (propertyIndex === -1) {
					throw new Error(`Unable to find "${property}" within yaml:\n${yaml.source.substr(currentIndex)}`);
				}
				currentIndex = propertyIndex;
			} else {
				throw new Error("TODO: Arrays");
				// const nextProperty = objectPath[i + 1];
			}
		}

		const line = yaml.source.substring(0, currentIndex).split("\n").length;
		const lineString = yaml.source.split("\n")[line - 1];
		const column = lineString.indexOf(objectPath[objectPath.length - 1]) + 1;

		return {
			line,
			column
		};
	}

	static getSourceExtract(yamlSource, line, column) {
		let source = "";
		const lines = yamlSource.split("\n");
		const startLine = Math.max(line - 2, 0);
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
