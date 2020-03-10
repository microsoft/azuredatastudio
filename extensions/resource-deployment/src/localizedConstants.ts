/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export const account = localize('azure.account', "Azure Account");
export const subscription = localize('azure.account.subscription', "Subscription");
export const resourceGroup = localize('azure.account.resourceGroup', "Resource Group");
export const location = localize('azure.account.location', "Azure Location");

export const controllerPort = localize('deployCluster.ControllerPortName', "Controller port");
export const sqlServerMasterPort = localize('deployCluster.MasterSQLServerPortName', "SQL Server Master port");
export const gatewayPort = localize('deployCluster.GatewayPortName', "Gateway port");
export const managementProxyPort = localize('deployCluster.ServiceProxyPortName', "Management proxy port");
export const applicationProxyPort = localize('deployCluster.AppServiceProxyPortName', "Application proxy port");
export const readableSecondaryPort = localize('deployCluster.ReadableSecondaryPortName', "Readable secondary port");
