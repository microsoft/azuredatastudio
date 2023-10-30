/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as utils from '../../common/utils';
import { IAccount, IAzureAccountSession, azure } from 'vscode-mssql';

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
	public async getLocations(session: IAzureAccountSession): Promise<azure.subscription.Location[]> {
		const azureResourceService = await this._azureResourceServiceFactory();
		return await azureResourceService.getLocations(session);
	}

	/**
	 * Returns Azure sessions with subscription, tenant and token for given account
	 */
	public async getSessions(account: IAccount): Promise<IAzureAccountSession[]> {
		const azureAccountService = await this._azureAccountServiceFactory();
		return await azureAccountService.getAccountSessions(account);
	}

	/**
	 * Creates a new Azure SQL server for given subscription, resource group and location
	 */
	public async createOrUpdateServer(session: IAzureAccountSession, resourceGroupName: string, serverName: string, parameters: azure.sql.Server): Promise<string | undefined> {
		const azureResourceService = await this._azureResourceServiceFactory();
		return await azureResourceService.createOrUpdateServer(session, resourceGroupName, serverName, parameters);
	}

	/**
	 * Returns Azure resource groups for given subscription
	 */
	public async getResourceGroups(session: IAzureAccountSession): Promise<Array<azure.resources.ResourceGroup> | []> {
		const azureResourceService = await this._azureResourceServiceFactory();
		return await azureResourceService.getResourceGroups(session);
	}
}
