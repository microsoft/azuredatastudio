/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { NodeInfo } from 'azdata';
import { AppContext } from '../../appContext';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();
import { Logger } from "../../utils/Logger";


import { TreeNode } from '../treeNode';
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
		Logger.verbose("In AzureResourceSubscriptionTreeNode: getChildren");

		try {
			const resourceService = this.appContext.getService<AzureResourceService>(AzureResourceServiceNames.resourceService);
			Logger.verbose(`Getting all children for account: ${JSON.stringify(this.account)}, and subscription ${this.subscription}}`);
			const children: azureResource.IAzureResourceNode[] = await resourceService.getAllChildren(this.account, [this.subscription], true);
			let resourceTreeNodes: azureResource.IAzureResourceNode[] = [];
			if (children.length === 0) {
				Logger.verbose(`No resources found for account: ${JSON.stringify(this.account)}, and subscription ${this.subscription}}`);
				return [AzureResourceMessageTreeNode.create(AzureResourceSubscriptionTreeNode.noResourcesLabel, this)];
			} else {
				Logger.verbose(`Found ${children.length} child resource(s) for account: ${JSON.stringify(this.account)}, and subscription ${this.subscription}}`);
				for (let resource of children) {
					if (resourceTreeNodes.findIndex(r => r.resourceProviderId === resource.resourceProviderId) !== -1) {
						continue;
					} else {
						resourceTreeNodes.push(await resourceService.getRootChild(resource.resourceProviderId, this.account, this.subscription));
					}
				}
				Logger.verbose(`Found ${resourceTreeNodes.length} resources for account: ${JSON.stringify(this.account)}, and subscription ${this.subscription}}`);

				return resourceTreeNodes.map((child) => {
					// To make tree node's id unique, otherwise, treeModel.js would complain 'item already registered'
					child.treeItem.id = `${this._id}.${child.treeItem.id}`;
					return new AzureResourceResourceTreeNode(child, this, this.appContext);
				}).sort((a, b) => a.nodePathValue.localeCompare(b.nodePathValue));
			}
		} catch (error) {
			Logger.error(`The following error occurred while getting child resources: ${error}`);
			return [AzureResourceMessageTreeNode.create(AzureResourceErrorMessageUtil.getErrorMessage(error), this)];
		}
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		Logger.verbose("In AzureResourceSubscriptionTreeNode: getTreeItem");
		const item = new TreeItem(this.subscription.name, TreeItemCollapsibleState.Collapsed);
		item.contextValue = AzureResourceItemType.subscription;
		item.iconPath = this.appContext.extensionContext.asAbsolutePath('resources/subscriptions.svg');
		Logger.verbose(`Returning item: ${JSON.stringify(item)}`);
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
