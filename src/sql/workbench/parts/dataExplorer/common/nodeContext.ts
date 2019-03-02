/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionContextKey } from 'sql/parts/connection/common/connectionContextKey';
import { IOEShimService } from 'sql/parts/objectExplorer/common/objectExplorerViewTreeShim';
import { ITreeItem } from 'sql/workbench/common/views';
import { Disposable } from 'vs/base/common/lifecycle';
import { IContextKey, IContextKeyService, RawContextKey } from 'vs/platform/contextkey/common/contextkey';

export interface INodeContextValue {
	node: ITreeItem;
	viewId: string;
}

export class NodeContextKey extends Disposable implements IContextKey<INodeContextValue> {

	static Connectable = new RawContextKey<boolean>('isConnectable', false);
	static Connected = new RawContextKey<boolean>('isConnected', false);
	static ViewId = new RawContextKey<string>('view', undefined);
	static Node = new RawContextKey<INodeContextValue>('node', undefined);

	private readonly _connectionContextKey: ConnectionContextKey;
	private readonly _connectableKey: IContextKey<boolean>;
	private readonly _connectedKey: IContextKey<boolean>;
	private readonly _viewIdKey: IContextKey<string>;
	private readonly _nodeContextKey: IContextKey<INodeContextValue>;

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@IOEShimService private oeService: IOEShimService
	) {
		super();

		this._connectableKey = NodeContextKey.Connectable.bindTo(contextKeyService);
		this._connectedKey = NodeContextKey.Connected.bindTo(contextKeyService);
		this._viewIdKey = NodeContextKey.ViewId.bindTo(contextKeyService);
		this._nodeContextKey = NodeContextKey.Node.bindTo(contextKeyService);
		this._connectionContextKey = new ConnectionContextKey(contextKeyService);
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
		this._nodeContextKey.set(value);
		this._viewIdKey.set(value.viewId);
	}

	reset(): void {
		this._viewIdKey.reset();
		this._connectableKey.reset();
		this._connectedKey.reset();
		this._connectionContextKey.reset();
		this._nodeContextKey.reset();
	}

	get(): INodeContextValue | undefined {
		return this._nodeContextKey.get();
	}
}
