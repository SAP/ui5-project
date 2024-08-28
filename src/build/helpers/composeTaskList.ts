/**
 * Creates the list of tasks to be executed by the build process
 *
 * Sets specific tasks to be disabled by default, these tasks need to be included explicitly.
 * Based on the selected build mode (selfContained|preload), different tasks are enabled.
 * Tasks can be enabled or disabled. The wildcard <code>*</code> is also supported and affects all tasks.
 *
 * @param allTasks
 * @param buildConfig
 * 			Build configuration
 * @param buildConfig.selfContained
 * @param buildConfig.jsdoc
 * @param buildConfig.includedTasks
 * @param buildConfig.excludedTasks
 * @returns List of tasks to be executed
 */
export default function composeTaskList(allTasks: string[], {selfContained, jsdoc, includedTasks, excludedTasks}: object) {
	let selectedTasks = allTasks.reduce((list, key) => {
		list[key] = true;
		return list;
	}, {});

	// Exclude non default tasks
	selectedTasks.generateStandaloneAppBundle = false;
	selectedTasks.transformBootstrapHtml = false;
	selectedTasks.generateJsdoc = false;
	selectedTasks.executeJsdocSdkTransformation = false;
	selectedTasks.generateCachebusterInfo = false;
	selectedTasks.generateApiIndex = false;
	selectedTasks.generateThemeDesignerResources = false;
	selectedTasks.generateVersionInfo = false;

	// Disable generateResourcesJson due to performance.
	// When executed it analyzes each module's AST and therefore
	// takes up much time (~10% more)
	selectedTasks.generateResourcesJson = false;

	if (selfContained) {
		// No preloads, bundle only
		selectedTasks.generateComponentPreload = false;
		selectedTasks.generateStandaloneAppBundle = true;
		selectedTasks.transformBootstrapHtml = true;
		selectedTasks.generateLibraryPreload = false;
	}

	if (jsdoc) {
		// Include JSDoc tasks
		selectedTasks.generateJsdoc = true;
		selectedTasks.executeJsdocSdkTransformation = true;
		selectedTasks.generateApiIndex = true;
		selectedTasks.generateVersionInfo = true;

		// Include theme build as required for SDK
		selectedTasks.buildThemes = true;

		// Exclude all tasks not relevant to JSDoc generation
		selectedTasks.replaceCopyright = false;
		selectedTasks.replaceVersion = false;
		selectedTasks.replaceBuildtime = false;
		selectedTasks.generateComponentPreload = false;
		selectedTasks.generateLibraryPreload = false;
		selectedTasks.generateLibraryManifest = false;
		selectedTasks.minify = false;
		selectedTasks.generateFlexChangesBundle = false;
	}

	// Exclude tasks
	for (let i = 0; i < excludedTasks.length; i++) {
		const taskName = excludedTasks[i];
		if (taskName === "*") {
			Object.keys(selectedTasks).forEach((sKey) => {
				selectedTasks[sKey] = false;
			});
			break;
		}
		if (selectedTasks[taskName] === true) {
			selectedTasks[taskName] = false;
		}
	}

	// Include tasks
	for (let i = 0; i < includedTasks.length; i++) {
		const taskName = includedTasks[i];
		if (taskName === "*") {
			Object.keys(selectedTasks).forEach((sKey) => {
				selectedTasks[sKey] = true;
			});
			break;
		}
		if (selectedTasks[taskName] === false) {
			selectedTasks[taskName] = true;
		}
	}

	// Filter only for tasks that will be executed
	selectedTasks = Object.keys(selectedTasks).filter((task) => selectedTasks[task]);

	return selectedTasks;
}
