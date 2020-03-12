/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ApiWrapper } from '../common/apiWrapper';
import * as constants from '../common/constants';
import { azureResource } from '../typings/azure-resource';
import { AzureMachineLearningWorkspaces } from '@azure/arm-machinelearningservices';
import { TokenCredentials } from '@azure/ms-rest-js';
import { WorkspaceModels } from './workspacesModels';
import { AzureMachineLearningWorkspacesOptions, Workspace } from '@azure/arm-machinelearningservices/esm/models';
import { WorkspaceModel, Asset, IArtifactParts } from './interfaces';
import { Config } from '../configurations/config';
import { Assets } from './assets';
import * as polly from 'polly-js';
import { Artifacts } from './artifacts';
import { HttpClient } from '../common/httpClient';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as path from 'path';
import * as os from 'os';
import * as utils from '../common/utils';

/**
 * Azure Model Service
 */
export class AzureModelRegistryService {

	/**
	 *
	 */
	constructor(private _apiWrapper: ApiWrapper, private _config: Config, private _httpClient: HttpClient, private _outputChannel: vscode.OutputChannel) {
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
		const data = <azureResource.GetSubscriptionsResult>await this._apiWrapper.executeCommand(constants.azureSubscriptionsCommand, account, true);
		return data?.subscriptions;
	}

	/**
	 * Returns list of azure groups
	 * @param account azure account
	 * @param subscription azure subscription
	 */
	public async getGroups(
		account: azdata.Account | undefined,
		subscription: azureResource.AzureResourceSubscription | undefined): Promise<azureResource.AzureResource[] | undefined> {
		const data = <azureResource.GetResourceGroupsResult>await this._apiWrapper.executeCommand(constants.azureResourceGroupsCommand, account, subscription, true);
		return data?.resourceGroups;
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
		workspace: Workspace): Promise<WorkspaceModel[] | undefined> {
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
		let downloadedFilePath: string = '';

		for (const tenant of account.properties.tenants) {
			try {
				const downloadUrls = await this.getAssetArtifactsDownloadLinks(account, subscription, resourceGroup, workspace, model, tenant);
				if (downloadUrls && downloadUrls.length > 0) {
					downloadedFilePath = await this.execDownloadArtifactTask(downloadUrls[0]);
				}

			} catch (error) {
				console.log(error);
			}
		}
		return downloadedFilePath;
	}

	/**
	 * Installs dependencies for the extension
	 */
	public async execDownloadArtifactTask(downloadUrl: string): Promise<string> {
		let results = await utils.executeTasks(this._apiWrapper, constants.downloadModelMsgTaskName, [this.downloadArtifact(downloadUrl)], true);
		return results && results.length > 0 ? results[0] : constants.noResultError;
	}

	private async downloadArtifact(downloadUrl: string): Promise<string> {
		let tempFilePath = path.join(os.tmpdir(), `ads_ml_temp_${UUID.generateUuid()}`);
		await this._httpClient.download(downloadUrl, tempFilePath, this._outputChannel);
		return tempFilePath;
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
		workspace: Workspace): Promise<WorkspaceModel[]> {
		let resources: WorkspaceModel[] = [];

		for (const tenant of account.properties.tenants) {
			try {
				let baseUri = this.getBaseUrl(workspace, this._config.amlModelManagementUrl);
				const client = await this.getClient(baseUri, account, subscription, tenant);
				let modelsClient = new WorkspaceModels(client);
				resources = resources.concat(await modelsClient.listModels(resourceGroup.name, workspace.name || ''));

			} catch (error) {
				console.log(error);
			}
		}

		return resources;
	}

	private async fetchModelAsset(
		subscription: azureResource.AzureResourceSubscription,
		resourceGroup: azureResource.AzureResource,
		workspace: Workspace,
		model: WorkspaceModel,
		client: AzureMachineLearningWorkspaces): Promise<Asset> {

		const modelId = this.getModelId(model);
		let modelsClient = new Assets(client);
		return await modelsClient.queryById(subscription.id, resourceGroup.name, workspace.name || '', modelId);
	}

	public async getAssetArtifactsDownloadLinks(
		account: azdata.Account,
		subscription: azureResource.AzureResourceSubscription,
		resourceGroup: azureResource.AzureResource,
		workspace: Workspace,
		model: WorkspaceModel,
		tenant: any): Promise<string[]> {
		let baseUri = this.getBaseUrl(workspace, this._config.amlModelManagementUrl);
		const modelManagementClient = await this.getClient(baseUri, account, subscription, tenant);
		const asset = await this.fetchModelAsset(subscription, resourceGroup, workspace, model, modelManagementClient);
		baseUri = this.getBaseUrl(workspace, this._config.amlExperienceUrl);
		const experienceClient = await this.getClient(baseUri, account, subscription, tenant);
		const artifactClient = new Artifacts(experienceClient);
		let downloadLinks: string[] = [];
		if (asset && asset.artifacts) {
			const downloadLinkPromises: Array<Promise<string>> = [];
			for (const artifact of asset.artifacts) {
				const parts = artifact.id
					? this.getPartsFromAssetIdOrPrefix(artifact.id)
					: this.getPartsFromAssetIdOrPrefix(artifact.prefix);

				if (parts) {
					const promise = polly()
						.waitAndRetry(3)
						.executeForPromise(
							async (): Promise<string> => {
								const artifact = await artifactClient.getArtifactContentInformation2(
									experienceClient.subscriptionId,
									resourceGroup.name,
									workspace.name || '',
									parts.origin,
									parts.container,
									{ path: parts.path }
								);
								if (artifact) {
									return artifact.contentUri || '';
								} else {
									return Promise.reject();
								}
							}
						);
					downloadLinkPromises.push(promise);
				}
			}

			try {
				downloadLinks = await Promise.all(downloadLinkPromises);
			} catch (rejectedPromiseError) {
				return rejectedPromiseError;
			}
		}
		return downloadLinks;
	}

	public getPartsFromAssetIdOrPrefix(idOrPrefix: string | undefined): IArtifactParts | undefined {
		const artifactRegex = /^(.+?)\/(.+?)\/(.+?)$/;
		if (idOrPrefix) {
			const parts = artifactRegex.exec(idOrPrefix);
			if (parts && parts.length === 4) {
				return {
					origin: parts[1],
					container: parts[2],
					path: parts[3]
				};
			}
		}
		return undefined;
	}

	private getBaseUrl(workspace: Workspace, server: string): string {
		let baseUri = `https://${workspace.location}.${server}`;
		if (workspace.location === 'chinaeast2') {
			baseUri = `https://${workspace.location}.${server}`;
		}
		return baseUri;
	}

	private async getClient(baseUri: string, account: azdata.Account, subscription: azureResource.AzureResourceSubscription, tenant: any): Promise<AzureMachineLearningWorkspaces> {
		const tokens = await this._apiWrapper.getSecurityToken(account, azdata.AzureResource.ResourceManagement);
		const token = tokens[tenant.id].token;
		const tokenType = tokens[tenant.id].tokenType;
		const options: AzureMachineLearningWorkspacesOptions = {
			baseUri: baseUri
		};
		const client = new AzureMachineLearningWorkspaces(new TokenCredentials(token, tokenType), subscription.id, options);
		client.apiVersion = this._config.amlApiVersion;
		return client;
	}

	private getModelId(model: WorkspaceModel): string {
		const amlAssetRegex = /^aml:\/\/asset\/(.+)$/;
		const id = model ? amlAssetRegex.exec(model.url || '') : undefined;
		return id && id.length === 2 ? id[1] : '';
	}
}
