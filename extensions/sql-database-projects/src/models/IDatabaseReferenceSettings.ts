/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SystemDatabase } from './project';
import { Uri } from 'vscode';

export interface IDatabaseReferenceSettings {
	databaseName?: string;
	suppressMissingDependenciesErrors: boolean;
}

export interface ISystemDatabaseReferenceSettings extends IDatabaseReferenceSettings {
	systemDb: SystemDatabase;
}

export interface IDacpacReferenceSettings extends IDatabaseReferenceSettings {
	dacpacFileLocation: Uri;
	databaseVariable?: string;
	serverName?: string;
	serverVariable?: string;
}

export interface IProjectReferenceSettings extends IDatabaseReferenceSettings {
	projectRelativePath: Uri | undefined;
	projectName: string;
	projectGuid: string;
	databaseVariable?: string;
	serverName?: string;
	serverVariable?: string;
}
