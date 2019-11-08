/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionContextKey } from 'sql/workbench/parts/connection/common/connectionContextKey';
import { IOEShimService } from 'sql/workbench/parts/objectExplorer/browser/objectExplorerViewTreeShim';
import { ITreeItem } from 'sql/workbench/common/views';
import { Disposable } from 'vs/base/common/lifecycle';
import { IContextKey, IContextKeyService, RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IQueryManagementService } from 'sql/platform/query/common/queryManagement';
import { MssqlNodeContext } from 'sql/workbench/parts/dataExplorer/browser/mssqlNodeContext';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';

export interface INodeContextValue {
	node: ITreeItem;
	viewId: string;
}

export class NodeContextKey extends Disposable implements IContextKey<INodeContextValue> {

	static IsConnectable = new RawContextKey<boolean>('isConnectable', false);
	static IsConnected = new RawContextKey<boolean>('isConnected', false);
	static ViewId = new RawContextKey<string>('view', undefined);
	static ViewItem = new RawContextKey<string>('viewItem', undefined);
	static Node = new RawContextKey<INodeContextValue>('node', undefined);

	private readonly _connectionContextKey: ConnectionContextKey;
	private readonly _connectableKey: IContextKey<boolean>;
	private readonly _connectedKey: IContextKey<boolean>;
	private readonly _viewIdKey: IContextKey<string>;
	private readonly _viewItemKey: IContextKey<string>;
	private readonly _nodeContextKey: IContextKey<INodeContextValue>;

	private _nodeContextUtils: MssqlNodeContext;

	constructor(
		@IContextKeyService private contextKeyService: IContextKeyService,
		@IOEShimService private oeService: IOEShimService,
		@IQueryManagementService queryManagementService: IQueryManagementService,
		@IConnectionManagementService private connectionManagementService: IConnectionManagementService,
		@ICapabilitiesService private capabilitiesService: ICapabilitiesService
	) {
		super();

		this._connectableKey = NodeContextKey.IsConnectable.bindTo(contextKeyService);
		this._connectedKey = NodeContextKey.IsConnected.bindTo(contextKeyService);
		this._viewIdKey = NodeContextKey.ViewId.bindTo(contextKeyService);
		this._viewItemKey = NodeContextKey.ViewItem.bindTo(contextKeyService);
		this._nodeContextKey = NodeContextKey.Node.bindTo(contextKeyService);
		this._connectionContextKey = new ConnectionContextKey(contextKeyService, queryManagementService);
	}

	set(value: INodeContextValue) {
		if (value.node && value.node.payload) {
			this._connectableKey.set(true);
			this._connectedKey.set(this.oeService.isNodeConnected(value.viewId, value.node));
			this._connectionContextKey.set(value.node.payload);
		} else {
			this._connectableKey.set(false);
			this._connectedKey.set(false);
			this._connectionContextKey.reset();
		}
		if (value.node) {
			this._viewItemKey.set(value.node.contextValue);
		} else {
			this._viewItemKey.reset();
		}
		this._nodeContextKey.set(value);
		this._viewIdKey.set(value.viewId);
		this._nodeContextUtils = new MssqlNodeContext(this._nodeContextKey.get(), this.contextKeyService,
			this.connectionManagementService, this.capabilitiesService);
	}

	reset(): void {
		this._viewIdKey.reset();
		this._viewItemKey.reset();
		this._connectableKey.reset();
		this._connectedKey.reset();
		this._connectionContextKey.reset();
		this._nodeContextKey.reset();
		this._nodeContextUtils.dispose();
	}

	get(): INodeContextValue | undefined {
		return this._nodeContextKey.get();
	}
}
