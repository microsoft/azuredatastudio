/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as sqlite from 'sqlite3';
import * as vscode from 'vscode';

export class ConnectionProvider implements azdata.ConnectionProvider {
	public static readonly providerId = 'sqlite';
	public readonly providerId = ConnectionProvider.providerId;

	private connectionComplete?: (connSummary: azdata.ConnectionInfoSummary) => void;

	public readonly databases: { [key: string]: sqlite.Database } = {};

	async connect(connectionUri: string, connectionInfo: azdata.ConnectionInfo): Promise<boolean> {
		try {
			const file = connectionInfo.options['file'] as string;
			await vscode.workspace.fs.stat(vscode.Uri.file(file));
			this.databases[connectionUri] = new sqlite.Database(file, (err) => {
				if (this.connectionComplete) {
					if (err) {
						this.connectionComplete({ connectionId: connectionUri, ownerUri: connectionUri, errorMessage: err.message } as any);
					} else {
						this.connectionComplete({ connectionId: connectionUri, ownerUri: connectionUri, connectionSummary: { serverName: connectionInfo.options['file'], databaseName: connectionInfo.options['file'], userName: 'N/A' } } as any);
					}
				}
			});
			return true;
		} catch (e) {
			return false;
		}
	}

	async disconnect(connectionUri: string): Promise<boolean> {
		if (this.databases[connectionUri]) {
			this.databases[connectionUri].close();
			delete this.databases[connectionUri];
		}
		return true;
	}

	cancelConnect(connectionUri: string): Thenable<boolean> {
		throw new Error('Method not implemented.');
	}

	listDatabases(connectionUri: string): Thenable<azdata.ListDatabasesResult> {
		throw new Error('Method not implemented.');
	}

	changeDatabase(connectionUri: string, newDatabase: string): Thenable<boolean> {
		throw new Error('Method not implemented.');
	}

	rebuildIntelliSenseCache(connectionUri: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	getConnectionString(connectionUri: string, includePassword: boolean): Thenable<string> {
		throw new Error('Method not implemented.');
	}

	registerOnConnectionComplete(handler: (connSummary: azdata.ConnectionInfoSummary) => any): void {
		this.connectionComplete = handler;
	}

	registerOnIntelliSenseCacheComplete(handler: (connectionUri: string) => any): void {
		//
	}

	registerOnConnectionChanged(handler: (changedConnInfo: azdata.ChangedConnectionInfo) => any): void {
		//
	}
}
