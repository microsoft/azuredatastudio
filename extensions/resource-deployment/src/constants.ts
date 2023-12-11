/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const DeploymentConfigurationKey: string = 'deployment';
export const AzdataInstallLocationKey: string = 'azdataInstallLocation';
export const ToolsInstallPath = 'AZDATA_NB_VAR_TOOLS_INSTALLATION_PATH';

export const enum ResourceTypeCategories {
	All = 'All',
	OnPrem = 'On-premises',
	SqlServer = 'SQL Server',
	Hybrid = 'Hybrid',
	PostgreSql = 'PostgreSQL',
	Cloud = 'Cloud',
}

