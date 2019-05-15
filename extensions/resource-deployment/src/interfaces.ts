/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

export interface ResourceType {
	name: string;
	displayName: string;
	description: string;
	icon: { light: string; dark: string };
	options: ResourceTypeOption[];
	providers: DeploymentProvider[];
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
	notebook: string;
	requiredTools: ToolRequirement[];
	when: string;
}

export interface ToolRequirement {
	name: string;
	version: string;
}

export enum ToolType {
	Unknown,
	AZCLI,
	KUBECTL,
	Docker,
	Python,
	MSSQLCTL
}

export interface ToolStatusInfo {
	type: ToolType;
	name: string;
	description: string;
	version: string;
	status: string;
}

export interface ITool {
	name(): string;
	displayName(): string;
	description(): string;
	type(): ToolType;
	isInstalled(versionExpression: string): Thenable<boolean>;
	supportAutoInstall(): boolean;
	install(version: string): Thenable<void>;
}