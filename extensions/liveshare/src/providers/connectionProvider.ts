/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

import { SharedService, SharedServiceProxy } from '../liveshare';
import * as constants from '../constants';

export class ConnectionProvider {
	private _sharedService: SharedService;
	private _sharedServiceProxy: SharedServiceProxy;

	public constructor(private _isHost: boolean) { }

	public initialize(isHost: boolean, service: any) {
		if (this._isHost) {
			this._sharedService = <SharedService>service;

			this.registerProviderListener();
		} else {
			this._sharedServiceProxy = <SharedServiceProxy>service;


			this.registerProvider();
		}
	}

	// public registerListeners(): void {
	// 	let self = this;
	// 	if (this._isHost) {
	// 		azdata.connection.registerConnectionEventListener({
	// 			onConnectionEvent(type: azdata.connection.ConnectionEvent, ownerUri: string, profile: azdata.IConnectionProfile) {
	// 				self._sharedService.notify(<string>type, { ownerUri, profile});
	// 			}
	// 		});
	// 	} else {
	// 		this._sharedServiceProxy.onNotify('onConnect', (args: any) => {
	// 			return args;
	// 		});

	// 		this._sharedServiceProxy.onNotify('onDisconnect', (args: any) => {
	// 			return args;
	// 		});

	// 		this._sharedServiceProxy.onNotify('onConnectionChanged', (args: any) => {
	// 			return args;
	// 		});
	// 	}
	// }

	public registerProviderListener(): void {
		this._sharedService.onRequest(constants.connectRequest, (args: any) => {
			return;
		});

		this._sharedService.onRequest(constants.disconnectRequest, (args: any) => {
			return true;
		});

		this._sharedService.onRequest(constants.cancelConnectRequest, (args: any) => {
			return true;
		});

		this._sharedService.onRequest(constants.changeDatabaseRequest, (args: any) => {
			return true;
		});

		this._sharedService.onRequest(constants.listDatabasesRequest, (args: any) => {
			return true;
		});
		this._sharedService.onRequest(constants.getConnectionStringRequest, (args: any) => {
			return true;
		});

		this._sharedService.onRequest(constants.buildConnectionInfoRequest, (args: any) => {
			return true;
		});

		this._sharedService.onRequest(constants.rebuildIntellisenseCacheRequest, (args: any) => {
			return true;
		});
	}

	public registerProvider(): vscode.Disposable {
		const self = this;
		let connect = (ownerUri: string, connInfo: azdata.ConnectionInfo): Thenable<boolean> => {
			return self._sharedServiceProxy.request(constants.connectRequest, [{
				ownerUri: ownerUri,
				connInfo: connInfo
			}]);
		};

		let disconnect = (ownerUri: string): Thenable<boolean> => {
			return self._sharedServiceProxy.request(constants.disconnectRequest, [{
				ownerUri: ownerUri
			}]);
		};

		let cancelConnect = (ownerUri: string): Thenable<boolean> => {
			return self._sharedServiceProxy.request(constants.cancelConnectRequest, [{
				ownerUri: ownerUri
			}]);
		};

		let changeDatabase = (ownerUri: string, newDatabase: string): Thenable<boolean> => {
			return self._sharedServiceProxy.request(constants.changeDatabaseRequest, [{
				ownerUri: ownerUri,
				newDatabase: newDatabase
			}]);
		};

		let listDatabases = (ownerUri: string): Thenable<azdata.ListDatabasesResult> => {
			return self._sharedServiceProxy.request(constants.listDatabasesRequest, [{
				ownerUri: ownerUri
			}]);
		};

		let getConnectionString = (ownerUri: string, includePassword: boolean): Thenable<string> => {
			return self._sharedServiceProxy.request(constants.getConnectionStringRequest, [{
				ownerUri: ownerUri,
				includePassword: includePassword
			}]);
		};

		let buildConnectionInfo = (connectionString: string): Thenable<azdata.ConnectionInfo> => {
			return self._sharedServiceProxy.request(constants.buildConnectionInfoRequest, [{
				connectionString: connectionString
			}]);
		};

		let rebuildIntelliSenseCache = (ownerUri: string): Thenable<void> => {
			return self._sharedServiceProxy.request(constants.rebuildIntellisenseCacheRequest, [{
				ownerUri: ownerUri
			}]);
		};

		let registerOnConnectionComplete = (handler: (connSummary: azdata.ConnectionInfoSummary) => any): void => {
			return;
		};

		let registerOnIntelliSenseCacheComplete = (handler: (connectionUri: string) => any): void => {
			return;
		};

		let registerOnConnectionChanged = (handler: (changedConnInfo: azdata.ChangedConnectionInfo) => any): void => {
			return;
		};

		return azdata.dataprotocol.registerConnectionProvider({
			providerId: constants.LiveShareProviderId,
			connect,
			disconnect,
			cancelConnect,
			changeDatabase,
			listDatabases,
			getConnectionString,
			buildConnectionInfo,
			rebuildIntelliSenseCache,
			registerOnConnectionChanged,
			registerOnIntelliSenseCacheComplete,
			registerOnConnectionComplete
		});
	}
}
