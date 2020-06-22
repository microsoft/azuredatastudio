/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IDeploymentProfile {
	databaseName: string;
	connectionUri: string;
	upgradeExisting: boolean;
	sqlCmdVariables?: Record<string, string>;
}

export interface IGenerateScriptProfile {
	databaseName: string;
	connectionUri: string;
	sqlCmdVariables?: Record<string, string>;
}

export interface PublishSettings {
	databaseName: string;
	sqlCmdVariables: Record<string, string>;
}
