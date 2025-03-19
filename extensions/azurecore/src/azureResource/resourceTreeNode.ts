/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NodeInfo } from 'azdata';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();
import { Logger } from '../utils/Logger';

import { TreeNode } from './treeNode';
import { AzureResourceService } from './resourceService';
import { AzureResourceMessageTreeNode } from './messageTreeNode';
import { AzureResourceErrorMessageUtil } from './utils';
import { AppContext } from '../appContext';
import { AzureResourceServiceNames } from './constants';
import { azureResource } from 'azurecore';

export class AzureResourceResourceTreeNode extends TreeNode {
	private _resourceService: AzureResourceService;

	public constructor(
		public readonly resourceNode: azureResource.IAzureResourceNode,
		parent: TreeNode,
		private appContext: AppContext
	) {
		super();
		this._resourceService = appContext.getService<AzureResourceService>(AzureResourceServiceNames.resourceService);
		this.parent = parent;
	}

	public async getChildren(): Promise<TreeNode[]> {
		Logger.verbose("In AzureResourceResourceTreeNode: getChildren");
		// It is a leaf node.
		if (this.resourceNode.treeItem.collapsibleState === TreeItemCollapsibleState.None) {
			return <TreeNode[]>[];
		}

		try {
			const children = await this._resourceService.getChildren(this.resourceNode.resourceProviderId, this.resourceNode);

			if (children.length === 0) {
				Logger.piiSanitized(`No resources found for account: ${JSON.stringify(this.resourceNode.account)}, and subscription ${this.resourceNode.subscription}`, [], []);
				return [AzureResourceMessageTreeNode.create(localize('azure.resource.resourceTreeNode.noResourcesLabel', "No Resources found"), this)];
			} else {
				Logger.piiSanitized(`Found ${children.length} resources for account: ${JSON.stringify(this.resourceNode.account)}, and subscription ${this.resourceNode.subscription}`, [], []);
				return children.map((child) => {
					// To make tree node's id unique, otherwise, treeModel.js would complain 'item already registered'
					child.treeItem.id = `${this.resourceNode.treeItem.id}.${child.treeItem.id}`;
					return new AzureResourceResourceTreeNode(child, this, this.appContext);
				});
			}
		} catch (error) {
			Logger.error(`AzureResourceResourceTreeNode: GetChildren - Failed to get children for resource node: ${JSON.stringify(this.resourceNode)}, with error: ${error}`);
			return [AzureResourceMessageTreeNode.create(AzureResourceErrorMessageUtil.getErrorMessage(error), this)];
		}
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		return this.resourceNode.treeItem;
	}

	public getNodeInfo(): NodeInfo {
		const treeItem = this.resourceNode.treeItem;

		return {
			label: typeof treeItem.label === 'object' ? treeItem.label.label : treeItem.label || '',
			isLeaf: treeItem.collapsibleState === TreeItemCollapsibleState.None ? true : false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			parentNodePath: this.parent?.generateNodePath() ?? '',
			nodeStatus: undefined,
			nodeType: treeItem.contextValue || '',
			nodeSubType: undefined,
			iconType: treeItem.contextValue
		};
	}

	public get nodePathValue(): string {
		return this.resourceNode.treeItem.id || '';
	}

}
