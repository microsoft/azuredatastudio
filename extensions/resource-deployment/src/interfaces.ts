/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { SemVer } from 'semver';

export interface ResourceType {
	name: string;
	displayName: string;
	description: string;
	platforms: string[];
	icon: { light: string; dark: string };
	options: ResourceTypeOption[];
	providers: DeploymentProvider[];
	getProvider(selectedOptions: { option: string, value: string }[]): DeploymentProvider | undefined;
}

export interface ResourceTypeOption {
	name: string;
	displayName: string;
	values: ResourceTypeOptionValue[];
}

export interface ResourceTypeOptionValue {
	name: string;
	displayName: string;
}

export interface DeploymentProvider {
	notebook: string | NotebookInfo;
	requiredTools: ToolRequirementInfo[];
	when: string;
}

export interface NotebookInfo {
	win32: string;
	darwin: string;
	linux: string;
}

export interface ToolRequirementInfo {
	name: string;
	version: string;
}

export enum ToolType {
	AzCli,
	KubeCtl,
	Docker,
	Python,
	MSSQLCtl
}

export interface ToolStatusInfo {
	type: ToolType;
	name: string;
	description: string;
	version: string;
	versionRequirement: string;
	status: ToolStatus;
}

export interface ITool {
	readonly name: string;
	readonly displayName: string;
	readonly description: string;
	readonly type: ToolType;
	readonly supportAutoInstall: boolean;
	readonly version: SemVer | undefined;
	readonly isInstalled: boolean;
	install(version: string): Thenable<void>;
	refresh(): Thenable<void>;
}

export enum ToolStatus {
	NotInstalled,
	Installed,
	Installing,
	FailedToInstall
}