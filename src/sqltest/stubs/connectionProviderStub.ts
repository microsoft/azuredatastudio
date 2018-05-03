/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as sqlops from 'sqlops';

export class ConnectionProviderStub implements sqlops.ConnectionProvider {
	public readonly providerId = 'MSSQL';

	connect(connectionUri: string, connectionInfo: sqlops.ConnectionInfo): Thenable<boolean> {
		return undefined;
	}

	disconnect(connectionUri: string): Thenable<boolean> {
		return undefined;
	}

	cancelConnect(connectionUri: string): Thenable<boolean> {
		return undefined;
	}

	listDatabases(connectionUri: string): Thenable<sqlops.ListDatabasesResult> {
		return undefined;
	}

	changeDatabase(connectionUri: string, newDatabase: string): Thenable<boolean> {
		return undefined;
	}

	rebuildIntelliSenseCache(connectionUri: string): Thenable<void> {
		return undefined;
	}

	registerOnConnectionComplete(handler: (connSummary: sqlops.ConnectionInfoSummary) => any) {
		return undefined;
	}

	registerOnIntelliSenseCacheComplete(handler: (connectionUri: string) => any) {
		return undefined;
	}

	registerOnConnectionChanged(handler: (changedConnInfo: sqlops.ChangedConnectionInfo) => any) {
		return undefined;
	}
}