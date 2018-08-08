/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { RawContextKey, IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IConnectionProfile } from 'sqlops';
import { TreeNode } from 'sql/parts/objectExplorer/common/treeNode';

export class TreeNodeContextKey implements IContextKey<TreeNode> {

	static NodeType = new RawContextKey<string>('nodeType', undefined);
	static SubType = new RawContextKey<string>('nodeSubType', undefined);
	static Status = new RawContextKey<string>('nodeStatus', undefined);
	static TreeNode = new RawContextKey<TreeNode>('treeNode', undefined);
	static NodeLabel = new RawContextKey<string>('nodeLabel', undefined);

	private _nodeTypeKey: IContextKey<string>;
	private _subTypeKey: IContextKey<string>;
	private _statusKey: IContextKey<string>;
	private _treeNodeKey: IContextKey<TreeNode>;
	private _nodeLabelKey: IContextKey<string>;

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		this._nodeTypeKey = TreeNodeContextKey.NodeType.bindTo(contextKeyService);
		this._subTypeKey = TreeNodeContextKey.SubType.bindTo(contextKeyService);
		this._statusKey = TreeNodeContextKey.Status.bindTo(contextKeyService);
		this._treeNodeKey = TreeNodeContextKey.TreeNode.bindTo(contextKeyService);
		this._nodeLabelKey = TreeNodeContextKey.NodeLabel.bindTo(contextKeyService);
	}

	set(value: TreeNode) {
		this._treeNodeKey.set(value);
		this._nodeTypeKey.set(value && value.nodeTypeId);
		this._subTypeKey.set(value && value.nodeSubType);
		this._statusKey.set(value && value.nodeStatus);
		this._nodeLabelKey.set(value && value.label);
	}

	reset(): void {
		this._nodeTypeKey.reset();
		this._subTypeKey.reset();
		this._statusKey.reset();
		this._treeNodeKey.reset();
		this._nodeLabelKey.reset();
	}

	public get(): TreeNode {
		return this._treeNodeKey.get();
	}
}
