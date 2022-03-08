/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//import * as vscode from 'vscode';
//import { AzureAccountExtensionApi, AzureSubscription } from '../../typings/azure-account.api';
import { SubscriptionClient } from '@azure/arm-subscriptions';
//import { AzureExtensionApiProvider } from '../../typings/azpi';
import { SqlManagementClient, Server } from '@azure/arm-sql';
import { TokenCredentials } from '@azure/ms-rest-js';
import * as coreAuth from '@azure/core-auth';
import { ResourceManagementClient } from '@azure/arm-resources';
import { ResourceGroup } from '@azure/arm-resources/esm/models';
import * as utils from '../../common/utils';
import { Subscription } from '@azure/arm-subscriptions/esm/models';
import { IAccount, Tenant, Token } from 'vscode-mssql';

export interface SubscriptionWithSession {
	subscription: Subscription,
	tenantId: string,
	account: IAccount
}

class SQLTokenCredential implements coreAuth.TokenCredential {
	/**
	 *
	 */
	constructor(private _token: Token) {

	}
	public getToken(scopes: string | string[], options?: coreAuth.GetTokenOptions): Promise<coreAuth.AccessToken | null> {
		console.log(scopes);
		console.log(options);
		return Promise.resolve({
			token: this._token.token,
			expiresOnTimestamp: this._token.expiresOn || 0
		});
	}
}
export class AzureSqlClient {

	/*
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


	public static async getToken(subscription: AzureSubscription): Promise<coreAuth.AccessToken | undefined> {
		return <coreAuth.AccessToken>await subscription.session.credentials2.getToken('https://database.windows.net/.default', {
			tenantId: subscription.session.tenantId
		});
	}
	*/

	public static async getSubscriptions(): Promise<SubscriptionWithSession[]> {
		try {
			const subscriptions: SubscriptionWithSession[] = [];
			const vscodeMssqlApi = await utils.getVscodeMssqlApi();
			const account = await vscodeMssqlApi.azureAccountService.getAccount();
			const tenants = <Tenant[]>account.properties.tenants;
			for (const tenantId of tenants.map(t => t.id)) {
				const token = await vscodeMssqlApi.azureAccountService.getAccountSecurityToken(account, tenantId);
				const subClient = new SubscriptionClient(new TokenCredentials(token.token));
				const newSubs = await subClient.subscriptions.list();
				subscriptions.push(...newSubs.map(newSub => {
					return {
						subscription: newSub,
						tenantId: tenantId,
						account: account
					};
				}));
			}

			return subscriptions;
		} catch (error) {
			console.log(error);
			return [];
		}

		/*
		const azureApis = await AzureSqlClient.getAzureApis();
		return azureApis?.subscriptions || [];
		*/
	}

	public static async createServer(subscription: SubscriptionWithSession, resourceGroup: ResourceGroup, serverName: string, parameters: Server): Promise<Server | undefined> {
		const vscodeMssqlApi = await utils.getVscodeMssqlApi();
		//const account = await vscodeMssqlApi.accountService.getAccount();
		const token = await vscodeMssqlApi.azureAccountService.getAccountSecurityToken(subscription.account, subscription.tenantId);
		const credential = new SQLTokenCredential(token);
		if (subscription?.subscription.subscriptionId && resourceGroup?.name) {
			const sqlClient: SqlManagementClient = new SqlManagementClient(credential, subscription.subscription.subscriptionId);
			//let sqlClient = new SqlManagementClient(new coreAuth.TokenCredential(token.token), subscription.subscription.id);
			if (sqlClient) {
				try {
					const currentServer = await sqlClient.servers.get(resourceGroup.name,
						serverName);
					if (currentServer) {
						// TODO: error for existing server
						return currentServer;
					}
				} catch {
					// Ignore the error if
				}
				const result = await sqlClient.servers.beginCreateOrUpdateAndWait(resourceGroup.name,
					serverName, parameters);

				return result;
			}
		}
		return undefined;
	}

	public static async getResourceGroups(subscription: SubscriptionWithSession): Promise<Array<ResourceGroup> | []> {
		const vscodeMssqlApi = await utils.getVscodeMssqlApi();
		const token = await vscodeMssqlApi.azureAccountService.getAccountSecurityToken(subscription.account, subscription.tenantId);
		if (subscription?.subscription?.subscriptionId) {
			//const resourceGroupClient = new ResourceManagementClient(<coreAuth.TokenCredential>subscription.session.credentials2, subscription.subscription.subscriptionId);
			const resourceGroupClient = new ResourceManagementClient(new TokenCredentials(token.token), subscription.subscription.subscriptionId);
			const resourceGroupResponse = await resourceGroupClient.resourceGroups.list();
			return resourceGroupResponse;
		}
		return [];
	}

	//private static azureApis: AzureAccountExtensionApi | undefined;

	/*
	private static async getAzureApis(): Promise<AzureAccountExtensionApi | undefined> {
		if (!AzureSqlClient.azureApis) {
			await AzureSqlClient.init();
		}

		return AzureSqlClient.azureApis;
	}
	*/
}
