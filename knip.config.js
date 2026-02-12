const config = {
	/**
	 * We only need dependency checking at the moment,
	 * so all checks except for dependencies are turned off.
	 */
	rules: {
		files: "off",
		duplicates: "off",
		classMembers: "off",
		unlisted: "off",
		binaries: "off",
		unresolved: "off",
		catalog: "off",
		exports: "off",
		types: "off",
		enumMembers: "off",
		/**
		 * We also ignore peer dependencies because @ui5/project
		 * defines an optional peer dependency to @ui5/builder
		 * which is needed and not an issue in our point of view.
		 */
		optionalPeerDependencies: "off"
	},

	ignoreDependencies: [
		/**
		 * Used via nyc ava --node-arguments="--experimental-loader=@istanbuljs/esm-loader-hook"
		 * which is not detected by knip as a usage of this package
		 */
		"@istanbuljs/esm-loader-hook",

		/**
		 * Used as jsdoc template in package.json script, which is not detected
		 */
		"docdash"
	],
};

export default config;
