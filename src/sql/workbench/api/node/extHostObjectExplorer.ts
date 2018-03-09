/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IThreadService } from 'vs/workbench/services/thread/common/threadService';
import { ExtHostObjectExplorerShape, SqlMainContext, MainThreadObjectExplorerShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';

export class ExtHostObjectExplorer implements ExtHostObjectExplorerShape  {

	private _proxy: MainThreadObjectExplorerShape;

	constructor(
		threadService: IThreadService
	) {
		this._proxy = threadService.get(SqlMainContext.MainThreadObjectExplorer);
	}

	public $getNode(connectionId: string, nodePath?: string): Thenable<sqlops.objectexplorer.ObjectExplorerNode> {
		return this._proxy.$getNode(connectionId, nodePath).then(nodeInfo => nodeInfo === undefined ? undefined : new ExtHostObjectExplorerNode(nodeInfo, connectionId, this._proxy));
	}

	public $getActiveConnectionNodes(): Thenable<sqlops.objectexplorer.ObjectExplorerNode[]> {
		return this._proxy.$getActiveConnectionNodes().then(results => results.map(result => new ExtHostObjectExplorerNode(result.nodeInfo, result.connectionId, this._proxy)));
	}
}

class ExtHostObjectExplorerNode implements sqlops.objectexplorer.ObjectExplorerNode {
	public connectionId: string;
	public nodePath: string;
	public nodeType: string;
	public nodeSubType: string;
	public nodeStatus: string;
	public label: string;
	public isLeaf: boolean;
	public metadata: sqlops.ObjectMetadata;
	public errorMessage: string;

	constructor(nodeInfo: sqlops.NodeInfo, connectionId: string, private _proxy: MainThreadObjectExplorerShape) {
		Object.entries(nodeInfo).forEach(([key, value]) => this[key] = value);
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

	getChildren(): Thenable<sqlops.objectexplorer.ObjectExplorerNode[]> {
		return this._proxy.$getChildren(this.connectionId, this.nodePath).then(children => children.map(nodeInfo => new ExtHostObjectExplorerNode(nodeInfo, this.connectionId, this._proxy)));
	}

	getParent(): Thenable<sqlops.objectexplorer.ObjectExplorerNode> {
		let parentPathEndIndex = this.nodePath.lastIndexOf('/');
		if (parentPathEndIndex === -1) {
			return Promise.resolve(undefined);
		}
		return this._proxy.$getNode(this.connectionId, this.nodePath.slice(0, parentPathEndIndex)).then(nodeInfo => nodeInfo ? new ExtHostObjectExplorerNode(nodeInfo, this.connectionId, this._proxy) : undefined);
	}
}
