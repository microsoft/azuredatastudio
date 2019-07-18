/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

import { SharedService, SharedServiceProxy }  from '../liveshare';

import * as constants from '../constants';

export class ConnectionFeature {

	public registerListeners(isHost: boolean, sharedService: SharedService, sharedServiceProxy: SharedServiceProxy): void {
		if (isHost) {
			azdata.connection.registerConnectionEventListener({
				onConnectionEvent(type: azdata.connection.ConnectionEvent, ownerUri: string, profile: azdata.IConnectionProfile) {
					sharedService.notify(<string>type, { ownerUri, profile});
				}
			});
		} else {
			sharedServiceProxy.onNotify('onConnect', (args: any) => {
				return args;
			});

			sharedServiceProxy.onNotify('onDisconnect', (args: any) => {
				return args;
			});

			sharedServiceProxy.onNotify('onConnectionChanged', (args: any) => {
				return args;
			});
		}
	}

	public registerProvider(): vscode.Disposable {

		let connect = (connUri: string, connInfo: azdata.ConnectionInfo): Thenable<boolean> => {
			return Promise.resolve(true);
		};

		let disconnect = (ownerUri: string): Thenable<boolean> => {
			return Promise.resolve(true);
		};

		let cancelConnect = (ownerUri: string): Thenable<boolean> => {
			return Promise.resolve(true);
		};

		let changeDatabase = (ownerUri: string, newDatabase: string): Thenable<boolean> => {
			return Promise.resolve(true);
		};

		let listDatabases = (ownerUri: string): Thenable<azdata.ListDatabasesResult> => {
			return Promise.resolve(undefined);
		};

		let getConnectionString = (ownerUri: string, includePassword: boolean): Thenable<string> => {
			return Promise.resolve('');
		};

		let buildConnectionInfo = (connectionString: string): Thenable<azdata.ConnectionInfo> => {
			return Promise.resolve(undefined);
		};

		let rebuildIntelliSenseCache = (ownerUri: string): Thenable<void> => {
			return Promise.resolve();
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
