/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { NodeInfo } from 'sqlops';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { TreeNode } from '../treeNode';
import { AzureResourceItemType } from '../constants';

export class AzureResourceAccountNotSignedInTreeNode extends TreeNode {
	public getChildren(): TreeNode[] | Promise<TreeNode[]> {
		return [];
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		let item = new TreeItem(AzureResourceAccountNotSignedInTreeNode.signInLabel, TreeItemCollapsibleState.None);
		item.command = {
			title: AzureResourceAccountNotSignedInTreeNode.signInLabel,
			command: 'cms.resource.connectsqlserver',
			arguments: [this]
		};
		return item;
	}

	public getNodeInfo(): NodeInfo {
		return {
			label: AzureResourceAccountNotSignedInTreeNode.signInLabel,
			isLeaf: true,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: AzureResourceItemType.serverGroup,
			nodeSubType: undefined,
			iconType: AzureResourceItemType.serverGroup
		};
	}

	public get nodePathValue(): string {
		return 'message_cmsTreeNode';
	}

	private static readonly signInLabel = localize('cms.resource.tree.CMSTreeNode.label', 'Central Management Servers');
}
