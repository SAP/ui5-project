/**
 * Get tasks and their configuration for a given application project
 *
 * @param parameters
 * @param parameters.project
 * @param parameters.taskUtil
 * @param parameters.getTask
 */
export default function ({project, taskUtil, getTask}: {
	project: object;
	taskUtil: object;
	getTask: Function;
}) {
	const tasks = new Map();
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
}
