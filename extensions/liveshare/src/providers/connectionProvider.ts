/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

import { SharedService, SharedServiceProxy }  from '../liveshare';
import * as constants from '../constants';

export class ConnectionProvider {
	private _sharedService: SharedService;
	private _sharedServiceProxy: SharedServiceProxy;

	public constructor(
		private _isHost: boolean,
		service: any) {

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
		this._sharedService.onRequest('connect', (args: any) => {
			return;
		});

		this._sharedService.onRequest('disconnect', (args: any) => {
			return true;
		});

		this._sharedService.onRequest('cancelConnect', (args: any) => {
			return true;
		});

		this._sharedService.onRequest('changeDatabase', (args: any) => {
			return true;
		});

		this._sharedService.onRequest('listDatabases', (args: any) => {
			return true;
		});

		this._sharedService.onRequest('getConnectionString', (args: any) => {
			return true;
		});

		this._sharedService.onRequest('buildConnectionInfo', (args: any) => {
			return true;
		});

		this._sharedService.onRequest('rebuildIntelliSenseCache', (args: any) => {
			return true;
		});
	}

	public registerProvider(): vscode.Disposable {
		let self = this;
		let connect = (ownerUri: string, connInfo: azdata.ConnectionInfo): Thenable<boolean> => {
			return self._sharedServiceProxy.request('connect', [{
				ownerUri: ownerUri,
				connInfo: connInfo
			}]);
		};

		let disconnect = (ownerUri: string): Thenable<boolean> => {
			return self._sharedServiceProxy.request('disconnect', [{
				ownerUri: ownerUri
			}]);
		};

		let cancelConnect = (ownerUri: string): Thenable<boolean> => {
			return self._sharedServiceProxy.request('cancelConnect', [{
				ownerUri: ownerUri
			}]);
		};

		let changeDatabase = (ownerUri: string, newDatabase: string): Thenable<boolean> => {
			return self._sharedServiceProxy.request('changeDatabase', [{
				ownerUri: ownerUri,
				newDatabase: newDatabase
			}]);
		};

		let listDatabases = (ownerUri: string): Thenable<azdata.ListDatabasesResult> => {
			return self._sharedServiceProxy.request('listDatabases', [{
				ownerUri: ownerUri
			}]);
		};

		let getConnectionString = (ownerUri: string, includePassword: boolean): Thenable<string> => {
			return self._sharedServiceProxy.request('getConnectionString', [{
				ownerUri: ownerUri,
				includePassword: includePassword
			}]);
		};

		let buildConnectionInfo = (connectionString: string): Thenable<azdata.ConnectionInfo> => {
			return self._sharedServiceProxy.request('buildConnectionInfo', [{
				connectionString: connectionString
			}]);
		};

		let rebuildIntelliSenseCache = (ownerUri: string): Thenable<void> => {
			return self._sharedServiceProxy.request('rebuildIntelliSenseCache', [{
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
