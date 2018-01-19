/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as data from 'data';

export class ConnectionProviderStub implements data.ConnectionProvider {
	public readonly providerId = 'MSSQL';

	connect(connectionUri: string, connectionInfo: data.ConnectionInfo): Thenable<boolean> {
		return undefined;
	}

	disconnect(connectionUri: string): Thenable<boolean> {
		return undefined;
	}

	cancelConnect(connectionUri: string): Thenable<boolean> {
		return undefined;
	}

	listDatabases(connectionUri: string): Thenable<data.ListDatabasesResult> {
		return undefined;
	}

	changeDatabase(connectionUri: string, newDatabase: string): Thenable<boolean> {
		return undefined;
	}

	rebuildIntelliSenseCache(connectionUri: string): Thenable<void> {
		return undefined;
	}

	registerOnConnectionComplete(handler: (connSummary: data.ConnectionInfoSummary) => any) {
		return undefined;
	}

	registerOnIntelliSenseCacheComplete(handler: (connectionUri: string) => any) {
		return undefined;
	}

	registerOnConnectionChanged(handler: (changedConnInfo: data.ChangedConnectionInfo) => any) {
		return undefined;
	}
}