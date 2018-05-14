/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

// SQL added extension host types
export enum ServiceOptionType {
	string = 'string',
	multistring = 'multistring',
	password = 'password',
	number = 'number',
	category = 'category',
	boolean = 'boolean',
	object = 'object'
}

export enum ConnectionOptionSpecialType {
	serverName = 'serverName',
	databaseName = 'databaseName',
	authType = 'authType',
	userName = 'userName',
	password = 'password',
	appName = 'appName'
}

export enum MetadataType {
	Table = 0,
	View = 1,
	SProc = 2,
	Function = 3
}

export enum EditRowState {
	clean = 0,
	dirtyInsert = 1,
	dirtyDelete = 2,
	dirtyUpdate = 3
}

export enum TaskStatus {
	notStarted = 0,
	inProgress = 1,
	succeeded = 2,
	succeededWithWarning = 3,
	failed = 4,
	canceled = 5
}

export enum TaskExecutionMode {
	execute = 0,
	script = 1,
	executeAndScript = 2,
}

export enum ScriptOperation {
	Select = 0,
	Create = 1,
	Insert = 2,
	Update = 3,
	Delete = 4,
	Execute = 5,
	Alter = 6
}

export enum ModelComponentTypes {
	NavContainer,
	FlexContainer,
	Card,
	InputBox,
	DropDown,
	Button,
	CheckBox,
	DashboardWidget,
	DashboardWebview,
	Form
}

export interface IComponentShape {
	type: ModelComponentTypes;
	id: string;
	properties?: { [key: string]: any };
	layout?: any;
	itemConfigs?: IItemConfig[];
}

export interface IItemConfig {
	componentShape: IComponentShape;
	config: any;
}

export enum ComponentEventType {
	PropertiesChanged,
	onDidChange,
	onDidClick,
	validityChanged
}

export interface IComponentEventArgs {
	eventType: ComponentEventType;
	args: any;
}

export interface IModelViewDialogDetails {
	title: string;
	content: string | number[];
	okButton: number;
	cancelButton: number;
	customButtons: number[];
}

export interface IModelViewTabDetails {
	title: string;
	content: string;
}

export interface IModelViewButtonDetails {
	label: string;
	enabled: boolean;
	hidden: boolean;
}

/// Card-related APIs that need to be here to avoid early load issues
// with enums causing requiring of sqlops API to fail.
export enum StatusIndicator {
	None = 0,
	Ok = 1,
	Warning = 2,
	Error = 3
}

export interface CardProperties {
	label: string;
	value?: string;
	actions?: ActionDescriptor[];
	status?: StatusIndicator;
}

export interface ActionDescriptor {
	label: string;
	actionTitle?: string;
	callbackData?: string;
}

