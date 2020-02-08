/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';
import { azureResource } from './azure-resource';
import { AzureMachineLearningWorkspaces } from '@azure/arm-machinelearningservices';
import { TokenCredentials } from '@azure/ms-rest-js';
import { WorkspaceModels } from './workspacesModels';
import { AzureMachineLearningWorkspacesOptions, Workspace } from '@azure/arm-machinelearningservices/esm/models';


export class AzureModelRegistry {

	/**
	 *
	 */
	constructor(private _apiWrapper: ApiWrapper) {
	}

	public async getAccounts(): Promise<azdata.Account[]> {
		return await this._apiWrapper.getAllAccounts();
	}

	public async getSubscriptions(account: azdata.Account): Promise<azureResource.AzureResourceSubscription[] | undefined> {
		return await this._apiWrapper.executeCommand(constants.azureSubscriptionsCommand, account);
	}

	public async getWorkspaces(account: azdata.Account, subscription: azureResource.AzureResourceSubscription): Promise<Workspace[]> {
		//const query = 'where type == 'microsoft.machinelearningservices/workspaces'';
		//return await this._apiWrapper.executeCommand(constants.azureSqlResourcesCommand, account, subscription, query);
		return await this.getResources(account, subscription);
	}

	public async getModels(account: azdata.Account, subscription: azureResource.AzureResourceSubscription, resourceGroup: azureResource.AzureResource, workspace: Workspace): Promise<azureResource.AzureResource[] | undefined> {
		//const query = `where type == 'microsoft.machinelearningservices/workspaces/myws1'`;
		//return await this._apiWrapper.executeCommand(constants.azureSqlResourcesCommand, account, subscription, query);
		return await this.getModelResources(account, subscription, resourceGroup, workspace);
	}

	private async getResources(account: azdata.Account, subscription: azureResource.AzureResourceSubscription): Promise<Workspace[]> {
		let resources: Workspace[] = [];
		//let models: AzureMachineLearningWorkspacesModels.MachineLearningComputeListByWorkspaceResponse;

		try {
			for (const tenant of account.properties.tenants) {
				const tokens = await this._apiWrapper.getSecurityToken(account, azdata.AzureResource.ResourceManagement);
				const token = tokens[tenant.id].token;
				const tokenType = tokens[tenant.id].tokenType;
				const client = new AzureMachineLearningWorkspaces(new TokenCredentials(token, tokenType), subscription.id);
				let result = await client.workspaces.listBySubscription();
				resources.push(...result);
			}
		} catch (error) {

		}
		return resources;
	}


	private async getModelResources(account: azdata.Account, subscription: azureResource.AzureResourceSubscription, resourceGroup: azureResource.AzureResource, workspace: Workspace): Promise<azureResource.AzureResource[]> {
		let resources: azureResource.AzureResource[] = [];

		try {
			for (const tenant of account.properties.tenants) {
				const tokens = await this._apiWrapper.getSecurityToken(account, azdata.AzureResource.ResourceManagement);
				const token = tokens[tenant.id].token;
				const tokenType = tokens[tenant.id].tokenType;
				let baseUri = `https://${workspace.location}.modelmanagement.azureml.net/modelmanagement/v1.0`;
				if (workspace.location === 'chinaeast2') {
					baseUri = `https://chinaeast2.modelmanagement.azureml.cn/modelmanagement/v1.0`;
				}
				const options: AzureMachineLearningWorkspacesOptions = {
					baseUri: baseUri

				};
				const client = new AzureMachineLearningWorkspaces(new TokenCredentials(token, tokenType), subscription.id, options);
				client.apiVersion = '2018-11-19';

				//let result = await client.workspaces.get(resourceGroup.name, workspace.name);
				let modelsClient = new WorkspaceModels(client);
				let result = await modelsClient.listKeys(resourceGroup.name, workspace.name || '');
				resources.push(...result.map(r => { return { id: r.id || '', name: r.name || '' }; }));
			}
		} catch (error) {
			console.log(error);
		}
		return resources;
	}

}
