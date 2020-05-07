/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { IContextKey, IContextKeyService, RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { MetadataType } from 'sql/platform/connection/common/connectionManagement';
import { ObjectMetadataWrapper } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/objectMetadataWrapper';

export declare type ContextResource = IConnectionProfile | ObjectMetadataWrapper;

export interface IContextValue {
	resource: ContextResource;
	providerName: string;
	isCloud: boolean;
	engineEdition: number;
}

export class ItemContextKey extends Disposable implements IContextKey<IContextValue> {

	static readonly ItemType = new RawContextKey<string>('itemType', undefined);
	static readonly Item = new RawContextKey<IContextValue>('item', undefined);
	static readonly ConnectionProvider = new RawContextKey<string>('provider', undefined);
	static readonly IsCloud = new RawContextKey<boolean>('isCloud', undefined);
	static readonly EngineEdition = new RawContextKey<number>('engineEdition', undefined);

	private _itemTypeKey: IContextKey<string>;
	private _itemKey: IContextKey<IContextValue>;
	private _connectionProviderKey: IContextKey<string>;
	private _isCloudKey: IContextKey<boolean>;
	private _engineEditionKey: IContextKey<number>;

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		super();

		this._itemTypeKey = ItemContextKey.ItemType.bindTo(contextKeyService);
		this._itemKey = ItemContextKey.Item.bindTo(contextKeyService);
		this._connectionProviderKey = ItemContextKey.ConnectionProvider.bindTo(contextKeyService);
		this._isCloudKey = ItemContextKey.IsCloud.bindTo(contextKeyService);
		this._engineEditionKey = ItemContextKey.EngineEdition.bindTo(contextKeyService);
	}

	set(value: IContextValue) {
		this._itemKey.set(value);
		this._connectionProviderKey.set(value.providerName.toLowerCase());
		this._isCloudKey.set(value.isCloud);
		this._engineEditionKey.set(value.engineEdition);
		if (value.resource instanceof ObjectMetadataWrapper) {
			switch (value.resource.metadataType) {
				case MetadataType.Function:
					this._itemTypeKey.set('function');
					break;
				case MetadataType.SProc:
					this._itemTypeKey.set('sproc');
					break;
				case MetadataType.Table:
					this._itemTypeKey.set('table');
					break;
				case MetadataType.View:
					this._itemTypeKey.set('view');
					break;
			}
		} else {
			this._itemTypeKey.set('database');
		}
	}

	reset(): void {
		this._itemTypeKey.reset();
		this._itemKey.reset();
		this._connectionProviderKey.reset();
		this._isCloudKey.reset();
		this._engineEditionKey.reset();
	}

	get(): IContextValue | undefined {
		return this._itemKey.get();
	}
}
