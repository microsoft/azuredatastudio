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
		item.contextValue = AzureResourceItemType.message;
		item.command = {
			title: AzureResourceAccountNotSignedInTreeNode.signInLabel,
			command: 'azure.resource.signin',
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
			nodeType: AzureResourceItemType.message,
			nodeSubType: undefined,
			iconType: AzureResourceItemType.message
		};
	}

	public get nodePathValue(): string {
		return 'message_accountNotSignedIn';
	}

	private static readonly signInLabel = localize('azure.resource.tree.accountNotSignedInTreeNode.signInLabel', 'Sign in to Azure ...');
}
