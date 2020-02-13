/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ApiWrapper } from '../common/apiWrapper';
import * as constants from '../common/constants';
import { azureResource } from '../typings/azure-resource';
import { AzureMachineLearningWorkspaces } from '@azure/arm-machinelearningservices';
import { TokenCredentials } from '@azure/ms-rest-js';
import { WorkspaceModels } from './workspacesModels';
import { AzureMachineLearningWorkspacesOptions, Workspace } from '@azure/arm-machinelearningservices/esm/models';
import { WorkspaceModel } from './interfaces';
import { Config } from '../configurations/config';

/**
 * Azure Model Service
 */
export class AzureModelRegistryService {

	/**
	 *
	 */
	constructor(private _apiWrapper: ApiWrapper, private _config: Config) {
	}

	/**
	 * Returns list of azure accounts
	 */
	public async getAccounts(): Promise<azdata.Account[]> {
		return await this._apiWrapper.getAllAccounts();
	}

	/**
	 * Returns list of azure subscriptions
	 * @param account azure account
	 */
	public async getSubscriptions(account: azdata.Account | undefined): Promise<azureResource.AzureResourceSubscription[] | undefined> {
		return await this._apiWrapper.executeCommand(constants.azureSubscriptionsCommand, account);
	}

	/**
	 * Returns list of azure groups
	 * @param account azure account
	 * @param subscription azure subscription
	 */
	public async getGroups(
		account: azdata.Account | undefined,
		subscription: azureResource.AzureResourceSubscription | undefined): Promise<azureResource.AzureResource[] | undefined> {
		return await this._apiWrapper.executeCommand(constants.azureResourceGroupsCommand, account, subscription);
	}

	/**
	 * Returns list of workspaces
	 * @param account azure account
	 * @param subscription azure subscription
	 * @param resourceGroup azure resource group
	 */
	public async getWorkspaces(
		account: azdata.Account,
		subscription: azureResource.AzureResourceSubscription,
		resourceGroup: azureResource.AzureResource | undefined): Promise<Workspace[]> {
		return await this.fetchWorkspaces(account, subscription, resourceGroup);
	}

	/**
	 * Returns list of models
	 * @param account azure account
	 * @param subscription azure subscription
	 * @param resourceGroup azure resource group
	 * @param workspace azure workspace
	 */
	public async getModels(
		account: azdata.Account,
		subscription: azureResource.AzureResourceSubscription,
		resourceGroup: azureResource.AzureResource,
		workspace: Workspace): Promise<azureResource.AzureResource[] | undefined> {
		return await this.fetchModels(account, subscription, resourceGroup, workspace);
	}

	/**
	 * Download an azure model to a temporary location
	 * @param account azure account
	 * @param subscription azure subscription
	 * @param resourceGroup azure resource group
	 * @param workspace azure workspace
	 * @param model azure model
	 */
	public async downloadModel(
		account: azdata.Account,
		subscription: azureResource.AzureResourceSubscription,
		resourceGroup: azureResource.AzureResource,
		workspace: Workspace,
		model: WorkspaceModel): Promise<string> {
		console.log(account);
		console.log(subscription);
		console.log(resourceGroup);
		console.log(workspace);
		console.log(model);
		// TODO: not implemented
		return '';
	}

	private async fetchWorkspaces(account: azdata.Account, subscription: azureResource.AzureResourceSubscription, resourceGroup: azureResource.AzureResource | undefined): Promise<Workspace[]> {
		let resources: Workspace[] = [];

		try {
			for (const tenant of account.properties.tenants) {
				const tokens = await this._apiWrapper.getSecurityToken(account, azdata.AzureResource.ResourceManagement);
				const token = tokens[tenant.id].token;
				const tokenType = tokens[tenant.id].tokenType;
				const client = new AzureMachineLearningWorkspaces(new TokenCredentials(token, tokenType), subscription.id);
				let result = resourceGroup ? await client.workspaces.listByResourceGroup(resourceGroup.name) : await client.workspaces.listBySubscription();
				resources.push(...result);
			}
		} catch (error) {

		}
		return resources;
	}

	private async fetchModels(
		account: azdata.Account,
		subscription: azureResource.AzureResourceSubscription,
		resourceGroup: azureResource.AzureResource,
		workspace: Workspace): Promise<azureResource.AzureResource[]> {
		let resources: azureResource.AzureResource[] = [];

		for (const tenant of account.properties.tenants) {
			try {
				const tokens = await this._apiWrapper.getSecurityToken(account, azdata.AzureResource.ResourceManagement);
				const token = tokens[tenant.id].token;
				const tokenType = tokens[tenant.id].tokenType;
				let baseUri = `https://${workspace.location}.${this._config.amlApiUrl}`;
				if (workspace.location === 'chinaeast2') {
					baseUri = `https://${workspace.location}.${this._config.amlApiUrl}`;
				}
				const options: AzureMachineLearningWorkspacesOptions = {
					baseUri: baseUri

				};
				const client = new AzureMachineLearningWorkspaces(new TokenCredentials(token, tokenType), subscription.id, options);
				client.apiVersion = this._config.amlApiVersion;

				let modelsClient = new WorkspaceModels(client);
				let result = await modelsClient.listModels(resourceGroup.name, workspace.name || '');
				resources.push(...result.map(r => { return { id: r.id || '', name: r.name || '' }; }));
			} catch (error) {
				console.log(error);
			}
		}

		return resources;
	}
}
