/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureAccountExtensionApi, AzureSubscription } from '../../../azure-account.api';
import { AzureExtensionApiProvider } from '../../../azpi';
import { SqlManagementClient, Server } from '@azure/arm-sql';
import * as coreAuth from '@azure/core-auth';
import { ResourceManagementClient } from '@azure/arm-resources';
import { ResourceGroup } from '@azure/arm-resources/esm/models';

export class AzureSqlClient {

	public static async init() {
		if (!AzureSqlClient.azureApis) {
			const extension = vscode.extensions.getExtension<AzureExtensionApiProvider>('ms-vscode.azure-account');
			if (extension && !extension.isActive) {
				await extension.activate();

			} else if (!extension) {
				void vscode.window.showErrorMessage('Please make sure Azure Account extension is installed!');
			}

			const azureApiProvider = extension?.exports;
			if (azureApiProvider) {
				AzureSqlClient.azureApis = azureApiProvider.getApi<AzureAccountExtensionApi>('1');
				if (!(await AzureSqlClient.azureApis.waitForLogin())) {
					await vscode.commands.executeCommand('azure-account.askForLogin');
				}
			}
		}
	}

	public static async getSubscriptions(): Promise<AzureSubscription[]> {
		const azureApis = await AzureSqlClient.getAzureApis();
		return azureApis?.subscriptions || [];
	}

	public static async createServer(subscription: AzureSubscription, resourceGroup: ResourceGroup, serverName: string, parameters: Server): Promise<Server | undefined> {
		if (subscription?.subscription?.subscriptionId && resourceGroup?.name) {
			const sqlClient: SqlManagementClient = new SqlManagementClient(<coreAuth.TokenCredential>subscription.session.credentials2, subscription.subscription.subscriptionId);
			const result = await sqlClient.servers.beginCreateOrUpdateAndWait(resourceGroup.name,
				serverName, parameters);

			return result;
		}
		return undefined;
	}

	public static async getResourceGroups(subscription: AzureSubscription): Promise<Array<ResourceGroup> | []> {
		if (subscription?.subscription?.subscriptionId) {
			const resourceGroupClient = new ResourceManagementClient(<coreAuth.TokenCredential>subscription.session.credentials2, subscription.subscription.subscriptionId);
			const resourceGroupResponse = await resourceGroupClient.resourceGroups.list();
			return resourceGroupResponse;
		}
		return [];
	}

	private static azureApis: AzureAccountExtensionApi | undefined;

	private static async getAzureApis(): Promise<AzureAccountExtensionApi | undefined> {
		if (!AzureSqlClient.azureApis) {
			await AzureSqlClient.init();
		}

		return AzureSqlClient.azureApis;
	}
}
