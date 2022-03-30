/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionClient, Subscription, Location } from '@azure/arm-subscriptions';
import { SqlManagementClient, Server } from '@azure/arm-sql';
import * as coreAuth from '@azure/core-auth';
import { ResourceManagementClient, ResourceGroup } from '@azure/arm-resources';
import { PagedAsyncIterableIterator } from '@azure/core-paging';
import * as utils from '../../common/utils';
import { IAccount, Tenant, Token } from 'vscode-mssql';
export interface AzureAccountSession {
	subscription: Subscription,
	tenantId: string,
	account: IAccount,
	token: Token
}

/**
 * TokenCredential wrapper to only return the given token
 */
class SQLTokenCredential implements coreAuth.TokenCredential {

	constructor(private _token: Token) {
	}

	public getToken(_: string | string[], __?: coreAuth.GetTokenOptions): Promise<coreAuth.AccessToken | null> {
		return Promise.resolve({
			token: this._token.token,
			expiresOnTimestamp: this._token.expiresOn || 0
		});
	}
}

/**
 * Client module to call Azure APIs for getting or creating resources
 */
export class AzureSqlClient {

	/**
	 * Returns existing Azure accounts
	 */
	public async getAccounts(): Promise<IAccount[]> {
		const vscodeMssqlApi = await utils.getVscodeMssqlApi();
		return await vscodeMssqlApi.azureAccountService.getAccounts();
	}

	/**
	 * Prompt user to login to Azure and returns the account
	 * @returns Azure account that user logged in to
	 */
	public async getAccount(): Promise<IAccount> {
		const vscodeMssqlApi = await utils.getVscodeMssqlApi();
		return await vscodeMssqlApi.azureAccountService.addAccount();
	}

	/**
	 * Returns Azure locations for given subscription
	 */
	public async getLocations(session: AzureAccountSession): Promise<Location[]> {
		const subClient = new SubscriptionClient(new SQLTokenCredential(session.token));
		if (!session?.subscription?.subscriptionId) {
			return [];
		}
		const locationsPages = await subClient.subscriptions.listLocations(session.subscription.subscriptionId);
		return await this.getAllValues(locationsPages, (v) => v);
	}

	/**
	 * Returns Azure subscriptions for given account
	 */
	public async getSubscriptions(account: IAccount): Promise<AzureAccountSession[]> {
		try {
			let subscriptions: AzureAccountSession[] = [];
			const vscodeMssqlApi = await utils.getVscodeMssqlApi();
			const tenants = <Tenant[]>account.properties.tenants;
			for (const tenantId of tenants.map(t => t.id)) {
				const token = await vscodeMssqlApi.azureAccountService.getAccountSecurityToken(account, tenantId);
				const subClient = new SubscriptionClient(new SQLTokenCredential(token));
				const newSubPages = await subClient.subscriptions.list();
				const array = await this.getAllValues<Subscription, AzureAccountSession>(newSubPages, (nextSub) => {
					return {
						subscription: nextSub,
						tenantId: tenantId,
						account: account,
						token: token

					};
				});
				subscriptions = subscriptions.concat(array);
			}

			return subscriptions;
		} catch (error) {
			console.log(error);
			return [];
		}
	}

	/**
	 * Creates a new Azure SQL server for given subscription, resource group and location
	 */
	public async createServer(session: AzureAccountSession, resourceGroup: ResourceGroup, serverName: string, parameters: Server): Promise<string | undefined> {
		const credential = new SQLTokenCredential(session.token);
		if (session?.subscription.subscriptionId && resourceGroup?.name) {
			const sqlClient: SqlManagementClient = new SqlManagementClient(credential, session.subscription.subscriptionId);
			if (sqlClient) {
				try {
					const currentServer = await sqlClient.servers.get(resourceGroup.name,
						serverName);
					if (currentServer) {
						// TODO: error for existing server or should we accept existing servers?
						return currentServer.fullyQualifiedDomainName;
					}
				} catch {
					// Ignore the error if server doesn't exist
				}
				const result = await sqlClient.servers.beginCreateOrUpdateAndWait(resourceGroup.name,
					serverName, parameters);

				return result.fullyQualifiedDomainName;
			}
		}
		return undefined;
	}

	/**
	 * Returns Azure resource groups for given subscription
	 */
	public async getResourceGroups(session: AzureAccountSession): Promise<Array<ResourceGroup> | []> {
		if (session?.subscription?.subscriptionId) {
			const resourceGroupClient = new ResourceManagementClient(new SQLTokenCredential(session.token), session.subscription.subscriptionId);

			const newGroupsPages = await resourceGroupClient.resourceGroups.list();
			return await this.getAllValues(newGroupsPages, (v) => v);
		}
		return [];
	}

	private async getAllValues<T, TResult>(pages: PagedAsyncIterableIterator<T>, convertor: (input: T) => TResult): Promise<TResult[]> {
		let values: TResult[] = [];
		let newValue = await pages.next();
		while (!newValue.done) {
			values.push(convertor(newValue.value));
			newValue = await pages.next();
		}
		return values;
	}
}
