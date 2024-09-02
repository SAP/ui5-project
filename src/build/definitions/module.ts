import type Module from "../../specifications/types/Module.js";
import {type ProjectBuildDefinition} from "../TaskRunner.js";

const libraryDefinition: ProjectBuildDefinition<Module> = function () {
	return new Map();
};

export default libraryDefinition;
