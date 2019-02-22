// /*---------------------------------------------------------------------------------------------
//  *  Copyright (c) Microsoft Corporation. All rights reserved.
//  *  Licensed under the Source EULA. See License.txt in the project root for license information.
//  *--------------------------------------------------------------------------------------------*/

// 'use strict';

// import { TreeItem, TreeItemCollapsibleState } from 'vscode';
// import { Account, NodeInfo } from 'sqlops';
// import { AppContext } from '../../appContext';
// import * as nls from 'vscode-nls';
// const localize = nls.loadMessageBundle();

// import { cmsResource } from '../cms-resource';
// import { TreeNode } from '../treeNode';
// import { CmsResourceContainerTreeNodeBase } from './baseTreeNodes';
// import { AzureResourceItemType } from '../constants';
// import { ICmsResourceTreeChangeHandler } from './treeChangeHandler';
// import { AzureResourceErrorMessageUtil } from '../utils';

// export class AzureResourceSubscriptionTreeNode extends CmsResourceContainerTreeNodeBase {
// 	public constructor(
// 		appContext: AppContext,
// 		treeChangeHandler: ICmsResourceTreeChangeHandler,
// 		parent: TreeNode
// 	) {
// 		super(appContext, treeChangeHandler, parent);

// 		this._id = `account_${this}.subscription_${this}.tenant_${this}`;
// 		//this.setCacheKey(`${this._id}.resources`);
// 	}

// 	public async getChildren(): Promise<TreeNode[]> {
// 		try {
// 			//const resourceService = AzureResourceService.getInstance();

// 			// const children: IAzureResourceNodeWithProviderId[] = [];

// 			// for (const resourceProviderId of await resourceService.listResourceProviderIds()) {
// 			// 	children.push(...await resourceService.getRootChildren(resourceProviderId, this.account, this.subscription, this.tenatId));
// 			// }

// 			if (children.length === 0) {
// 				return [AzureResourceMessageTreeNode.create(AzureResourceSubscriptionTreeNode.noResourcesLabel, this)];
// 			} else {
// 				return children.map((child) => {
// 					// To make tree node's id unique, otherwise, treeModel.js would complain 'item already registered'
// 					child.resourceNode.treeItem.id = `${this._id}.${child.resourceNode.treeItem.id}`;
// 					return new AzureResourceResourceTreeNode(child, this);
// 				});
// 			}
// 		} catch (error) {
// 			return [AzureResourceMessageTreeNode.create(AzureResourceErrorMessageUtil.getErrorMessage(error), this)];
// 		}
// 	}

// 	public getTreeItem(): TreeItem | Promise<TreeItem> {
// 		const item = new TreeItem(this.subscription.name, TreeItemCollapsibleState.Collapsed);
// 		item.contextValue = AzureResourceItemType.serverGroup;
// 		item.iconPath = {
// 			dark: this.appContext.extensionContext.asAbsolutePath('resources/dark/subscription_inverse.svg'),
// 			light: this.appContext.extensionContext.asAbsolutePath('resources/light/subscription.svg')
// 		};
// 		return item;
// 	}

// 	public getNodeInfo(): NodeInfo {
// 		return {
// 			label: this.subscription.name,
// 			isLeaf: false,
// 			errorMessage: undefined,
// 			metadata: undefined,
// 			nodePath: this.generateNodePath(),
// 			nodeStatus: undefined,
// 			nodeType: AzureResourceItemType.serverGroup,
// 			nodeSubType: undefined,
// 			iconType: AzureResourceItemType.serverGroup
// 		};
// 	}

// 	public get nodePathValue(): string {
//         return this._id;
// 	}

// 	private _id: string = undefined;

// 	private static readonly noResourcesLabel = localize('cms.resource.tree.subscriptionTreeNode.noResourcesLabel', 'No Resources found.');
// }
