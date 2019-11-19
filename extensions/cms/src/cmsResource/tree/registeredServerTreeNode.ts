/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { TreeItemCollapsibleState } from 'vscode';
import { TreeNode } from '../treeNode';
import { CmsResourceItemType } from '../constants';
import { CmsResourceTreeNodeBase } from './baseTreeNodes';
import { AppContext } from '../../appContext';
import { ICmsResourceTreeChangeHandler } from './treeChangeHandler';

export class RegisteredServerTreeNode extends CmsResourceTreeNodeBase {

	constructor(
		name: string,
		description: string,
		private serverName: string,
		private _relativePath: string,
		ownerUri: string,
		appContext: AppContext,
		treeChangeHandler: ICmsResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super(name, description, ownerUri, appContext, treeChangeHandler, parent);
	}

	public async getChildren(): Promise<TreeNode[] | undefined> {
		return undefined;
	}

	public getTreeItem(): azdata.TreeItem | Promise<azdata.TreeItem> {
		let payload = {
			id: this._id,
			connectionName: this.name ? this.name : this.serverName,
			serverName: this.serverName,
			databaseName: '',
			userName: undefined as string,
			password: undefined as string,
			authenticationType: 'Integrated',
			savePassword: false,
			groupFullName: '',
			groupId: '',
			providerName: 'MSSQL',
			saveProfile: false,
			options: {}
		};
		let treeItem = {
			payload: payload,
			id: this._id,
			tooltip: this.description,
			contextValue: CmsResourceItemType.registeredServer,
			collapsibleState: TreeItemCollapsibleState.Collapsed,
			label: this.name ? this.name : this.serverName,
			childProvider: 'MSSQL',
			type: azdata.ExtensionNodeType.Server,
			iconPath: {
				dark: this.appContext.extensionContext.asAbsolutePath('resources/light/regserverserver.svg'),
				light: this.appContext.extensionContext.asAbsolutePath('resources/light/regserverserver.svg')
			}
		};

		return treeItem;
	}

	public getNodeInfo(): azdata.NodeInfo {
		return {
			label: this.name ? this.name : this.serverName,
			isLeaf: false,
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
