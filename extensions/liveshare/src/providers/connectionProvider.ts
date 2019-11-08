/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../constants';

import { LiveShare, SharedService, SharedServiceProxy } from '../liveshare';

export class ConnectionProvider {
	private _sharedService: SharedService;
	private _sharedServiceProxy: SharedServiceProxy;

	protected _onConnect: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	public readonly onConnect: vscode.Event<any> = this._onConnect.event;

	protected _onDisconnect: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	public readonly onDisconnect: vscode.Event<any> = this._onDisconnect.event;

	protected _onConnectionChanged: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	public readonly onConnectionChanged: vscode.Event<any> = this._onConnectionChanged.event;

	private _onConnectionCompleteHandler: (connSummary: azdata.ConnectionInfoSummary) => any;

	public constructor(
		private _isHost: boolean,
		private _vslsApi: LiveShare,
		service: SharedService | SharedServiceProxy) {
		if (this._isHost) {
			this._sharedService = <SharedService>service;
			this.registerProviderListener();
		} else {
			this._sharedServiceProxy = <SharedServiceProxy>service;
			this.registerProvider();
		}
	}

	public registerProviderListener(): void {
		let self = this;
		azdata.connection.registerConnectionEventListener({
			onConnectionEvent(type: azdata.connection.ConnectionEventType, ownerUri: string, profile: azdata.IConnectionProfile) {
				try {
					let localUri: vscode.Uri = self._vslsApi.convertLocalUriToShared(vscode.Uri.parse(ownerUri));
					ownerUri = localUri.toString();
				} catch {
				}

				self._sharedService.notify(<string>type, {
					ownerUri: ownerUri,
					profile: profile
				});
			}
		});

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
		this._sharedServiceProxy.onNotify('onConnect', (args: any) => {
			this._onConnect.fire(args);
			return args;
		});

		this._sharedServiceProxy.onNotify('onDisconnect', (args: any) => {
			this._onDisconnect.fire(args);
			return args;
		});

		this._sharedServiceProxy.onNotify('onConnectionChanged', (args: any) => {
			this._onConnectionChanged.fire(args);
			return args;
		});

		let connect = (ownerUri: string, connInfo: azdata.ConnectionInfo): Thenable<boolean> => {
			if (self._onConnectionCompleteHandler) {
				// "test" liveshare connection details to be filled out in later iteration
				let connSummary: azdata.ConnectionInfoSummary = {
					ownerUri: ownerUri,
					connectionId: ownerUri,
					messages: undefined,
					errorMessage: undefined,
					errorNumber: undefined,
					connectionSummary: {
						serverName: connInfo.options['serverName'],
						databaseName: connInfo.options['databaseName'],
						userName: 'liveshare'
					},
					serverInfo: {
						serverMajorVersion: 1,
						serverMinorVersion: 0,
						serverReleaseVersion: 1,
						engineEditionId: 1,
						serverVersion: '1.0',
						serverLevel: '1',
						serverEdition: '1',
						isCloud: false,
						azureVersion: 1,
						osVersion: '1',
						options: connInfo.options
					}
				};
				self._onConnectionCompleteHandler(connSummary);
			}

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
			self._onConnectionCompleteHandler = handler;
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
