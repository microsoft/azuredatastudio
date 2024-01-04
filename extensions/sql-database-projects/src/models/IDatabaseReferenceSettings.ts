/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri } from 'vscode';
import { SystemDatabase, SystemDbReferenceType } from '../common/typeHelper';

export interface IDatabaseReferenceSettings {
	databaseVariableLiteralValue?: string;
	suppressMissingDependenciesErrors: boolean;
}

export interface ISystemDatabaseReferenceSettings extends IDatabaseReferenceSettings {
	systemDb: SystemDatabase;
	systemDbReferenceType: SystemDbReferenceType;
}

export interface IUserDatabaseReferenceSettings extends IDatabaseReferenceSettings {
	databaseName?: string;
	databaseVariable?: string;
	serverName?: string;
	serverVariable?: string;
}

export interface IDacpacReferenceSettings extends IUserDatabaseReferenceSettings {
	dacpacFileLocation: Uri;
}

export interface IProjectReferenceSettings extends IUserDatabaseReferenceSettings {
	projectRelativePath: Uri | undefined;
	projectName: string;
	projectGuid: string;
}

export interface INugetPackageReferenceSettings extends IUserDatabaseReferenceSettings {
	packageName: string;
	packageVersion: string;
}
