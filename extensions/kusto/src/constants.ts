/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export const serviceName = 'Kusto Tools Service';
export const providerId = 'KUSTO';
export const serviceCrashLink = 'https://github.com/Microsoft/vscode-kusto/wiki/SqlToolsService-Known-Issues';
export const extensionConfigSectionName = 'kusto';

// DATA PROTOCOL VALUES ///////////////////////////////////////////////////////////
export const kustoClusterProviderName = 'kustoCluster';
export const protocolVersion = '1.0';
export const authenticationTypePropName = 'authenticationType';
export const integratedAuth = 'integrated';
export const serverPropName = 'server';
export const userPropName = 'user';
export const passwordPropName = 'password';
export const groupIdPropName = 'groupId';
export const groupIdName = 'groupId';
export const kustoProviderName = 'KUSTO';

export const UNTITLED_SCHEMA = 'untitled';

// SERVICE NAMES //////////////////////////////////////////////////////////
export const ObjectExplorerService = 'objectexplorer';
export const objectExplorerPrefix: string = 'objectexplorer://';
export const ViewType = 'view';

export enum BuiltInCommands {
	SetContext = 'setContext'
}

export enum CommandContext {
	WizardServiceEnabled = 'wizardservice:enabled'
}

export enum KustoClusterItems {
	Connection = 'kustoCluster:connection',
	Folder = 'kustoCluster:folder',
	File = 'kustoCluster:file',
	Error = 'kustoCluster:error'
}

export const kustoClusterNewNotebookTask = 'kustoCluster.task.newNotebook';
export const kustoClusterOpenNotebookTask = 'kustoCluster.task.openNotebook';
