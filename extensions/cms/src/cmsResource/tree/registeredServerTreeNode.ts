/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { TreeNode } from '../treeNode';
import { CmsResourceItemType } from '../constants';
import { CmsResourceTreeNodeBase } from './baseTreeNodes';
import { AppContext } from '../../appContext';
import { ICmsResourceTreeChangeHandler } from './treeChangeHandler';
import { ServerGroupTreeNode } from './serverGroupTreeNode';

export class RegisteredServerTreeNode extends CmsResourceTreeNodeBase {

	private _id: string = undefined;
	private _relativePath: string = undefined;

	constructor(
		private name: string,
		private description: string,
		private relativePath: string,
		appContext: AppContext,
		treeChangeHandler: ICmsResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super(appContext, treeChangeHandler, parent);
		this._id = `cms_registeredServer_${this.name}`;
		this._relativePath = relativePath;
	}

	public async getChildren(): Promise<TreeNode[]> {
		try {
			let nodes: TreeNode[] = [];
		} catch {
			return [];
		}
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		let item = new TreeItem(this.name, TreeItemCollapsibleState.None);
		item.id = this._id;
		item.tooltip = this.description;
		return item;
	}

	public getNodeInfo(): sqlops.NodeInfo {
		return {
			label: this.name,
			isLeaf: true,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: CmsResourceItemType.registeredServer,
			nodeSubType: undefined
		};
	}

	public get nodePathValue(): string {
		return this._id;
	}
}
