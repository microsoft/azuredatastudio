/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtHostConnectionShape, SqlMainContext, MainThreadConnectionShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import type * as azdata from 'azdata';
import type * as vscode from 'vscode';
import { Disposable } from 'vs/workbench/api/common/extHostTypes';
import { IURITransformer } from 'vs/base/common/uriIpc';
import { URI } from 'vs/base/common/uri';

export class ExtHostConnection implements ExtHostConnectionShape {

	private static _handlePool: number = 0;
	private _proxy: MainThreadConnectionShape;
	private _nextListenerHandle: number = 0;
	private _connectionListeners = new Map<number, azdata.connection.ConnectionEventListener>();
	private readonly providers = new Map<number, azdata.ConnectionProvider>();

	private _nextHandle(): number {
		return ExtHostConnection._handlePool++;
	}

	constructor(
		mainContext: IMainContext,
		private readonly uriTransformer: IURITransformer | null
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadConnection);
	}

	public $onConnectionEvent(handle: number, type: azdata.connection.ConnectionEventType, ownerUri: string, profile: azdata.IConnectionProfile): void {
		let listener = this._connectionListeners[handle];
		if (listener) {
			listener.onConnectionEvent(type, ownerUri, profile);
		}
	}

	public registerConnectionEventListener(providerId: string, listener: azdata.connection.ConnectionEventListener): void {
		this._connectionListeners[this._nextListenerHandle] = listener;
		this._proxy.$registerConnectionEventListener(this._nextListenerHandle, providerId);
		this._nextListenerHandle++;
	}

	public getCurrentConnection(): Thenable<azdata.connection.ConnectionProfile> {
		return this._proxy.$getCurrentConnectionProfile();
	}

	public getConnections(activeConnectionsOnly?: boolean): Thenable<azdata.connection.ConnectionProfile[]> {
		return this._proxy.$getConnections(activeConnectionsOnly);
	}

	public getConnection(uri: string): Thenable<azdata.connection.ConnectionProfile> {
		return this._proxy.$getConnection(uri);
	}

	// "sqlops" back-compat connection APIs
	public getActiveConnections(): Thenable<azdata.connection.Connection[]> {
		return this._proxy.$getActiveConnections();
	}

	public getSqlOpsCurrentConnection(): Thenable<azdata.connection.Connection> {
		return this._proxy.$getCurrentConnection();
	}

	public getCredentials(connectionId: string): Thenable<{ [name: string]: string }> {
		return this._proxy.$getCredentials(connectionId);
	}

	public getServerInfo(connectionId: string): Thenable<azdata.ServerInfo> {
		return this._proxy.$getServerInfo(connectionId);
	}

	public openConnectionDialog(providers?: string[], initialConnectionProfile?: azdata.IConnectionProfile, connectionCompletionOptions?: azdata.IConnectionCompletionOptions): Thenable<azdata.connection.Connection> {
		return this._proxy.$openConnectionDialog(providers, initialConnectionProfile, connectionCompletionOptions);
	}

	public listDatabases(connectionId: string): Thenable<string[]> {
		return this._proxy.$listDatabases(connectionId);
	}

	public getConnectionString(connectionId: string, includePassword: boolean): Thenable<string> {
		return this._proxy.$getConnectionString(connectionId, includePassword);
	}

	public getUriForConnection(connectionId: string): Thenable<string> {
		return this._proxy.$getUriForConnection(connectionId);
	}

	public connect(connectionProfile: azdata.IConnectionProfile, saveConnection: boolean = true, showDashboard: boolean = true): Thenable<azdata.ConnectionResult> {
		return this._proxy.$connect(connectionProfile, saveConnection, showDashboard);
	}

	public registerProvider(provider: azdata.ConnectionProvider): vscode.Disposable {
		// TODO reenable adding this to the global providers
		const handle = this._nextHandle();

		provider.registerOnConnectionComplete(connSummary => {
			this._proxy.$onConnectionComplete(handle, connSummary);
		});

		provider.registerOnIntelliSenseCacheComplete(connectionUri => {
			this._proxy.$onIntelliSenseCacheComplete(handle, connectionUri);
		});

		provider.registerOnConnectionChanged(changedConnInfo => {
			this._proxy.$onConnectionChangeNotification(handle, changedConnInfo);
		});

		this.providers.set(handle, provider);
		this._proxy.$registerProvider(provider.providerId, handle);

		return new Disposable(() => {
			this._proxy.$unregisterProvider(handle);
			this.providers.delete(handle);
		});
	}

	// Connection Management handlers
	$connect(handle: number, connectionUri: string, connection: azdata.ConnectionInfo): Promise<boolean> {
		if (this.uriTransformer) {
			connectionUri = URI.from(this.uriTransformer.transformIncoming(URI.parse(connectionUri))).toString(true);
		}
		return Promise.resolve(this._resolveProvider(handle).connect(connectionUri, connection));
	}

	$disconnect(handle: number, connectionUri: string): Promise<boolean> {
		return Promise.resolve(this._resolveProvider(handle).disconnect(connectionUri));
	}

	$cancelConnect(handle: number, connectionUri: string): Promise<boolean> {
		return Promise.resolve(this._resolveProvider(handle).cancelConnect(connectionUri));
	}

	private _resolveProvider(handle: number): azdata.ConnectionProvider {
		let provider = this.providers.get(handle);
		if (provider) {
			return provider;
		} else {
			throw new Error(`Unfound provider ${handle}`);
		}
	}
}
