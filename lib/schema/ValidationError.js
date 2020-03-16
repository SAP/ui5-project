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
		return {
			line: 3,
			column: 14
		};
	}

	static getSourceExtract(yamlSource, line, column) {
		let source = "";
		const lines = yamlSource.split("\n");
		const lineIndex = line - 1;
		const start = Math.max(lineIndex - 2, 0);
		const end = Math.min(lineIndex, lines.length - 1);

		for (let i = start; i <= end; i++) {
			const currentLine = lines[i];
			let string = chalk.gray(i+1 + ":") + " " + currentLine + "\n";
			if (i === lineIndex) {
				string = chalk.bgRed(string);
			}
			source += string;
		}

		source += " ".repeat(column) + chalk.red("^");

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
