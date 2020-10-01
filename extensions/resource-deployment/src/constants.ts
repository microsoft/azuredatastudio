/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const DeploymentConfigurationKey: string = 'deployment';
export const AzdataInstallLocationKey: string = 'azdataInstallLocation';
export const ToolsInstallPath = 'AZDATA_NB_VAR_TOOLS_INSTALLATION_PATH';

export enum ResourceTypeCategories {
	ALL = 'All',
	ONPREM = 'On-premises',
	SQLSERVER = 'SQL Server',
	HYBRID = 'Hybrid',
	POSTGRESQL = 'PostgreSQL',
	CLOUD = 'Cloud',
}

