import type ThemeLibrary from "../../specifications/types/ThemeLibrary.js";
import {type ProjectBuildDefinition, type StandardTaskDefinition} from "../TaskRunner.js";

const libraryDefinition: ProjectBuildDefinition<ThemeLibrary> = function ({project, taskUtil}) {
	const tasks = new Map<string, StandardTaskDefinition>();
	tasks.set("replaceCopyright", {
		options: {
			copyright: project.getCopyright(),
			pattern: "/resources/**/*.{less,theme}",
		},
	});

	tasks.set("replaceVersion", {
		options: {
			version: project.getVersion(),
			pattern: "/resources/**/*.{less,theme}",
		},
	});

	tasks.set("buildThemes", {
		requiresDependencies: true,
		options: {
			projectName: project.getName(),
			librariesPattern: !taskUtil.isRootProject() ? "/resources/**/(*.library|library.js)" : undefined,
			themesPattern: !taskUtil.isRootProject() ? "/resources/sap/ui/core/themes/*" : undefined,
			inputPattern: "/resources/**/themes/*/library.source.less",
			cssVariables: taskUtil.getBuildOption("cssVariables"),
		},
	});

	if (project.isFrameworkProject()) {
		tasks.set("generateThemeDesignerResources", {
			requiresDependencies: true,
			options: {
				version: project.getVersion(),
			},
		});
	} else {
		tasks.set("generateThemeDesignerResources", {taskFunction: null});
	}

	tasks.set("generateResourcesJson", {requiresDependencies: true});
	return tasks;
};

export default libraryDefinition;
