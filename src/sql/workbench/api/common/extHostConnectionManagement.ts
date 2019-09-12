/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtHostConnectionManagementShape, SqlMainContext, MainThreadConnectionManagementShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import * as azdata from 'azdata';

export class ExtHostConnectionManagement extends ExtHostConnectionManagementShape {

	private _proxy: MainThreadConnectionManagementShape;
	private _nextListenerHandle: number = 0;
	private _connectionListeners = new Map<number, azdata.connection.ConnectionEventListener>();

	constructor(
		mainContext: IMainContext
	) {
		super();
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadConnectionManagement);
	}

	public $onConnectionEvent(handle: number, type: azdata.connection.ConnectionEventType, ownerUri: string, profile: azdata.IConnectionProfile): void {
		let listener = this._connectionListeners[handle];
		if (listener) {
			listener.onConnectionEvent(type, ownerUri, profile);
		}
	}

	public $registerConnectionEventListener(providerId: string, listener: azdata.connection.ConnectionEventListener): void {
		this._connectionListeners[this._nextListenerHandle] = listener;
		this._proxy.$registerConnectionEventListener(this._nextListenerHandle, providerId);
		this._nextListenerHandle++;
	}

	public $getCurrentConnection(): Thenable<azdata.connection.ConnectionProfile> {
		return this._proxy.$getCurrentConnectionProfile();
	}

	public $getConnections(activeConnectionsOnly?: boolean): Thenable<azdata.connection.ConnectionProfile[]> {
		return this._proxy.$getConnections(activeConnectionsOnly);
	}

	public $getConnection(uri: string): Thenable<azdata.connection.ConnectionProfile> {
		return this._proxy.$getConnection(uri);
	}

	// "sqlops" back-compat connection APIs
	public $getActiveConnections(): Thenable<azdata.connection.Connection[]> {
		return this._proxy.$getActiveConnections();
	}

	public $getSqlOpsCurrentConnection(): Thenable<azdata.connection.Connection> {
		return this._proxy.$getCurrentConnection();
	}

	public $getCredentials(connectionId: string): Thenable<{ [name: string]: string }> {
		return this._proxy.$getCredentials(connectionId);
	}

	public $getServerInfo(connectionId: string): Thenable<azdata.ServerInfo> {
		return this._proxy.$getServerInfo(connectionId);
	}

	public $openConnectionDialog(providers?: string[], initialConnectionProfile?: azdata.IConnectionProfile, connectionCompletionOptions?: azdata.IConnectionCompletionOptions): Thenable<azdata.connection.Connection> {
		return this._proxy.$openConnectionDialog(providers, initialConnectionProfile, connectionCompletionOptions);
	}

	public $listDatabases(connectionId: string): Thenable<string[]> {
		return this._proxy.$listDatabases(connectionId);
	}

	public $getConnectionString(connectionId: string, includePassword: boolean): Thenable<string> {
		return this._proxy.$getConnectionString(connectionId, includePassword);
	}

	public $getUriForConnection(connectionId: string): Thenable<string> {
		return this._proxy.$getUriForConnection(connectionId);
	}

	public $connect(connectionProfile: azdata.IConnectionProfile, saveConnection: boolean = true, showDashboard: boolean = true): Thenable<azdata.ConnectionResult> {
		return this._proxy.$connect(connectionProfile, saveConnection, showDashboard);
	}
}
