/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey, IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IQueryManagementService } from 'sql/platform/query/common/queryManagement';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

export class ConnectionContextKey implements IContextKey<IConnectionProfile> {

	static Provider = new RawContextKey<string>('connectionProvider', undefined);
	static Server = new RawContextKey<string>('serverName', undefined);
	static Database = new RawContextKey<string>('databaseName', undefined);
	static Connection = new RawContextKey<IConnectionProfile>('connection', undefined);
	static IsQueryProvider = new RawContextKey<boolean>('isQueryProvider', false);
	static IsConnected = new RawContextKey<boolean>('isConnected', false);

	private _providerKey: IContextKey<string>;
	private _serverKey: IContextKey<string>;
	private _databaseKey: IContextKey<string>;
	private _connectionKey: IContextKey<IConnectionProfile>;
	private _isQueryProviderKey: IContextKey<boolean>;
	private _isConnected: IContextKey<boolean>;

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@IQueryManagementService private readonly queryManagementService: IQueryManagementService,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService
	) {
		this._providerKey = ConnectionContextKey.Provider.bindTo(contextKeyService);
		this._serverKey = ConnectionContextKey.Server.bindTo(contextKeyService);
		this._databaseKey = ConnectionContextKey.Database.bindTo(contextKeyService);
		this._connectionKey = ConnectionContextKey.Connection.bindTo(contextKeyService);
		this._isQueryProviderKey = ConnectionContextKey.IsQueryProvider.bindTo(contextKeyService);
		this._isConnected = ConnectionContextKey.IsConnected.bindTo(contextKeyService);
	}

	set(value: IConnectionProfile) {
		const queryProviders = this.queryManagementService.getRegisteredProviders();
		this._connectionKey.set(value);
		this._providerKey.set(value && value.providerName);
		this._serverKey.set(value && value.serverName);
		this._databaseKey.set(value && value.databaseName);
		this._isQueryProviderKey.set(value && value.providerName && queryProviders.indexOf(value.providerName) !== -1);
		const isConnected = value ? this.connectionManagementService.isProfileConnected(value) : false;
		this._isConnected.set(isConnected);
	}

	reset(): void {
		this._providerKey.reset();
		this._serverKey.reset();
		this._databaseKey.reset();
		this._connectionKey.reset();
		this._isQueryProviderKey.reset();
	}

	public get(): IConnectionProfile {
		return this._connectionKey.get();
	}
}
