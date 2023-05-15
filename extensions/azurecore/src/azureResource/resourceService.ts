/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { extensions } from 'vscode';
import * as azdata from 'azdata';

import { IAzureResourceNodeWithProviderId } from './interfaces';
import { AzureAccount, azureResource } from 'azurecore';
import { UNIVERSAL_PROVIDER_ID } from '../constants';

export class AzureResourceService {
	private _areResourceProvidersLoaded: boolean = false;
	private _resourceProviders: { [resourceProviderId: string]: azureResource.IAzureResourceProvider } = {};
	private _treeDataProviders: { [resourceProviderId: string]: azureResource.IAzureResourceTreeDataProvider } = {};
	private _universalProvider: azureResource.IAzureUniversalResourceProvider | undefined = undefined;

	public constructor() { }

	public async listResourceProviderIds(): Promise<string[]> {
		await this.ensureResourceProvidersRegistered();

		return Object.keys(this._resourceProviders);
	}

	public async getResourceProviders(): Promise<{ [resourceProviderId: string]: azureResource.IAzureResourceProvider }> {
		await this.ensureResourceProvidersRegistered();
		return this._resourceProviders;
	}

	public registerResourceProvider(resourceProvider: azureResource.IAzureResourceProvider): void {
		this.doRegisterResourceProvider(resourceProvider);
	}

	public clearResourceProviders(): void {
		this._resourceProviders = {};
		this._treeDataProviders = {};
		this._areResourceProvidersLoaded = false;
	}

	public async getRootChildren(resourceProviderId: string, account: AzureAccount, subscription: azureResource.AzureResourceSubscription): Promise<IAzureResourceNodeWithProviderId[]> {
		await this.ensureResourceProvidersRegistered();

		if (!(resourceProviderId in this._resourceProviders) && resourceProviderId !== UNIVERSAL_PROVIDER_ID) {
			throw new Error(`Azure resource provider doesn't exist. Id: ${resourceProviderId}`);
		}

		const rootChildren = <azdata.TreeItem[]>await this._treeDataProviders[resourceProviderId]?.getRootChildren();
		return rootChildren.map(rootChild => {
			return {
				resourceProviderId,
				resourceNode: {
					account,
					subscription,
					tenantId: subscription.tenant!,
					treeItem: rootChild
				}
			};
		});
	}

	public async getChildren(resourceProviderId: string, element: azureResource.IAzureResourceNode, browseConnectionMode: boolean = false): Promise<IAzureResourceNodeWithProviderId[]> {
		await this.ensureResourceProvidersRegistered();

		if (!(resourceProviderId in this._resourceProviders) && resourceProviderId !== UNIVERSAL_PROVIDER_ID) {
			throw new Error(`Azure resource provider doesn't exist. Id: ${resourceProviderId}`);
		}

		const treeDataProvider = <azureResource.IAzureResourceTreeDataProvider>this._treeDataProviders[resourceProviderId];
		treeDataProvider.browseConnectionMode = browseConnectionMode;
		const children = <azureResource.IAzureResourceNode[]>await treeDataProvider.getChildren(element);

		return children.map((child) => <IAzureResourceNodeWithProviderId>{
			resourceProviderId: resourceProviderId,
			resourceNode: child
		});
	}

	public async getAllChildren(account: AzureAccount, subscriptions: azureResource.AzureResourceSubscription[], browseConnectionMode: boolean = false): Promise<IAzureResourceNodeWithProviderId[]> {
		await this.ensureResourceProvidersRegistered();
		const treeDataProvider = <azureResource.IAzureUniversalTreeDataProvider>this._universalProvider?.getTreeDataProvider();
		treeDataProvider.browseConnectionMode = browseConnectionMode;
		const children = <azureResource.IAzureResourceNode[]>await treeDataProvider.getAllChildren(account, subscriptions);

		return children.map((child) => <IAzureResourceNodeWithProviderId>{
			resourceProviderId: UNIVERSAL_PROVIDER_ID,
			resourceNode: child
		});
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
			const contributes = extension.packageJSON.contributes as { [key: string]: string } | undefined;
			if (!contributes) {
				continue;
			}

			if (contributes['hasAzureResourceProviders']) {
				await extension.activate();

				if (extension.exports && extension.exports.provideResources) {
					for (const resourceProvider of <azureResource.IAzureResourceProvider[]>extension.exports.provideResources()) {
						if (resourceProvider && resourceProvider.providerId !== UNIVERSAL_PROVIDER_ID) {
							this.doRegisterResourceProvider(resourceProvider);
						}
					}
				}
				if (extension.exports && extension.exports.getUniversalProvider) {
					this._universalProvider = <azureResource.IAzureUniversalResourceProvider>extension.exports.getUniversalProvider();
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
