const AbstractBuilder = require("./AbstractBuilder");

class ThemeLibraryBuilder extends AbstractBuilder {
	addStandardTasks({resourceCollections, project, log, taskUtil, getTask}) {
		this.addTask("replaceCopyright", async () => {
			return getTask("replaceCopyright").task({
				workspace: resourceCollections.workspace,
				options: {
					copyright: project.getCopyright(),
					pattern: "/resources/**/*.{less,theme}"
				}
			});
		});

		this.addTask("replaceVersion", async () => {
			return getTask("replaceVersion").task({
				workspace: resourceCollections.workspace,
				options: {
					version: project.getVersion(),
					pattern: "/resources/**/*.{less,theme}"
				}
			});
		});

		this.addTask("buildThemes", async () => {
			return getTask("buildThemes").task({
				workspace: resourceCollections.workspace,
				dependencies: resourceCollections.dependencies,
				options: {
					projectName: project.getName(),
					librariesPattern: !taskUtil.isRootProject() ? "/resources/**/(*.library|library.js)" : undefined,
					themesPattern: !taskUtil.isRootProject() ? "/resources/sap/ui/core/themes/*" : undefined,
					inputPattern: "/resources/**/themes/*/library.source.less",
					cssVariables: taskUtil.getBuildOption("cssVariables")
				}
			});
		});

		this.addTask("generateThemeDesignerResources", async () => {
			return getTask("generateThemeDesignerResources").task({
				workspace: resourceCollections.workspace,
				dependencies: resourceCollections.dependencies,
				options: {
					projectName: project.getName(),
					version: project.getVersion()
				}
			});
		});

		this.addTask("generateResourcesJson", () => {
			return getTask("generateResourcesJson").task({
				workspace: resourceCollections.workspace,
				dependencies: resourceCollections.dependencies,
				taskUtil,
				options: {
					projectName: project.getName()
				}
			});
		});
	}
}

module.exports = ThemeLibraryBuilder;
