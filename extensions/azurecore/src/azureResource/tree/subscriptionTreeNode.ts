/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { Account, NodeInfo } from 'sqlops';
import { AppContext } from '../../appContext';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { azureResource } from '../azure-resource';
import { TreeNode } from '../treeNode';
import { IAzureResourceNodeWithProviderId } from '../interfaces';
import { AzureResourceContainerTreeNodeBase } from './baseTreeNodes';
import { AzureResourceItemType } from '../constants';
import { IAzureResourceTreeChangeHandler } from './treeChangeHandler';
import { AzureResourceMessageTreeNode } from '../messageTreeNode';
import { AzureResourceErrorMessageUtil } from '../utils';
import { AzureResourceService } from '../resourceService';
import { AzureResourceResourceTreeNode } from '../resourceTreeNode';

export class AzureResourceSubscriptionTreeNode extends AzureResourceContainerTreeNodeBase {
	public constructor(
		public readonly account: Account,
		public readonly subscription: azureResource.AzureResourceSubscription,
		public readonly tenatId: string,
		appContext: AppContext,
		treeChangeHandler: IAzureResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super(appContext, treeChangeHandler, parent);

		this._id = `account_${this.account.key.accountId}.subscription_${this.subscription.id}.tenant_${this.tenatId}`;
		this.setCacheKey(`${this._id}.resources`);
	}

	public async getChildren(): Promise<TreeNode[]> {
		try {
			const resourceService = AzureResourceService.getInstance();

			const children: IAzureResourceNodeWithProviderId[] = [];

			for (const resourceProviderId of await resourceService.listResourceProviderIds()) {
				children.push(...await resourceService.getRootChildren(resourceProviderId, this.account, this.subscription, this.tenatId));
			}

			if (children.length === 0) {
				return [AzureResourceMessageTreeNode.create(AzureResourceSubscriptionTreeNode.noResourcesLabel, this)];
			} else {
				return children.map((child) => {
					// To make tree node's id unique, otherwise, treeModel.js would complain 'item already registered'
					child.resourceNode.treeItem.id = `${this._id}.${child.resourceNode.treeItem.id}`;
					return new AzureResourceResourceTreeNode(child, this);
				});
			}
		} catch (error) {
			return [AzureResourceMessageTreeNode.create(AzureResourceErrorMessageUtil.getErrorMessage(error), this)];
		}
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		const item = new TreeItem(this.subscription.name, TreeItemCollapsibleState.Collapsed);
		item.contextValue = AzureResourceItemType.subscription;
		item.iconPath = {
			dark: this.appContext.extensionContext.asAbsolutePath('resources/dark/subscription_inverse.svg'),
			light: this.appContext.extensionContext.asAbsolutePath('resources/light/subscription.svg')
		};
		return item;
	}

	public getNodeInfo(): NodeInfo {
		return {
			label: this.subscription.name,
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: AzureResourceItemType.subscription,
			nodeSubType: undefined,
			iconType: AzureResourceItemType.subscription
		};
	}

	public get nodePathValue(): string {
        return this._id;
	}

	private _id: string = undefined;

	private static readonly noResourcesLabel = localize('azure.resource.tree.subscriptionTreeNode.noResourcesLabel', 'No Resources found.');
}
