// This one should be (eventually) provided globally or as a part of @ui5/project/Specification 
declare type availableSpecVersions = "2.0" | "2.2" | "3.0" | "3.2";

// Mock some of the types, so it would be easier to follow
declare type ui5_fs_resourceFactory = object
declare type ui5_fs_Resource = object
declare type ProjectInterface = object

declare type StandardBuildTags = {
	OmitFromBuildResult: string
	IsBundle: string
	IsDebugVariant: string
	HasDebugVariant: string
}

declare class TaskUtil_v2_2 {
	STANDARD_TAGS: StandardBuildTags
	resourceFactory: ui5_fs_resourceFactory
	getDependencies(projectName?: string): string[]
	getProject(projectNameOrResource?: ProjectInterface | undefined)
	isRootProject(): boolean
	registerCleanupTask(callback: CallableFunction): never
}

declare class TaskUtil_v3_0 extends TaskUtil_v2_2 {
	clearTag(resource: ui5_fs_Resource, tag: string): never
	getTag(resource: ui5_fs_Resource, tag: string): string | boolean | number | undefined
	setTag(resource: ui5_fs_Resource, tag: string, value: string | boolean | number): never
}

declare class TaskUtil_v3_2 extends TaskUtil_v3_0 {
	someFutureMethod();
}

export declare type TaskUtil<specVersion extends availableSpecVersions> = specVersion extends "2.2"
	? TaskUtil_v2_2
	: specVersion extends "3.0"
	? TaskUtil_v3_0
	: specVersion extends "3.2"
	? TaskUtil_v3_2
	: never;