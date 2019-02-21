/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { extensions, TreeItem } from 'vscode';

import { cmsResource } from './cms-resource';

export class CmsResourceService {
	private constructor() {
	}

	public static getInstance(): CmsResourceService {
		return CmsResourceService._instance;
	}

	public async listResourceProviderIds(): Promise<string[]> {
		await this.ensureResourceProvidersRegistered();

		return Object.keys(this._resourceProviders);
	}

	public registerResourceProvider(resourceProvider: cmsResource.ICmsResourceProvider): void {
		this.doRegisterResourceProvider(resourceProvider);
	}

	public clearResourceProviders(): void {
		this._resourceProviders = {};
		this._treeDataProviders = {};
		this._areResourceProvidersLoaded = false;
	}

	public async getRootChildren(resourceProviderId: string): Promise<any[]> {
		await this.ensureResourceProvidersRegistered();

		if (!(resourceProviderId in this._resourceProviders)) {
			throw new Error(`Azure resource provider doesn't exist. Id: ${resourceProviderId}`);
		}

		const treeDataProvider = this._treeDataProviders[resourceProviderId];
		const children = await treeDataProvider.getChildren();

		return children.map((child) => <any>{
			resourceProviderId: resourceProviderId,
			resourceNode: <cmsResource.ICmsResourceNode>{
				treeItem: child.treeItem
			}
		});
	}

	public async getChildren(resourceProviderId: string, element: cmsResource.ICmsResourceNode): Promise<any[]> {
		await this.ensureResourceProvidersRegistered();

		if (!(resourceProviderId in this._resourceProviders)) {
			throw new Error(`Azure resource provider doesn't exist. Id: ${resourceProviderId}`);
		}

		const treeDataProvider = this._treeDataProviders[resourceProviderId];
		const children = await treeDataProvider.getChildren(element);

		return children.map((child) => <any>{
			resourceProviderId: resourceProviderId,
			resourceNode: child
		});
	}

	public async getTreeItem(resourceProviderId: string, element?: cmsResource.ICmsResourceNode): Promise<TreeItem> {
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
					for (const resourceProvider of <cmsResource.ICmsResourceProvider[]>extension.exports.provideResources()) {
						this.doRegisterResourceProvider(resourceProvider);
					}
				}
			}
		}

		this._areResourceProvidersLoaded = true;
	}

	private doRegisterResourceProvider(resourceProvider: cmsResource.ICmsResourceProvider): void {
		this._resourceProviders[resourceProvider.providerId] = resourceProvider;
		this._treeDataProviders[resourceProvider.providerId] = resourceProvider.getTreeDataProvider();
	}

	private _areResourceProvidersLoaded: boolean = false;
	private _resourceProviders: { [resourceProviderId: string]: cmsResource.ICmsResourceProvider } = {};
	private _treeDataProviders: { [resourceProviderId: string]: cmsResource.ICmsResourceTreeDataProvider } = {};

	private static readonly _instance = new CmsResourceService();
}