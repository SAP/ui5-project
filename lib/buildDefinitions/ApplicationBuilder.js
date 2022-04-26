const AbstractBuilder = require("./AbstractBuilder");

class ApplicationBuilder extends AbstractBuilder {
	addStandardTasks({resourceCollections, project, log, taskUtil, getTask}) {
		this.addTask("escapeNonAsciiCharacters", async () => {
			return getTask("escapeNonAsciiCharacters").task({
				workspace: resourceCollections.workspace,
				options: {
					encoding: project.getPropertiesFileSourceEncoding(),
					pattern: "/**/*.properties"
				}
			});
		});

		this.addTask("replaceCopyright", async () => {
			return getTask("replaceCopyright").task({
				workspace: resourceCollections.workspace,
				options: {
					copyright: project.getCopyright(),
					pattern: "/**/*.{js,json}"
				}
			});
		});

		this.addTask("replaceVersion", async () => {
			return getTask("replaceVersion").task({
				workspace: resourceCollections.workspace,
				options: {
					version: project.getVersion(),
					pattern: "/**/*.{js,json}"
				}
			});
		});

		// Support rules should not be minified to have readable code in the Support Assistant
		const minificationPattern = ["/**/*.js", "!**/*.support.js"];
		if (["2.6"].includes(project.getSpecVersion())) {
			const minificationExcludes = project.getMinificationExcludes();
			if (minificationExcludes.length) {
				this.enhancePatternWithExcludes(minificationPattern, minificationExcludes, "/resources/");
			}
		}
		this.addTask("minify", async () => {
			return getTask("minify").task({
				workspace: resourceCollections.workspace,
				taskUtil,
				options: {
					pattern: minificationPattern
				}
			});
		});

		this.addTask("generateFlexChangesBundle", async () => {
			const generateFlexChangesBundle = getTask("generateFlexChangesBundle").task;
			return generateFlexChangesBundle({
				workspace: resourceCollections.workspace,
				taskUtil,
				options: {
					namespace: project.getNamespace()
				}
			});
		});

		if (project.getNamespace()) {
			this.addTask("generateManifestBundle", async () => {
				const generateManifestBundle = getTask("generateManifestBundle").task;
				return generateManifestBundle({
					workspace: resourceCollections.workspace,
					options: {
						projectName: project.getName(),
						namespace: project.getNamespace()
					}
				});
			});
		}

		const componentPreloadPaths = project.getComponentPreloadPaths();
		const componentPreloadNamespaces = project.getComponentPreloadNamespaces();
		const componentPreloadExcludes = project.getComponentPreloadNamespaces();
		if (componentPreloadPaths.length || componentPreloadNamespaces.length) {
			this.addTask("generateComponentPreload", async () => {
				return getTask("generateComponentPreload").task({
					workspace: resourceCollections.workspace,
					dependencies: resourceCollections.dependencies,
					taskUtil,
					options: {
						projectName: project.getName(),
						paths: componentPreloadPaths,
						namespaces: componentPreloadNamespaces,
						excludes: componentPreloadExcludes
					}
				});
			});
		} else {
			// Default component preload for application namespace
			this.addTask("generateComponentPreload", async () => {
				return getTask("generateComponentPreload").task({
					workspace: resourceCollections.workspace,
					dependencies: resourceCollections.dependencies,
					taskUtil,
					options: {
						projectName: project.getName(),
						namespaces: [project.getNamespace()],
						excludes: componentPreloadExcludes
					}
				});
			});
		}

		this.addTask("generateStandaloneAppBundle", async () => {
			return getTask("generateStandaloneAppBundle").task({
				workspace: resourceCollections.workspace,
				dependencies: resourceCollections.dependencies,
				taskUtil,
				options: {
					projectName: project.getName(),
					namespace: project.getNamespace()
				}
			});
		});

		this.addTask("transformBootstrapHtml", async () => {
			return getTask("transformBootstrapHtml").task({
				workspace: resourceCollections.workspace,
				options: {
					projectName: project.getName(),
					namespace: project.getNamespace()
				}
			});
		});

		const bundles = project.getBundles();
		if (bundles.length) {
			this.addTask("generateBundle", async () => {
				return Promise.all(bundles.map((bundle) => {
					return getTask("generateBundle").task({
						workspace: resourceCollections.workspace,
						dependencies: resourceCollections.dependencies,
						taskUtil,
						options: {
							projectName: project.getName(),
							bundleDefinition: bundle.bundleDefinition,
							bundleOptions: bundle.bundleOptions
						}
					});
				}));
			});
		}

		this.addTask("generateVersionInfo", async () => {
			return getTask("generateVersionInfo").task({
				workspace: resourceCollections.workspace,
				dependencies: resourceCollections.dependencies,
				options: {
					rootProject: project,
					pattern: "/resources/**/.library"
				}
			});
		});

		if (project.getNamespace()) {
			this.addTask("generateCachebusterInfo", async () => {
				return getTask("generateCachebusterInfo").task({
					workspace: resourceCollections.workspace,
					dependencies: resourceCollections.dependencies,
					options: {
						namespace: project.getNamespace(),
						signatureType: project.getCachebusterSignatureType(),
					}
				});
			});
		}

		this.addTask("generateApiIndex", async () => {
			return getTask("generateApiIndex").task({
				workspace: resourceCollections.workspace,
				dependencies: resourceCollections.dependencies,
				options: {
					projectName: project.getName()
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

module.exports = ApplicationBuilder;
