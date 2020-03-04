/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey, IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IConnectionProfile } from 'azdata';
import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';

export class ConnectionContextKey implements IContextKey<IConnectionProfile> {

	static Provider = new RawContextKey<string>('connectionProvider', undefined);
	static Server = new RawContextKey<string>('serverName', undefined);
	static Database = new RawContextKey<string>('databaseName', undefined);
	static Connection = new RawContextKey<IConnectionProfile>('connection', undefined);
	static IsQueryProvider = new RawContextKey<boolean>('isQueryProvider', false);
	static IsSystemDb = new RawContextKey<boolean>('isSystemDb', false);
	static IsDefaultDb = new RawContextKey<boolean>('isDefaultDb', false);

	private _providerKey: IContextKey<string>;
	private _serverKey: IContextKey<string>;
	private _databaseKey: IContextKey<string>;
	private _connectionKey: IContextKey<IConnectionProfile>;
	private _isQueryProviderKey: IContextKey<boolean>;
	private _isSystemDb: IContextKey<boolean>;
	private _isDefaultDb: IContextKey<boolean>;

	private _systemDbs = new Set<string>(['master', 'model', 'msdb', 'tempdb']);

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@IQueryManagementService private queryManagementService: IQueryManagementService
	) {
		this._providerKey = ConnectionContextKey.Provider.bindTo(contextKeyService);
		this._serverKey = ConnectionContextKey.Server.bindTo(contextKeyService);
		this._databaseKey = ConnectionContextKey.Database.bindTo(contextKeyService);
		this._connectionKey = ConnectionContextKey.Connection.bindTo(contextKeyService);
		this._isQueryProviderKey = ConnectionContextKey.IsQueryProvider.bindTo(contextKeyService);
		this._isSystemDb = ConnectionContextKey.IsSystemDb.bindTo(contextKeyService);
		this._isDefaultDb = ConnectionContextKey.IsDefaultDb.bindTo(contextKeyService);
	}

	set(value: IConnectionProfile) {
		let queryProviders = this.queryManagementService.getRegisteredProviders();
		this._connectionKey.set(value);
		this._providerKey.set(value && value.providerName);
		this._serverKey.set(value && value.serverName);
		this._databaseKey.set(value && value.databaseName);
		this._isQueryProviderKey.set(value && value.providerName && queryProviders.indexOf(value.providerName) !== -1);
		this._isSystemDb.set(value && this._systemDbs.has(value.databaseName));
		this._isDefaultDb.set(value && value.databaseName === '');
	}

	reset(): void {
		this._providerKey.reset();
		this._serverKey.reset();
		this._databaseKey.reset();
		this._connectionKey.reset();
		this._isQueryProviderKey.reset();
		this._isSystemDb.reset();
		this._isDefaultDb.reset();
	}

	public get(): IConnectionProfile {
		return this._connectionKey.get();
	}
}
