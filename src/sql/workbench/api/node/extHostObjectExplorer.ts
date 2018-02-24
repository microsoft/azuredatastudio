/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IThreadService } from 'vs/workbench/services/thread/common/threadService';
import { ExtHostObjectExplorerShape, SqlMainContext, MainThreadObjectExplorerShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import * as sqlops from 'sqlops';

export class ExtHostObjectExplorer extends ExtHostObjectExplorerShape  {

	private _proxy: MainThreadObjectExplorerShape;

	constructor(
		threadService: IThreadService
	) {
		super();
		this._proxy = threadService.get(SqlMainContext.MainThreadObjectExplorer);
	}

	public $getNode(connectionId: string, nodePath?: string): Thenable<sqlops.objectexplorer.ObjectExplorerNode> {
		return this._proxy.$getNode(connectionId, nodePath).then(nodeInfo => nodeInfo === undefined ? undefined : new ObjectExplorerNode(nodeInfo, connectionId, this));
	}

	public $getActiveConnections(): Thenable<sqlops.objectexplorer.ObjectExplorerNode[]> {
		return this._proxy.$getActiveConnections().then(results => results.map(result => new ObjectExplorerNode(result.nodeInfo, result.connectionId, this)));
	}

	public $expandNode(connectionId: string, nodePath: string): Thenable<void> {
		return this._proxy.$expandNode(connectionId, nodePath);
	}

	public $collapseNode(connectionId: string, nodePath: string): Thenable<void> {
		return this._proxy.$collapseNode(connectionId, nodePath);
	}

	public $selectNode(connectionId: string, nodePath: string): Thenable<void> {
		return this._proxy.$selectNode(connectionId, nodePath);
	}

	public $getChildren(connectionId: string, nodePath: string): Thenable<sqlops.objectexplorer.ObjectExplorerNode[]> {
		return this._proxy.$getChildren(connectionId, nodePath).then(nodes => nodes.map(nodeInfo => new ObjectExplorerNode(nodeInfo, connectionId, this)));
	}

	public $isExpanded(connectionId: string, nodePath: string): Thenable<boolean> {
		return this._proxy.$isExpanded(connectionId, nodePath);
	}
}

class ObjectExplorerNode implements sqlops.objectexplorer.ObjectExplorerNode {
	public connectionId: string;
	public nodePath: string;
	public nodeType: string;
	public nodeSubType: string;
	public nodeStatus: string;
	public label: string;
	public isLeaf: boolean;
	public metadata: sqlops.ObjectMetadata;
	public errorMessage: string;

	constructor(nodeInfo: sqlops.NodeInfo, connectionId: string, private _extHostObjectExplorer: ExtHostObjectExplorer) {
		Object.entries(nodeInfo).forEach(([key, value]) => this[key] = value);
		this.connectionId = connectionId;
	}

	isExpanded(): Thenable<boolean> {
		return this._extHostObjectExplorer.$isExpanded(this.connectionId, this.nodePath);
	}

	expand(): Thenable<void> {
		return this._extHostObjectExplorer.$expandNode(this.connectionId, this.nodePath);
	}

	collapse(): Thenable<void> {
		return this._extHostObjectExplorer.$collapseNode(this.connectionId, this.nodePath);
	}

	select(): Thenable<void> {
		return this._extHostObjectExplorer.$selectNode(this.connectionId, this.nodePath);
	}

	getChildren(): Thenable<sqlops.objectexplorer.ObjectExplorerNode[]> {
		return this._extHostObjectExplorer.$getChildren(this.connectionId, this.nodePath);
	}

	getParent(): Thenable<sqlops.objectexplorer.ObjectExplorerNode> {
		let parentPathEndIndex = this.nodePath.lastIndexOf('/');
		if (parentPathEndIndex === -1) {
			return Promise.resolve(undefined);
		}
		return this._extHostObjectExplorer.$getNode(this.connectionId, this.nodePath.slice(0, parentPathEndIndex));
	}
}
