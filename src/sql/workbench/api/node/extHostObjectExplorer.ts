/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IThreadService } from 'vs/workbench/services/thread/common/threadService';
import { ExtHostObjectExplorerShape, SqlMainContext, MainThreadObjectExplorerShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import * as data from 'data';

export class ExtHostObjectExplorer extends ExtHostObjectExplorerShape  {

	private _proxy: MainThreadObjectExplorerShape;

	constructor(
		threadService: IThreadService
	) {
		super();
		this._proxy = threadService.get(SqlMainContext.MainThreadObjectExplorer);
	}

	public $getNode(connectionId: string, nodePath?: string): Thenable<data.objectexplorer.ObjectExplorerNode> {
		return this._proxy.$getNode(connectionId, nodePath).then(nodeInfo => new ObjectExplorerNode(nodeInfo, connectionId, this));
	}

	public $getSavedConnections(active?: boolean): Thenable<data.objectexplorer.ObjectExplorerNode[]> {
		return this._proxy.$getSavedConnections(active).then(results => results.map(result => new ObjectExplorerNode(result.nodeInfo, result.connectionId, this)));
	}

	public $find(connectionId?: string, type?: string, schema?: string, name?: string): Thenable<data.objectexplorer.ObjectExplorerNode[]> {
		return this._proxy.$find(connectionId, type, schema, name).then(results => results.map(result => new ObjectExplorerNode(result.nodeInfo, result.connectionId, this)));
	}

	public $selectNode(connectionId: string, nodePath: string, expanded: boolean): Thenable<void> {
		return this._proxy.$selectNode(connectionId, nodePath, expanded);
	}

	public $getChildren(connectionId: string, nodePath: string): Thenable<data.objectexplorer.ObjectExplorerNode[]> {
		return this._proxy.$getChildren(connectionId, nodePath).then(nodes => nodes.map(nodeInfo => new ObjectExplorerNode(nodeInfo, connectionId, this)));
	}

	public $isExpanded(connectionId: string, nodePath: string): Thenable<boolean> {
		return this._proxy.$isExpanded(connectionId, nodePath);
	}
}

class ObjectExplorerNode implements data.objectexplorer.ObjectExplorerNode {
	public connectionId: string;
	public nodePath: string;
	public nodeType: string;
	public nodeSubType: string;
	public nodeStatus: string;
	public label: string;
	public isLeaf: boolean;
	public metadata: data.ObjectMetadata;
	public errorMessage: string;

	constructor(nodeInfo: data.NodeInfo, connectionId: string, private _extHostObjectExplorer: ExtHostObjectExplorer) {
		Object.entries(nodeInfo).forEach(([key, value]) => this[key] = value);
		this.connectionId = connectionId;
	}

	isExpanded(): Thenable<boolean> {
		return this._extHostObjectExplorer.$isExpanded(this.connectionId, this.nodePath);
	}

	hasChildren(): Thenable<boolean> {
		return undefined;
	}

	hasParent(): Thenable<boolean> {
		return undefined;
	}

	expand(): Thenable<void> {
		return this._extHostObjectExplorer.$selectNode(this.connectionId, this.nodePath, true);
	}

	collapse(): Thenable<void> {
		return this._extHostObjectExplorer.$selectNode(this.connectionId, this.nodePath, false);
	}

	select(): Thenable<void> {
		return this._extHostObjectExplorer.$selectNode(this.connectionId, this.nodePath, undefined);
	}

	getChildren(): Thenable<data.objectexplorer.ObjectExplorerNode[]> {
		return this._extHostObjectExplorer.$getChildren(this.connectionId, this.nodePath);
	}

	getParent(): Thenable<data.objectexplorer.ObjectExplorerNode> {
		return undefined;
	}
}
