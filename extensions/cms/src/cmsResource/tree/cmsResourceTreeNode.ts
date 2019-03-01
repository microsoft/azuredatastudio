/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { AppContext } from '../../appContext';
import { TreeNode } from '../treeNode';
import { CmsResourceTreeNodeBase } from './baseTreeNodes';
import { CmsResourceItemType } from '../constants';
import { ICmsResourceTreeChangeHandler } from './treeChangeHandler';
import { RegisteredServerTreeNode } from './registeredServerTreeNode';
import { ServerGroupTreeNode } from './serverGroupTreeNode';

const localize = nls.loadMessageBundle();

export class CmsResourceTreeNode extends CmsResourceTreeNodeBase {

	private _id: string = undefined;

	public constructor(
		private name: string,
		private description: string,
		private registeredServersList: sqlops.RegisteredServerResult[],
		private registeredGroupsList: sqlops.ServerGroupResult[],
		appContext: AppContext,
		treeChangeHandler: ICmsResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super(appContext, treeChangeHandler, parent);
		this._id = `cms_cmsServer_${this.name}`;
	}

	public async getChildren(): Promise<TreeNode[]> {
		try {
			let nodes: TreeNode[] = [];
			if (this.registeredServersList) {
				this.registeredServersList.forEach((registeredServer) => {
					nodes.push(new RegisteredServerTreeNode(registeredServer.name,
						registeredServer.description, registeredServer.relativePath,
						this.appContext,
						this.treeChangeHandler, this));
				});
			}
			if (this.registeredGroupsList) {
				this.registeredGroupsList.forEach((serverGroup) => {
					nodes.push(new ServerGroupTreeNode(serverGroup.name, serverGroup.description,
						serverGroup.relativePath, this.appContext, this.treeChangeHandler, this));
				});
			}
			return nodes;
		} catch {
			return [];
		}
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		const item = new TreeItem(this.name, TreeItemCollapsibleState.Collapsed);
		item.contextValue = CmsResourceItemType.serverGroup;
		item.id = this._id;
		item.tooltip = this.description;
		// item.iconPath = {
		// 	dark: this.appContext.extensionContext.asAbsolutePath('resources/dark/subscription_inverse.svg'),
		// 	light: this.appContext.extensionContext.asAbsolutePath('resources/light/subscription.svg')
		// };
		return item;
	}

	public getNodeInfo(): sqlops.NodeInfo {
		return {
			label: this.name,
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: CmsResourceItemType.cmsNodeContainer,
			nodeSubType: undefined,
			iconType: CmsResourceItemType.cmsNodeContainer
		};
	}

	public get nodePathValue(): string {
        return this._id;
	}
}
