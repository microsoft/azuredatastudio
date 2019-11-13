/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { NodeInfo } from 'azdata';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { TreeNode } from '../treeNode';
import { CmsResourceItemType } from '../constants';

export class CmsResourceEmptyTreeNode extends TreeNode {
	public getChildren(): TreeNode[] | Promise<TreeNode[]> {
		return [];
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		let item = new TreeItem(CmsResourceEmptyTreeNode.addCmsServerLabel, TreeItemCollapsibleState.None);
		item.command = {
			title: CmsResourceEmptyTreeNode.addCmsServerLabel,
			command: 'cms.resource.registerCmsServer',
			arguments: [this]
		};
		item.contextValue = CmsResourceItemType.cmsEmptyNodeContainer;
		return item;
	}

	public getNodeInfo(): NodeInfo {
		return {
			label: CmsResourceEmptyTreeNode.addCmsServerLabel,
			isLeaf: true,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: CmsResourceItemType.cmsEmptyNodeContainer,
			iconType: CmsResourceItemType.cmsEmptyNodeContainer,
			nodeSubType: undefined
		};
	}

	public get nodePathValue(): string {
		return 'message_cmsTreeNode';
	}

	private static readonly addCmsServerLabel = localize('cms.resource.tree.CmsTreeNode.addCmsServerLabel', "Add Central Management Server...");
}
