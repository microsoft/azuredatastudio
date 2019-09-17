/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlMainContext, MainThreadObjectExplorerShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { IObjectExplorerService, NodeInfoWithConnection } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { Disposable } from 'vs/base/common/lifecycle';

@extHostNamedCustomer(SqlMainContext.MainThreadObjectExplorer)
export class MainThreadObjectExplorer extends Disposable implements MainThreadObjectExplorerShape {

	constructor(
		extHostContext: IExtHostContext,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
	) {
		super();
	}

	public $getNode(connectionId: string, nodePath?: string): Thenable<azdata.NodeInfo> {
		return this._objectExplorerService.getTreeNode(connectionId, nodePath).then(treeNode => {
			if (!treeNode) {
				return undefined;
			}
			return treeNode.toNodeInfo();
		});
	}

	public $getActiveConnectionNodes(): Thenable<NodeInfoWithConnection[]> {
		let connectionNodes = this._objectExplorerService.getActiveConnectionNodes();
		return Promise.resolve(connectionNodes.map(node => {
			return { connectionId: node.connection.id, nodeInfo: node.toNodeInfo() };
		}));
	}

	public $setExpandedState(connectionId: string, nodePath: string, expandedState: vscode.TreeItemCollapsibleState): Thenable<void> {
		return this._objectExplorerService.getTreeNode(connectionId, nodePath).then(treeNode => treeNode.setExpandedState(expandedState));
	}

	public $setSelected(connectionId: string, nodePath: string, selected: boolean, clearOtherSelections: boolean = undefined): Thenable<void> {
		return this._objectExplorerService.getTreeNode(connectionId, nodePath).then(treeNode => treeNode.setSelected(selected, clearOtherSelections));
	}

	public $getChildren(connectionId: string, nodePath: string): Thenable<azdata.NodeInfo[]> {
		return this._objectExplorerService.getTreeNode(connectionId, nodePath).then(treeNode => treeNode.getChildren().then(children => children.map(node => node.toNodeInfo())));
	}

	public $isExpanded(connectionId: string, nodePath: string): Thenable<boolean> {
		return this._objectExplorerService.getTreeNode(connectionId, nodePath).then(treeNode => treeNode.isExpanded());
	}

	public $findNodes(connectionId: string, type: string, schema: string, name: string, database: string, parentObjectNames: string[]): Thenable<azdata.NodeInfo[]> {
		return this._objectExplorerService.findNodes(connectionId, type, schema, name, database, parentObjectNames);
	}

	public $refresh(connectionId: string, nodePath: string): Thenable<azdata.NodeInfo> {
		return this._objectExplorerService.refreshNodeInView(connectionId, nodePath).then(node => node.toNodeInfo());
	}

	public $getNodeActions(connectionId: string, nodePath: string): Thenable<string[]> {
		return this._objectExplorerService.getNodeActions(connectionId, nodePath);
	}

	public $getSessionConnectionProfile(sessionId: string): Thenable<azdata.IConnectionProfile> {
		return Promise.resolve(this._objectExplorerService.getSessionConnectionProfile(sessionId));
	}
}
