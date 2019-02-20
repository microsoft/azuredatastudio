/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { SqlExtHostContext, SqlMainContext, ExtHostObjectExplorerShape, MainThreadObjectExplorerShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IObjectExplorerService, NodeInfoWithConnection } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import * as TaskUtilities from 'sql/workbench/common/taskUtilities';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import { TreeItemCollapsibleState } from 'sql/parts/objectExplorer/common/treeNode';

@extHostNamedCustomer(SqlMainContext.MainThreadObjectExplorer)
export class MainThreadObjectExplorer implements MainThreadObjectExplorerShape {

	private _proxy: ExtHostObjectExplorerShape;
	private _toDispose: IDisposable[];

	constructor(
		extHostContext: IExtHostContext,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IEditorService private _workbenchEditorService: IEditorService
	) {
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostObjectExplorer);
		}
		this._toDispose = [];
	}

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
	}

	public $getNode(connectionId: string, nodePath?: string): Thenable<sqlops.NodeInfo> {
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

	public $getChildren(connectionId: string, nodePath: string): Thenable<sqlops.NodeInfo[]> {
		return this._objectExplorerService.getTreeNode(connectionId, nodePath).then(treeNode => treeNode.getChildren().then(children => children.map(node => node.toNodeInfo())));
	}

	public $isExpanded(connectionId: string, nodePath: string): Thenable<boolean> {
		return this._objectExplorerService.getTreeNode(connectionId, nodePath).then(treeNode => treeNode.isExpanded());
	}

	public $findNodes(connectionId: string, type: string, schema: string, name: string, database: string, parentObjectNames: string[]): Thenable<sqlops.NodeInfo[]> {
		return this._objectExplorerService.findNodes(connectionId, type, schema, name, database, parentObjectNames);
	}

	public $refresh(connectionId: string, nodePath: string): Thenable<sqlops.NodeInfo> {
		return this._objectExplorerService.refreshNodeInView(connectionId, nodePath).then(node => node.toNodeInfo());
	}

	public $getNodeActions(connectionId: string, nodePath: string): Thenable<string[]> {
		return this._objectExplorerService.getNodeActions(connectionId, nodePath);
	}
	
	public $getSessionConnectionProfile(sessionId: string): Thenable<sqlops.IConnectionProfile> {
		return Promise.resolve(this._objectExplorerService.getSessionConnectionProfile(sessionId));
	}
}
