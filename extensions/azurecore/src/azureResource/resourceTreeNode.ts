/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { NodeInfo } from 'sqlops';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { TreeNode } from './treeNode';
import { AzureResourceService } from './resourceService';
import { IAzureResourceNodeWithProviderId } from './interfaces';
import { AzureResourceMessageTreeNode } from './messageTreeNode';
import { AzureResourceErrorMessageUtil } from './utils';

export class AzureResourceResourceTreeNode extends TreeNode {
	public constructor(
		public resourceNodeWithProviderId: IAzureResourceNodeWithProviderId,
		parent: TreeNode
	) {
		super();

		this.parent = parent;
	}

	public async getChildren(): Promise<TreeNode[]> {
		if (this.resourceNodeWithProviderId.resourceNode.treeItem.collapsibleState === TreeItemCollapsibleState.None) {
			return <TreeNode[]>[];
		}

		try {
			const children = await this._resourceService.getChildren(this.resourceNodeWithProviderId.resourceProviderId, this.resourceNodeWithProviderId.resourceNode);

			if (children.length === 0) {
				return [AzureResourceMessageTreeNode.create(AzureResourceResourceTreeNode.noResourcesLabel, this)];
			} else {
				return children.map((child) => new AzureResourceResourceTreeNode(child, this));
			}
		} catch (error) {
			return [AzureResourceMessageTreeNode.create(AzureResourceErrorMessageUtil.getErrorMessage(error), this)];
		}
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		return this.resourceNodeWithProviderId.resourceNode.treeItem;
	}

	public getNodeInfo(): NodeInfo {
		const treeItem = this.resourceNodeWithProviderId.resourceNode.treeItem;

		return {
			label: treeItem.label,
			isLeaf: treeItem.collapsibleState === TreeItemCollapsibleState.None ? true : false,
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
		return this.resourceNodeWithProviderId.resourceNode.id;
	}

	private _resourceService = AzureResourceService.getInstance();

	private static readonly noResourcesLabel = localize('azure.resource.resourceTreeNode.noResourcesLabel', 'No Resources found.');
}