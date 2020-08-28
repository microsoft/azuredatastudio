/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DatabaseReferenceLocation, SystemDatabase } from './project';
import { Uri } from 'vscode';

export interface IDatabaseReferenceSettings {
	databaseName: string;
}

export interface ISystemDatabaseReferenceSettings extends IDatabaseReferenceSettings {
	systemDb: SystemDatabase;
}

export interface IDacpacReferenceSettings extends IDatabaseReferenceSettings {
	databaseLocation: DatabaseReferenceLocation;
	dacpacFileLocation: Uri;
	databaseVariable?: string;
	serverName?: string;
	serverVariable?: string;
}
