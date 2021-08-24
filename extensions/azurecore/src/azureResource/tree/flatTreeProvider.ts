/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { AppContext } from '../../appContext';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { TreeNode } from '../treeNode';
import { AzureResourceMessageTreeNode } from '../messageTreeNode';
import { AzureResourceContainerTreeNodeBase } from './baseTreeNodes';
import { AzureResourceErrorMessageUtil } from '../utils';
import { IAzureResourceTreeChangeHandler } from './treeChangeHandler';
import { IAzureResourceNodeWithProviderId, IAzureResourceSubscriptionService } from '../interfaces';
import { AzureResourceServiceNames } from '../constants';
import { AzureResourceService } from '../resourceService';


export class FlatAzureResourceTreeProvider implements vscode.TreeDataProvider<TreeNode>, IAzureResourceTreeChangeHandler {
	public isSystemInitialized: boolean = false;

	private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();

	private resourceLoader: ResourceLoader;

	public constructor(private readonly appContext: AppContext) {
	}

	public async getChildren(element?: TreeNode): Promise<TreeNode[]> {
		if (element) {
			return element.getChildren(true);
		}

		if (!this.resourceLoader) {
			this.resourceLoader = new ResourceLoader(this.appContext);
			this.resourceLoader.onDidAddNewResource(e => this._onDidChangeTreeData.fire(e));
		}

		if (this.resourceLoader.state === LoaderState.NotStarted) {
			this.resourceLoader.start();
			return [AzureResourceMessageTreeNode.create(localize('azure.resource.tree.treeProvider.loadingLabel', "Loading ..."), undefined)];
		}

		return this.resourceLoader.children;
	}

	public get onDidChangeTreeData(): vscode.Event<TreeNode | undefined> {
		return this._onDidChangeTreeData.event;
	}

	public notifyNodeChanged(node: TreeNode): void {
		this._onDidChangeTreeData.fire(node);
	}

	public async refresh(node: TreeNode, isClearingCache: boolean): Promise<void> {
		if (isClearingCache) {
			if ((node instanceof AzureResourceContainerTreeNodeBase)) {
				node.clearCache();
			}
		}

		this._onDidChangeTreeData.fire(node);
	}

	public getTreeItem(element: TreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element.getTreeItem();
	}
}

enum LoaderState {
	NotStarted,
	Loading,
	Complete
}

class ResourceLoader {
	private _state: LoaderState = LoaderState.NotStarted;

	private readonly resourceGroups = new Map<string, AzureResourceResourceTreeNode>();

	private readonly subscriptionService: IAzureResourceSubscriptionService;
	private readonly resourceService: AzureResourceService;

	private readonly _onDidAddNewResource = new vscode.EventEmitter<TreeNode | undefined>();
	public readonly onDidAddNewResource = this._onDidAddNewResource.event;

	constructor(private readonly appContext: AppContext) {
		this.subscriptionService = appContext.getService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService);
		this.resourceService = appContext.getService<AzureResourceService>(AzureResourceServiceNames.resourceService);
	}

	get state(): LoaderState {
		return this._state;
	}

	get children(): AzureResourceResourceTreeNode[] {
		return Array.from(this.resourceGroups.values());
	}

	async start(): Promise<void> {
		if (this.state === LoaderState.Loading) {
			throw new Error('Resource Loader already loading');
		}

		let doRefresh = false;

		// if we just fire every time we get an a new resource we crash the application
		// this effectively buffers the event so that we don't cause hangs.
		let interval = setInterval(() => {
			if (doRefresh) {
				doRefresh = false;
				this._onDidAddNewResource.fire(undefined);
			}
		}, 500);

		this._state = LoaderState.Loading;

		const accounts = await azdata.accounts.getAllAccounts();

		for (const account of accounts) {
			for (const tenant of account.properties.tenants) {
				for (const subscription of await this.subscriptionService.getSubscriptions(account, [tenant.id])) {
					for (const providerId of await this.resourceService.listResourceProviderIds()) {
						for (const group of await this.resourceService.getRootChildren(providerId, account, subscription, subscription.tenant)) {
							const children = await this.resourceService.getChildren(providerId, group.resourceNode);
							if (this.resourceGroups.has(group.resourceProviderId)) {
								const groupNode = this.resourceGroups.get(group.resourceProviderId);
								groupNode.pushItems(...children);
							} else {
								const groupNode = new AzureResourceResourceTreeNode(group, this.appContext);
								this.resourceGroups.set(group.resourceProviderId, groupNode);
								groupNode.pushItems(...children);
							}
							doRefresh = true;
						}
					}
				}
			}
		}

		console.log('finished loading');

		clearInterval(interval);

		this._state = LoaderState.Complete;
	}
}

class AzureResourceResourceTreeNode extends TreeNode {
	private _resourceService: AzureResourceService;

	public constructor(
		public readonly resourceNodeWithProviderId: IAzureResourceNodeWithProviderId,
		private appContext: AppContext
	) {
		super();
		this._resourceService = appContext.getService<AzureResourceService>(AzureResourceServiceNames.resourceService);
	}

	private _children: IAzureResourceNodeWithProviderId[] = [];

	pushItems(...items: IAzureResourceNodeWithProviderId[]): void {
		this._children.push(...items);
	}

	public async getChildren(): Promise<TreeNode[]> {
		// It is a leaf node.

		try {

			if (this._children.length === 0) {
				return [AzureResourceMessageTreeNode.create(localize('azure.resource.resourceTreeNode.noResourcesLabel', "No Resources found"), this)];
			} else {
				return this._children.map((child) => {
					// To make tree node's id unique, otherwise, treeModel.js would complain 'item already registered'
					child.resourceNode.treeItem.id = `${this.resourceNodeWithProviderId.resourceNode.treeItem.id}.${child.resourceNode.treeItem.id}`;
					return new AzureResourceResourceTreeNode(child, this.appContext);
				});
			}
		} catch (error) {
			return [AzureResourceMessageTreeNode.create(AzureResourceErrorMessageUtil.getErrorMessage(error), this)];
		}
	}

	public getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
		return this._resourceService.getTreeItem(this.resourceNodeWithProviderId.resourceProviderId, this.resourceNodeWithProviderId.resourceNode);
	}

	public getNodeInfo(): azdata.NodeInfo {
		const treeItem = this.resourceNodeWithProviderId.resourceNode.treeItem;

		return {
			label: <any>treeItem.label,
			isLeaf: treeItem.collapsibleState === vscode.TreeItemCollapsibleState.None ? true : false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: treeItem.contextValue,
			nodeSubType: undefined,
			iconType: treeItem.contextValue
		};
	}

	public get nodePathValue(): string {
		return this.resourceNodeWithProviderId.resourceNode.treeItem.id;
	}

}
