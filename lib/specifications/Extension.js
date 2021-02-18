const AbstractSpecification = require("./AbstractSpecification");

class Extension extends AbstractSpecification {
	constructor(parameters) {
		super(parameters);
		if (new.target === Extension) {
			throw new TypeError("Class 'Project' is abstract");
		}
	}

	/*
	* TODO
	*/
}

module.exports = Extension;
