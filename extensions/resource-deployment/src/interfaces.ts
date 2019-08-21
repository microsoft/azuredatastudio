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
	wizard: WizardInfo;
	requiredTools: ToolRequirementInfo[];
	when: string;
}

export interface WizardInfo {
	notebook: string | NotebookInfo;
	type: BdcDeploymentType;
}

export interface DialogInfo {
	notebook: string | NotebookInfo;
	title: string;
	name: string;
	tabs: DialogTabInfo[];
}

export interface DialogTabInfo {
	title: string;
	sections: SectionInfo[];
}

export interface WizardPageInfo {
	sections: SectionInfo[];
}

export interface SectionInfo {
	title: string;
	fields: FieldInfo[]; // Use this if the dialog is not wide. All fields will be displayed in one column, label will be placed on top of the input component.
	rows: RowInfo[]; // Use this for wide dialog or wizard. label will be placed to the left of the input component.
}

export interface RowInfo {
	fields: FieldInfo[];
}

export interface FieldInfo {
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
	labelWidth?: string;
	inputWidth?: string;
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

export enum BdcDeploymentType {
	NewAKS = 'new-aks',
	ExistingAKS = 'existing-aks',
	ExistingKubeAdm = 'existing-kubeadm'
}
