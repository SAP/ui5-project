const AbstractBuilder = require("./AbstractBuilder");

class LibraryBuilder extends AbstractBuilder {
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
					pattern: "/**/*.{js,library,css,less,theme,html}"
				}
			});
		});

		this.addTask("replaceVersion", async () => {
			return getTask("replaceVersion").task({
				workspace: resourceCollections.workspace,
				options: {
					version: project.getVersion(),
					pattern: "/**/*.{js,json,library,css,less,theme,html}"
				}
			});
		});

		this.addTask("replaceBuildtime", async () => {
			return getTask("replaceBuildtime").task({
				workspace: resourceCollections.workspace,
				options: {
					pattern: "/resources/sap/ui/Global.js"
				}
			});
		});

		if (project.getNamespace()) {
			this.addTask("generateJsdoc", async () => {
				const patterns = ["/resources/**/*.js"];
				// Add excludes
				const excludes = project.getJsdocExcludes();
				if (excludes.length) {
					const excludes = excludes.map((pattern) => {
						return `!/resources/${pattern}`;
					});

					patterns.push(...excludes);
				}

				return getTask("generateJsdoc").task({
					workspace: resourceCollections.workspace,
					dependencies: resourceCollections.dependencies,
					taskUtil,
					options: {
						projectName: project.getName(),
						namespace: project.getNamespace(),
						version: project.getVersion(),
						pattern: patterns
					}
				});
			});

			this.addTask("executeJsdocSdkTransformation", async () => {
				return getTask("executeJsdocSdkTransformation").task({
					workspace: resourceCollections.workspace,
					dependencies: resourceCollections.dependencies,
					options: {
						projectName: project.getName(),
						dotLibraryPattern: "/resources/**/*.library",
					}
				});
			});
		}

		// Support rules should not be minified to have readable code in the Support Assistant
		const minificationPattern = ["/resources/**/*.js", "!**/*.support.js"];
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

		this.addTask("generateLibraryManifest", async () => {
			return getTask("generateLibraryManifest").task({
				workspace: resourceCollections.workspace,
				taskUtil,
				options: {
					projectName: project.getName()
				}
			});
		});


		if (project.getNamespace()) {
			this.addTask("generateManifestBundle", async () => {
				return getTask("generateManifestBundle").task({
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
		}

		this.addTask("generateLibraryPreload", async () => {
			return getTask("generateLibraryPreload").task({
				workspace: resourceCollections.workspace,
				dependencies: resourceCollections.dependencies,
				taskUtil,
				options: {
					project: project,
					excludes: project.getLibraryPreloadExcludes()
				}
			});
		});

		const bundles = project.getBundles();
		if (bundles.length) {
			this.addTask("generateBundle", async () => {
				return bundles.reduce(function(sequence, bundle) {
					return sequence.then(function() {
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
					});
				}, Promise.resolve());
			});
		}

		this.addTask("buildThemes", async () => {
			// Only compile themes directly below the lib namespace to be in sync with the theme support at runtime
			// which only loads themes from that folder.
			// TODO 3.0: Remove fallback in case of missing namespace
			const inputPattern = `/resources/${project.getNamespace() || "**"}/themes/*/library.source.less`;

			return getTask("buildThemes").task({
				workspace: resourceCollections.workspace,
				dependencies: resourceCollections.dependencies,
				options: {
					projectName: project.getName(),
					librariesPattern: !taskUtil.isRootProject() ? "/resources/**/(*.library|library.js)" : undefined,
					themesPattern: !taskUtil.isRootProject() ? "/resources/sap/ui/core/themes/*" : undefined,
					inputPattern,
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
					version: project.getVersion(),
					namespace: project.getNamespace()
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

module.exports = LibraryBuilder;
