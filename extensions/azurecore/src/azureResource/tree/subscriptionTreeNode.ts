/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { NodeInfo } from 'azdata';
import { AppContext } from '../../appContext';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { TreeNode } from '../treeNode';
import { IAzureResourceNodeWithProviderId } from '../interfaces';
import { AzureResourceContainerTreeNodeBase } from './baseTreeNodes';
import { AzureResourceItemType, AzureResourceServiceNames } from '../constants';
import { IAzureResourceTreeChangeHandler } from './treeChangeHandler';
import { AzureResourceMessageTreeNode } from '../messageTreeNode';
import { AzureResourceErrorMessageUtil } from '../utils';
import { AzureResourceService } from '../resourceService';
import { AzureResourceResourceTreeNode } from '../resourceTreeNode';
import { AzureAccount, Tenant, azureResource } from 'azurecore';

export class AzureResourceSubscriptionTreeNode extends AzureResourceContainerTreeNodeBase {
	public constructor(
		public readonly account: AzureAccount,
		public readonly subscription: azureResource.AzureResourceSubscription,
		public readonly tenant: Tenant,
		appContext: AppContext,
		treeChangeHandler: IAzureResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super(appContext, treeChangeHandler, parent);

		this._id = `account_${this.account.key.accountId}.tenant_${this.tenant.id}.subscription_${this.subscription.id}`;
		this.setCacheKey(`${this._id}.resources`);
	}

	public async getChildren(): Promise<TreeNode[]> {
		try {
			const resourceService = this.appContext.getService<AzureResourceService>(AzureResourceServiceNames.resourceService);

			const children: IAzureResourceNodeWithProviderId[] = [];

			for (const resourceProviderId of await resourceService.listResourceProviderIds()) {
				children.push(...await resourceService.getRootChildren(resourceProviderId, this.account, this.subscription));
			}

			if (children.length === 0) {
				return [AzureResourceMessageTreeNode.create(AzureResourceSubscriptionTreeNode.noResourcesLabel, this)];
			} else {
				return children.map((child) => {
					// To make tree node's id unique, otherwise, treeModel.js would complain 'item already registered'
					child.resourceNode.treeItem.id = `${this._id}.${child.resourceNode.treeItem.id}`;
					return new AzureResourceResourceTreeNode(child, this, this.appContext);
				}).sort((a, b) => a.nodePathValue.localeCompare(b.nodePathValue));
			}
		} catch (error) {
			return [AzureResourceMessageTreeNode.create(AzureResourceErrorMessageUtil.getErrorMessage(error), this)];
		}
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		const item = new TreeItem(this.subscription.name, TreeItemCollapsibleState.Collapsed);
		item.contextValue = AzureResourceItemType.subscription;
		item.iconPath = this.appContext.extensionContext.asAbsolutePath('resources/subscriptions.svg');
		return item;
	}

	public getNodeInfo(): NodeInfo {
		return {
			label: this.subscription.name,
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			parentNodePath: this.parent?.generateNodePath() ?? '',
			nodeStatus: undefined,
			nodeType: AzureResourceItemType.subscription,
			nodeSubType: undefined,
			iconType: AzureResourceItemType.subscription
		};
	}

	public get nodePathValue(): string {
		return this._id;
	}

	private _id: string;

	private static readonly noResourcesLabel = localize('azure.resource.tree.subscriptionTreeNode.noResourcesLabel', "No Resources found.");
}
