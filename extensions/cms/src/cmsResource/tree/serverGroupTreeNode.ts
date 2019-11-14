/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import * as azdata from 'azdata';
import { TreeNode } from '../treeNode';
import { CmsResourceItemType } from '../constants';
import { CmsResourceTreeNodeBase } from './baseTreeNodes';
import { AppContext } from '../../appContext';
import { ICmsResourceTreeChangeHandler } from './treeChangeHandler';
import { RegisteredServerTreeNode } from './registeredServerTreeNode';
import { CmsResourceMessageTreeNode } from '../messageTreeNode';
import { CmsResourceTreeNode } from './cmsResourceTreeNode';

export class ServerGroupTreeNode extends CmsResourceTreeNodeBase {

	private _serverGroupNodes: ServerGroupTreeNode[] = [];

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
	}
	public getChildren(): TreeNode[] | Promise<TreeNode[]> {
		try {
			let nodes: TreeNode[] = [];
			return this.appContext.cmsUtils.getRegisteredServers(this.ownerUri, this.relativePath).then((result) => {
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
							this._serverGroupNodes = [];
							result.registeredServerGroups.forEach((serverGroup) => {
								let serverGroupNode = new ServerGroupTreeNode(
									serverGroup.name,
									serverGroup.description,
									serverGroup.relativePath,
									this.ownerUri,
									this.appContext, this.treeChangeHandler, this);
								nodes.push(serverGroupNode);
								this._serverGroupNodes.push(serverGroupNode);
							});
						}
					}
					if (nodes.length > 0) {
						return nodes;
					} else {
						return [CmsResourceMessageTreeNode.create(CmsResourceTreeNode.noResourcesLabel, undefined)];
					}
				} else {
					return [CmsResourceMessageTreeNode.create(CmsResourceTreeNode.noResourcesLabel, undefined)];
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
		item.iconPath = {
			dark: this.appContext.extensionContext.asAbsolutePath('resources/dark/folder_inverse.svg'),
			light: this.appContext.extensionContext.asAbsolutePath('resources/light/folder.svg')
		};
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

	public get serverGroupNodes(): ServerGroupTreeNode[] {
		return this._serverGroupNodes;
	}
}
