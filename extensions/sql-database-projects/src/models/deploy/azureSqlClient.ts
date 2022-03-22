/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionClient, Subscription, Location } from '@azure/arm-subscriptions';
import { SqlManagementClient, Server } from '@azure/arm-sql';
import * as coreAuth from '@azure/core-auth';
import { ResourceManagementClient, ResourceGroup } from '@azure/arm-resources';
import * as utils from '../../common/utils';
import { IAccount, Tenant, Token } from 'vscode-mssql';
export interface AzureAccountSession {
	subscription: Subscription,
	tenantId: string,
	account: IAccount,
	token: Token
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

	public static async getAccounts(): Promise<IAccount[]> {
		const vscodeMssqlApi = await utils.getVscodeMssqlApi();
		return await vscodeMssqlApi.azureAccountService.getAccounts();
	}

	public static async getAccount(): Promise<IAccount> {
		const vscodeMssqlApi = await utils.getVscodeMssqlApi();
		return await vscodeMssqlApi.azureAccountService.addAccount();
	}

	public static async getLocations(session: AzureAccountSession): Promise<Location[]> {
		let locations: Location[] = [];
		const subClient = new SubscriptionClient(new SQLTokenCredential(session.token));
		if (!session?.subscription?.subscriptionId) {
			return [];
		}
		const locationsPages = await subClient.subscriptions.listLocations(session.subscription.subscriptionId);
		let nextLocation = await locationsPages.next();
		while (!nextLocation.done) {
			locations.push(nextLocation.value);
			nextLocation = await locationsPages.next();
		}
		return locations;
	}

	public static async getSubscriptions(account: IAccount): Promise<AzureAccountSession[]> {
		try {
			const subscriptions: AzureAccountSession[] = [];
			const vscodeMssqlApi = await utils.getVscodeMssqlApi();
			const tenants = <Tenant[]>account.properties.tenants;
			for (const tenantId of tenants.map(t => t.id)) {
				const token = await vscodeMssqlApi.azureAccountService.getAccountSecurityToken(account, tenantId);
				const subClient = new SubscriptionClient(new SQLTokenCredential(token));
				const newSubPages = await subClient.subscriptions.list();
				let nextSub = await newSubPages.next();
				while (!nextSub.done) {
					subscriptions.push({
						subscription: nextSub.value,
						tenantId: tenantId,
						account: account,
						token: token

					});
					nextSub = await newSubPages.next();
				}
			}

			return subscriptions;
		} catch (error) {
			console.log(error);
			return [];
		}
	}

	public static async createServer(session: AzureAccountSession, resourceGroup: ResourceGroup, serverName: string, parameters: Server): Promise<Server | undefined> {
		const credential = new SQLTokenCredential(session.token);
		if (session?.subscription.subscriptionId && resourceGroup?.name) {
			const sqlClient: SqlManagementClient = new SqlManagementClient(credential, session.subscription.subscriptionId);
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

	public static async getResourceGroups(session: AzureAccountSession): Promise<Array<ResourceGroup> | []> {
		const groups: ResourceGroup[] = [];

		if (session?.subscription?.subscriptionId) {
			const resourceGroupClient = new ResourceManagementClient(new SQLTokenCredential(session.token), session.subscription.subscriptionId);

			const newGroupsPages = await resourceGroupClient.resourceGroups.list();
			let nextGroup = await newGroupsPages.next();
			while (!nextGroup.done) {
				groups.push(nextGroup.value);
				nextGroup = await newGroupsPages.next();
			}
			return groups;
		}
		return [];
	}
}
