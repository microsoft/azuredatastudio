/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentOptions } from '../../../mssql/src/mssql';

export interface IDeploySettings {
	databaseName: string;
	serverName: string;
	connectionUri: string;
	sqlCmdVariables?: Record<string, string>;
	deploymentOptions?: DeploymentOptions;
	profileUsed?: boolean;
}
