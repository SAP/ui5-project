// Calculate nodeArguments based on the Node version
const nodeArguments = [
	"--import=tsx/esm",
	"--no-warnings=ExperimentalWarning",
];

export default {
	extensions: {
		ts: "module",
	},
	files: [
		"test/lib/**/*.ts",
		"!test/**/__helper__/**",
	],
	watchMode: {
		ignoreChanges: [
			"test/tmp/**",
			"lib/**",
		],
	},
	nodeArguments,
	workerThreads: false,
};
