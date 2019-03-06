/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { TreeNode } from '../treeNode';
import { CmsResourceItemType } from '../constants';
import { CmsResourceTreeNodeBase } from './baseTreeNodes';
import { AppContext } from '../../appContext';
import { ICmsResourceTreeChangeHandler } from './treeChangeHandler';

export class RegisteredServerTreeNode extends CmsResourceTreeNodeBase {

	private _id: string = undefined;

	constructor(
		name: string,
		description: string,
		private _relativePath: string,
		ownerUri: string,
		appContext: AppContext,
		treeChangeHandler: ICmsResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super(name, description, ownerUri, appContext, treeChangeHandler, parent);
		this._id = `cms_registeredServer_${this.name}`;
	}

	public async getChildren(): Promise<TreeNode[]> {
		try {
			let nodes: TreeNode[] = [];
			return nodes;
		} catch {
			return [];
		}
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		let item = new TreeItem(this.name, TreeItemCollapsibleState.None);
		item.contextValue = CmsResourceItemType.registeredServer;
		item.id = this._id;
		item.tooltip = this.description;
		return item;
	}

	public getNodeInfo(): azdata.NodeInfo {
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

	public get relativePath(): string {
		return this._relativePath;
	}
}
