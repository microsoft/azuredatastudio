/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

// SQL added extension host types
export enum ServiceOptionType {
	string = 0,
	multistring = 1,
	password = 2,
	number = 3,
	category = 4,
	boolean = 5,
	object = 6
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
