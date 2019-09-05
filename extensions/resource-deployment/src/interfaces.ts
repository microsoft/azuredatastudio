/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

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
	title: string;
	dialog: DialogInfo;
	notebook: string | NotebookInfo;
	downloadUrl: string;
	webPageUrl: string;
	requiredTools: ToolRequirementInfo[];
	when: string;
}

export interface DialogInfo {
	notebook: string | NotebookInfo;
	title: string;
	name: string;
	tabs: DialogTabInfo[];
}

export interface DialogTabInfo {
	title: string;
	sections: DialogSectionInfo[];
}

export interface DialogSectionInfo {
	title: string;
	fields: DialogFieldInfo[];
}

export interface DialogFieldInfo {
	label: string;
	variableName: string;
	type: FieldType;
	defaultValue: string;
	confirmationRequired: boolean;
	confirmationLabel: string;
	min?: number;
	max?: number;
	required: boolean;
	options: string[];
	placeHolder: string;
	userName?: string; //needed for sql server's password complexity requirement check, password can not include the login name.
}

export enum FieldType {
	Text = 'text',
	Number = 'number',
	DateTimeText = 'datetime_text',
	SQLPassword = 'sql_password',
	Password = 'password',
	Options = 'options'
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
	Azdata
}

export interface ITool {
	readonly name: string;
	readonly displayName: string;
	readonly description: string;
	readonly type: ToolType;
}
