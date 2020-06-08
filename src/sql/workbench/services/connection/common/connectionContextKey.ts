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
	static CanOpenInAzurePortal = new RawContextKey<boolean>('canOpenInAzurePortal', false);

	private _providerKey: IContextKey<string>;
	private _serverKey: IContextKey<string>;
	private _databaseKey: IContextKey<string>;
	private _connectionKey: IContextKey<IConnectionProfile>;
	private _isQueryProviderKey: IContextKey<boolean>;
	private _canOpenInAzurePortal: IContextKey<boolean>;


	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@IQueryManagementService private queryManagementService: IQueryManagementService
	) {
		this._providerKey = ConnectionContextKey.Provider.bindTo(contextKeyService);
		this._serverKey = ConnectionContextKey.Server.bindTo(contextKeyService);
		this._databaseKey = ConnectionContextKey.Database.bindTo(contextKeyService);
		this._connectionKey = ConnectionContextKey.Connection.bindTo(contextKeyService);
		this._isQueryProviderKey = ConnectionContextKey.IsQueryProvider.bindTo(contextKeyService);
		this._canOpenInAzurePortal = ConnectionContextKey.CanOpenInAzurePortal.bindTo(contextKeyService);
	}

	set(value: IConnectionProfile) {
		this.setCanOpenInPortal(value);
		let queryProviders = this.queryManagementService.getRegisteredProviders();
		this._connectionKey.set(value);
		this._providerKey.set(value && value.providerName);
		this._serverKey.set(value && value.serverName);
		this._databaseKey.set(value && value.databaseName);
		this._isQueryProviderKey.set(value && value.providerName && queryProviders.indexOf(value.providerName) !== -1);
	}

	private setCanOpenInPortal(connectionProfile: IConnectionProfile): void {
		if (connectionProfile &&
			connectionProfile.azureResourceId &&
			connectionProfile.azureTenantId &&
			connectionProfile.azurePortalEndpoint) {
			this._canOpenInAzurePortal.set(true);
		}
	}

	reset(): void {
		this._providerKey.reset();
		this._serverKey.reset();
		this._databaseKey.reset();
		this._connectionKey.reset();
		this._isQueryProviderKey.reset();
		this._canOpenInAzurePortal.reset();
	}

	public get(): IConnectionProfile {
		return this._connectionKey.get();
	}
}
