/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey, IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';

export class TreeNodeContextKey implements IContextKey<TreeNode> {

	static NodeType = new RawContextKey<string>('nodeType', undefined);
	static SubType = new RawContextKey<string>('nodeSubType', undefined);
	static Status = new RawContextKey<string>('nodeStatus', undefined);
	static TreeNode = new RawContextKey<TreeNode>('treeNode', undefined);
	static NodeLabel = new RawContextKey<string>('nodeLabel', undefined);
	static NodePath = new RawContextKey<string>('nodePath', undefined);
	static QueryEnabled = new RawContextKey<boolean>('QueryEnabled', false);

	private _nodeTypeKey: IContextKey<string>;
	private _subTypeKey: IContextKey<string>;
	private _statusKey: IContextKey<string>;
	private _treeNodeKey: IContextKey<TreeNode>;
	private _nodeLabelKey: IContextKey<string>;
	private _nodePathKey: IContextKey<string>;
	private _queryEnabled: IContextKey<boolean>;

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService
	) {
		this._nodeTypeKey = TreeNodeContextKey.NodeType.bindTo(contextKeyService);
		this._subTypeKey = TreeNodeContextKey.SubType.bindTo(contextKeyService);
		this._statusKey = TreeNodeContextKey.Status.bindTo(contextKeyService);
		this._treeNodeKey = TreeNodeContextKey.TreeNode.bindTo(contextKeyService);
		this._nodeLabelKey = TreeNodeContextKey.NodeLabel.bindTo(contextKeyService);
		this._nodePathKey = TreeNodeContextKey.NodePath.bindTo(contextKeyService);
		this._queryEnabled = TreeNodeContextKey.QueryEnabled.bindTo(contextKeyService);
	}

	set(value: TreeNode) {
		this._treeNodeKey.set(value);
		this._nodeTypeKey.set(value && value.nodeTypeId);
		this._subTypeKey.set(value && value.nodeSubType);
		if (value.nodeStatus) {
			this._statusKey.set(value && value.nodeStatus);
		}
		this._nodeLabelKey.set(value && value.label);
		this._nodePathKey.set(value && value.nodePath);
		const connectionProfile = value.getConnectionProfile();
		const capabilities = connectionProfile ? this._capabilitiesService.getCapabilities(connectionProfile.providerName) : undefined;
		this._queryEnabled.set(capabilities && capabilities.connection.isQueryProvider);
	}

	reset(): void {
		this._nodeTypeKey.reset();
		this._subTypeKey.reset();
		this._statusKey.reset();
		this._treeNodeKey.reset();
		this._nodeLabelKey.reset();
		this._nodePathKey.reset();
		this._queryEnabled.reset();
	}

	public get(): TreeNode | undefined {
		return this._treeNodeKey.get();
	}
}
