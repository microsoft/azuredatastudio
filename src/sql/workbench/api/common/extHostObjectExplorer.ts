/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMainContext, SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { ExtHostObjectExplorerShape, MainThreadObjectExplorerShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ExtHostCommands } from 'vs/workbench/api/common/extHostCommands';
import { TreeViewItemHandleArg, NodeType } from 'sql/workbench/common/views';

export class ExtHostObjectExplorer implements ExtHostObjectExplorerShape {

	private _proxy: MainThreadObjectExplorerShape;

	constructor(
		mainContext: IMainContext,
		commands: ExtHostCommands
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadObjectExplorer);

		function isDataExplorerTreeViewItemHandleArg(arg: any): boolean {
			return arg?.$treeItem?.payload;
		}

		function convertDataExplorerArgument(arg: TreeViewItemHandleArg): any {
			return <azdata.ObjectExplorerContext>{
				connectionProfile: arg.$treeItem.payload,
				isConnectionNode: arg.$treeItem?.type === NodeType.Server || arg.$treeItem?.type === NodeType.Database,
				nodeInfo: arg.$treeItem.nodeInfo
			};
		}

		commands.registerArgumentProcessor({
			processArgument: arg => {
				if (isDataExplorerTreeViewItemHandleArg(arg)) {
					return convertDataExplorerArgument(arg);
				}
				return arg;
			}
		});
	}

	public $getNode(connectionId: string, nodePath?: string): Thenable<azdata.objectexplorer.ObjectExplorerNode> {
		return this._proxy.$getNode(connectionId, nodePath).then(nodeInfo => nodeInfo === undefined ? undefined : new ExtHostObjectExplorerNode(nodeInfo, connectionId, this._proxy));
	}

	public $getActiveConnectionNodes(): Thenable<azdata.objectexplorer.ObjectExplorerNode[]> {
		return this._proxy.$getActiveConnectionNodes().then(results => results.map(result => new ExtHostObjectExplorerNode(result.nodeInfo, result.connectionId, this._proxy)));
	}

	public $findNodes(connectionId: string, type: string, schema: string, name: string, database: string, parentObjectNames: string[]): Thenable<azdata.objectexplorer.ObjectExplorerNode[]> {
		return this._proxy.$findNodes(connectionId, type, schema, name, database, parentObjectNames).then(results => results.map(result => new ExtHostObjectExplorerNode(result, connectionId, this._proxy)));
	}

	public $getNodeActions(connectionId: string, nodePath: string): Thenable<string[]> {
		return this._proxy.$getNodeActions(connectionId, nodePath);
	}

	public $getSessionConnectionProfile(sessionId: string): Thenable<azdata.IConnectionProfile> {
		return this._proxy.$getSessionConnectionProfile(sessionId);
	}
}

export class ExtHostObjectExplorerNode implements azdata.objectexplorer.ObjectExplorerNode {
	public connectionId: string;
	public nodePath: string;
	public parentNodePath: string;
	public nodeType: string;
	public nodeSubType: string;
	public nodeStatus: string;
	public label: string;
	public isLeaf: boolean;
	public metadata: azdata.ObjectMetadata;
	public errorMessage: string;

	constructor(nodeInfo: azdata.NodeInfo, connectionId: string, private _proxy: MainThreadObjectExplorerShape) {
		this.getDetailsFromInfo(nodeInfo);
		this.connectionId = connectionId;
	}

	isExpanded(): Thenable<boolean> {
		return this._proxy.$isExpanded(this.connectionId, this.nodePath);
	}

	setExpandedState(expandedState: vscode.TreeItemCollapsibleState): Thenable<void> {
		return this._proxy.$setExpandedState(this.connectionId, this.nodePath, expandedState);
	}

	setSelected(selected: boolean, clearOtherSelections: boolean = undefined): Thenable<void> {
		return this._proxy.$setSelected(this.connectionId, this.nodePath, selected, clearOtherSelections);
	}

	getChildren(): Thenable<azdata.objectexplorer.ObjectExplorerNode[]> {
		return this._proxy.$getChildren(this.connectionId, this.nodePath).then(children => children.map(nodeInfo => new ExtHostObjectExplorerNode(nodeInfo, this.connectionId, this._proxy)));
	}

	getParent(): Thenable<azdata.objectexplorer.ObjectExplorerNode | undefined> {
		let parentPath;
		// parentNodePath property is introduced after we discovered the flaw of the following code.
		// To maintain backward compatibility with other providers, we need to keep the following code.
		if (this.parentNodePath === undefined) {
			// Object nodes have a name like <schema>.<name> in the nodePath - we can't use label because
			// that may have additional display information appended to it. Items without metadata are nodes
			// such as folders that don't correspond to actual objects and so just use the label
			let nodePathName = this.metadata ?
				`${this.metadata.schema ? this.metadata.schema + '.' : ''}${this.metadata.name}` :
				this.label;

			// -1 to remove the / as well
			let parentPathEndIndex: number = this.nodePath.lastIndexOf(nodePathName) - 1;
			parentPath = this.nodePath.slice(0, parentPathEndIndex)
		} else {
			parentPath = this.parentNodePath;
		}

		if (!parentPath) {
			// At root node
			return Promise.resolve(undefined);
		}
		return this._proxy.$getNode(this.connectionId, this.parentNodePath).then(
			nodeInfo => nodeInfo ? new ExtHostObjectExplorerNode(nodeInfo, this.connectionId, this._proxy) : undefined);
	}

	refresh(): Thenable<void> {
		return this._proxy.$refresh(this.connectionId, this.nodePath).then(nodeInfo => this.getDetailsFromInfo(nodeInfo));
	}

	private getDetailsFromInfo(nodeInfo: azdata.NodeInfo): void {
		this.nodePath = nodeInfo.nodePath;
		this.parentNodePath = nodeInfo.parentNodePath;
		this.nodeType = nodeInfo.nodeType;
		this.nodeSubType = nodeInfo.nodeSubType;
		this.nodeStatus = nodeInfo.nodeStatus;
		this.label = nodeInfo.label;
		this.isLeaf = nodeInfo.isLeaf;
		this.metadata = nodeInfo.metadata;
		this.errorMessage = nodeInfo.errorMessage;
	}
}
