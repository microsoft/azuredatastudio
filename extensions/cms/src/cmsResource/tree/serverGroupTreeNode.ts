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
import { RegisteredServerTreeNode } from './registeredServerTreeNode';

export class ServerGroupTreeNode extends CmsResourceTreeNodeBase {

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
		this._id = `cms_serverGroup_${this.name}`;
	}
	public getChildren(): TreeNode[] | Promise<TreeNode[]> {
		try {
			let nodes = [];
			return this.appContext.apiWrapper.getRegisteredServers(this.ownerUri, this.relativePath).then((result) => {
				if (result) {
					if (result.registeredServersList) {
						result.registeredServersList.forEach((registeredServer) => {
							nodes.push(new RegisteredServerTreeNode(
								registeredServer.name,
								registeredServer.description,
								registeredServer.serverName,
								registeredServer.relativePath,
								this.ownerUri,
								this.appContext,
								this.treeChangeHandler, this));
						});
					}
					if (result.registeredServerGroups) {
						if (result.registeredServerGroups) {
							result.registeredServerGroups.forEach((serverGroup) => {
								nodes.push(new ServerGroupTreeNode(
									serverGroup.name,
									serverGroup.description,
									serverGroup.relativePath,
									this.ownerUri,
									this.appContext, this.treeChangeHandler, this));
							});
						}
					}
					return nodes;
				}
			});
		} catch {
			return [];
		}

	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		let item = new TreeItem(this.name, TreeItemCollapsibleState.Collapsed);
		item.contextValue = CmsResourceItemType.serverGroup;
		item.id = this._id;
		item.tooltip = this.description;
		return item;
	}

	public getNodeInfo(): azdata.NodeInfo {
		return {
			label: this.name,
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: CmsResourceItemType.serverGroup,
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
