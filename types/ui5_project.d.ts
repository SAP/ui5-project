declare module "@ui5/project/graph" {
	interface ProjectGraph { }

	function graphFromPackageDependencies(settings: Record<string, string | number | boolean>): ProjectGraph;
}
