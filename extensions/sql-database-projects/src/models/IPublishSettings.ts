/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentOptions } from '../../../mssql/src/mssql';

export interface IPublishSettings {
	databaseName: string;
	connectionUri: string;
	upgradeExisting: boolean;
	sqlCmdVariables?: Record<string, string>;
	deploymentOptions?: DeploymentOptions;
}

export interface IGenerateScriptSettings {
	databaseName: string;
	connectionUri: string;
	sqlCmdVariables?: Record<string, string>;
	deploymentOptions?: DeploymentOptions;
}
