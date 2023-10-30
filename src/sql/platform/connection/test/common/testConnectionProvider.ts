/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';

export class TestConnectionProvider implements azdata.ConnectionProvider {
	public readonly providerId = mssqlProviderName;

	connect(connectionUri: string, connectionInfo: azdata.ConnectionInfo): Thenable<boolean> {
		return Promise.resolve(true);
	}

	disconnect(connectionUri: string): Thenable<boolean> {
		return Promise.resolve(true);
	}

	changePassword(connectionUri: string, connectionInfo: azdata.ConnectionInfo, newPassword: string): Thenable<azdata.PasswordChangeResult> {
		return Promise.resolve({ result: false });
	}

	cancelConnect(connectionUri: string): Thenable<boolean> {
		return Promise.resolve(true);
	}

	listDatabases(connectionUri: string): Thenable<azdata.ListDatabasesResult> {
		return Promise.resolve({ databaseNames: [] });
	}

	changeDatabase(connectionUri: string, newDatabase: string): Thenable<boolean> {
		return Promise.resolve(true);
	}

	getConnectionString(connectionUri: string, includePassword?: boolean): Thenable<string> {
		return Promise.resolve('');
	}

	buildConnectionInfo(connectionString: string): Thenable<azdata.ConnectionInfo> {
		return Promise.resolve({ options: {} });
	}

	rebuildIntelliSenseCache(connectionUri: string): Thenable<void> {
		return Promise.resolve();
	}

	registerOnConnectionComplete(handler: (connSummary: azdata.ConnectionInfoSummary) => any) {
		return undefined;
	}

	registerOnIntelliSenseCacheComplete(handler: (connectionUri: string) => any) {
		return undefined;
	}

	registerOnConnectionChanged(handler: (changedConnInfo: azdata.ChangedConnectionInfo) => any) {
		return undefined;
	}
}
