/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

export class ConnectionProviderStub implements azdata.ConnectionProvider {
	public readonly providerId = 'MSSQL';

	connect(connectionUri: string, connectionInfo: azdata.ConnectionInfo): Thenable<boolean> {
		return undefined;
	}

	disconnect(connectionUri: string): Thenable<boolean> {
		return undefined;
	}

	cancelConnect(connectionUri: string): Thenable<boolean> {
		return undefined;
	}

	listDatabases(connectionUri: string): Thenable<azdata.ListDatabasesResult> {
		return undefined;
	}

	changeDatabase(connectionUri: string, newDatabase: string): Thenable<boolean> {
		return undefined;
	}

	getConnectionString(connectionUri: string): Thenable<string> {
		return undefined;
	}

	rebuildIntelliSenseCache(connectionUri: string): Thenable<void> {
		return undefined;
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