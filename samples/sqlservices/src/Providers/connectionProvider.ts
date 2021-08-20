/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';

export const ProviderId: string = 'TESTPROVIDER';

/**
 * This class implements the ConnectionProvider interface that allows users to connect to the data services, this will be used by various features in ADS, e.g. connection dialog and query editor.
 */
export class ConnectionProvider implements azdata.ConnectionProvider {
	private onConnectionCompleteEmitter: vscode.EventEmitter<azdata.ConnectionInfoSummary> = new vscode.EventEmitter();
	onConnectionComplete: vscode.Event<azdata.ConnectionInfoSummary> = this.onConnectionCompleteEmitter.event;

	private onIntelliSenseCacheCompleteEmitter: vscode.EventEmitter<string> = new vscode.EventEmitter();
	onIntelliSenseCacheComplete: vscode.Event<string> = this.onIntelliSenseCacheCompleteEmitter.event;

	private onConnectionChangedEmitter: vscode.EventEmitter<azdata.ChangedConnectionInfo> = new vscode.EventEmitter();
	onConnectionChanged: vscode.Event<azdata.ChangedConnectionInfo> = this.onConnectionChangedEmitter.event;

	connect(connectionUri: string, connectionInfo: azdata.ConnectionInfo): Promise<boolean> {
		this.onConnectionCompleteEmitter.fire({
			connectionId: '123',
			ownerUri: connectionUri,
			messages: '',
			errorMessage: '',
			errorNumber: 0,
			connectionSummary: {
				serverName: '',
				userName: ''
			},
			serverInfo: {
				serverReleaseVersion: 1,
				engineEditionId: 1,
				serverVersion: '1.0',
				serverLevel: '',
				serverEdition: '',
				isCloud: true,
				azureVersion: 1,
				osVersion: '',
				options: {}
			}
		});
		return Promise.resolve(true);
	}
	disconnect(connectionUri: string): Promise<boolean> {
		return Promise.resolve(true);
	}
	cancelConnect(connectionUri: string): Promise<boolean> {
		return Promise.resolve(true);
	}
	listDatabases(connectionUri: string): Promise<azdata.ListDatabasesResult> {
		return Promise.resolve({
			databaseNames: ['master', 'msdb']
		});
	}
	changeDatabase(connectionUri: string, newDatabase: string): Promise<boolean> {
		return Promise.resolve(true);
	}
	rebuildIntelliSenseCache(connectionUri: string): Promise<void> {
		return Promise.resolve();
	}
	getConnectionString(connectionUri: string, includePassword: boolean): Promise<string> {
		return Promise.resolve('conn_string');
	}
	buildConnectionInfo?(connectionString: string): Promise<azdata.ConnectionInfo> {
		return Promise.resolve({
			options: []
		});
	}
	registerOnConnectionComplete(handler: (connSummary: azdata.ConnectionInfoSummary) => any): void {
		this.onConnectionComplete((e) => {
			handler(e);
		});
	}
	registerOnIntelliSenseCacheComplete(handler: (connectionUri: string) => any): void {
		console.log('IntellisenseCache complete');
	}
	registerOnConnectionChanged(handler: (changedConnInfo: azdata.ChangedConnectionInfo) => any): void {
		console.log('Connection changed');
	}
	handle?: number;
	providerId: string = ProviderId;
}
