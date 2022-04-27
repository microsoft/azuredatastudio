/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Location } from '@azure/arm-subscriptions';
import { Server } from '@azure/arm-sql';
import * as utils from '../../common/utils';
import { IAccount, IAzureAccountSession } from 'vscode-mssql';
import { ResourceGroup } from '@azure/arm-resources';

/**
 * Client module to call Azure APIs for getting or creating resources
 */
export class AzureSqlClient {

	constructor(
		private _azureAccountServiceFactory: utils.AzureAccountServiceFactory = utils.defaultAzureAccountServiceFactory,
		private _azureResourceServiceFactory: utils.AzureResourceServiceFactory = utils.defaultAzureResourceServiceFactory
	) { }

	/**
	 * Returns existing Azure accounts
	 */
	public async getAccounts(): Promise<IAccount[]> {
		const azureAccountService = await this._azureAccountServiceFactory();
		return await azureAccountService.getAccounts();
	}

	/**
	 * Prompt user to login to Azure and returns the account
	 * @returns Azure account that user logged in to
	 */
	public async getAccount(): Promise<IAccount> {
		const azureAccountService = await this._azureAccountServiceFactory();
		return await azureAccountService.addAccount();
	}

	/**
	 * Returns Azure locations for given subscription
	 */
	public async getLocations(session: IAzureAccountSession): Promise<Location[]> {
		const azureResourceService = await this._azureResourceServiceFactory();
		return await azureResourceService.getLocations(session);
	}

	/**
	 * Returns Azure subscriptions for given account
	 */
	public async getSubscriptions(account: IAccount): Promise<IAzureAccountSession[]> {
		const azureAccountService = await this._azureAccountServiceFactory();
		return await azureAccountService.getAccountSessions(account);
	}

	/**
	 * Creates a new Azure SQL server for given subscription, resource group and location
	 */
	public async createServer(session: IAzureAccountSession, resourceGroupName: string, serverName: string, parameters: Server): Promise<string | undefined> {
		if (session?.subscription && resourceGroupName) {
			const azureResourceService = await this._azureResourceServiceFactory();
			return await azureResourceService.createOrUpdateServer(session, resourceGroupName, serverName, parameters);
		}
		return undefined;
	}

	/**
	 * Returns Azure resource groups for given subscription
	 */
	public async getResourceGroups(session: IAzureAccountSession): Promise<Array<ResourceGroup> | []> {
		if (session?.subscription?.subscriptionId) {
			const azureResourceService = await this._azureResourceServiceFactory();
			return await azureResourceService.getResourceGroups(session);
		}
		return [];
	}
}
