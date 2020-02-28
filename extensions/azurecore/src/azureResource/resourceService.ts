/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { extensions, TreeItem } from 'vscode';
import { Account } from 'azdata';

import { azureResource } from './azure-resource';
import { IAzureResourceNodeWithProviderId } from './interfaces';

export class AzureResourceService {
	private _areResourceProvidersLoaded: boolean = false;
	private _resourceProviders: { [resourceProviderId: string]: azureResource.IAzureResourceProvider } = {};
	private _treeDataProviders: { [resourceProviderId: string]: azureResource.IAzureResourceTreeDataProvider } = {};

	public constructor() {
	}

	public async listResourceProviderIds(): Promise<string[]> {
		await this.ensureResourceProvidersRegistered();

		return Object.keys(this._resourceProviders);
	}

	public registerResourceProvider(resourceProvider: azureResource.IAzureResourceProvider): void {
		this.doRegisterResourceProvider(resourceProvider);
	}

	public clearResourceProviders(): void {
		this._resourceProviders = {};
		this._treeDataProviders = {};
		this._areResourceProvidersLoaded = false;
	}

	public async getRootChildren(resourceProviderId: string, account: Account, subscription: azureResource.AzureResourceSubscription, tenatId: string): Promise<IAzureResourceNodeWithProviderId[]> {
		await this.ensureResourceProvidersRegistered();

		if (!(resourceProviderId in this._resourceProviders)) {
			throw new Error(`Azure resource provider doesn't exist. Id: ${resourceProviderId}`);
		}

		const treeDataProvider = this._treeDataProviders[resourceProviderId];
		const children = await treeDataProvider.getChildren();

		return children.map((child) => <IAzureResourceNodeWithProviderId>{
			resourceProviderId: resourceProviderId,
			resourceNode: <azureResource.IAzureResourceNode>{
				account: account,
				subscription: subscription,
				tenantId: tenatId,
				treeItem: child.treeItem
			}
		});
	}

	public async getChildren(resourceProviderId: string, element: azureResource.IAzureResourceNode): Promise<IAzureResourceNodeWithProviderId[]> {
		await this.ensureResourceProvidersRegistered();

		if (!(resourceProviderId in this._resourceProviders)) {
			throw new Error(`Azure resource provider doesn't exist. Id: ${resourceProviderId}`);
		}

		const treeDataProvider = this._treeDataProviders[resourceProviderId];
		const children = await treeDataProvider.getChildren(element);

		return children.map((child) => <IAzureResourceNodeWithProviderId>{
			resourceProviderId: resourceProviderId,
			resourceNode: child
		});
	}

	public async getTreeItem(resourceProviderId: string, element?: azureResource.IAzureResourceNode): Promise<TreeItem> {
		await this.ensureResourceProvidersRegistered();

		if (!(resourceProviderId in this._resourceProviders)) {
			throw new Error(`Azure resource provider doesn't exist. Id: ${resourceProviderId}`);
		}

		const treeDataProvider = this._treeDataProviders[resourceProviderId];
		return treeDataProvider.getTreeItem(element);
	}

	public get areResourceProvidersLoaded(): boolean {
		return this._areResourceProvidersLoaded;
	}

	public set areResourceProvidersLoaded(value: boolean) {
		this._areResourceProvidersLoaded = value;
	}

	private async ensureResourceProvidersRegistered(): Promise<void> {
		if (this._areResourceProvidersLoaded) {
			return;
		}

		for (const extension of extensions.all) {
			const contributes = extension.packageJSON && extension.packageJSON.contributes;
			if (!contributes) {
				continue;
			}

			if (contributes['hasAzureResourceProviders']) {
				await extension.activate();

				if (extension.exports && extension.exports.provideResources) {
					for (const resourceProvider of <azureResource.IAzureResourceProvider[]>extension.exports.provideResources()) {
						if (resourceProvider) {
							this.doRegisterResourceProvider(resourceProvider);
						}
					}
				}
			}
		}

		this._areResourceProvidersLoaded = true;
	}

	private doRegisterResourceProvider(resourceProvider: azureResource.IAzureResourceProvider): void {
		this._resourceProviders[resourceProvider.providerId] = resourceProvider;
		this._treeDataProviders[resourceProvider.providerId] = resourceProvider.getTreeDataProvider();
	}

}
