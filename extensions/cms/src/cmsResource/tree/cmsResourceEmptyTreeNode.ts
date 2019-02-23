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
import { CmsResourceItemType } from '../constants';

export class CmsResourceEmptyTreeNode extends TreeNode {
	public getChildren(): TreeNode[] | Promise<TreeNode[]> {
		return [];
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		let item = new TreeItem(CmsResourceEmptyTreeNode.registerServerLabel, TreeItemCollapsibleState.None);
		item.command = {
			title: CmsResourceEmptyTreeNode.registerServerLabel,
			command: 'cms.resource.registerServer',
			arguments: [this]
		};
		return item;
	}

	public getNodeInfo(): NodeInfo {
		return {
			label: CmsResourceEmptyTreeNode.registerServerLabel,
			isLeaf: true,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: CmsResourceItemType.serverGroup,
			nodeSubType: undefined
		};
	}

	public get nodePathValue(): string {
		return 'message_cmsTreeNode';
	}

	private static readonly registerServerLabel = localize('cms.resource.tree.CMSTreeNode.registerServerLabel', 'Register Central Management Server');
}
