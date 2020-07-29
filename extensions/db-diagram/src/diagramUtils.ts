/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

export class DiagramUtils {

	private static _diagramServiceProvider: azdata.DiagramServicesProvider;
	private static _ownerUri: string;
	private static _connection: azdata.connection.Connection;

	public static async getDiagramService(): Promise<azdata.DiagramServicesProvider> {
		if (!DiagramUtils._diagramServiceProvider) {
			this._connection = await DiagramUtils.currentConnection();
			this._diagramServiceProvider = azdata.dataprotocol.getProvider<azdata.DiagramServicesProvider>(this._connection.providerName,

				azdata.DataProviderType.DiagramServicesProvider);
		}
		return DiagramUtils._diagramServiceProvider;
	}

	public static async currentConnection(): Promise<azdata.connection.Connection> {
		if (!DiagramUtils._connection) {
			// first let user pick from active connections
			const connections: azdata.connection.Connection[] = await azdata.connection.getActiveConnections();
			if (connections && connections.length > 0) {
				const connectionName: string = await vscode.window.showQuickPick(connections.map(c => c.providerName));
				this._connection = connections.find(c => c.providerName === connectionName);
			} else {
				// open connection dialog
				this._connection = await azdata.connection.openConnectionDialog();
			}
			this._ownerUri = await azdata.connection.getUriForConnection(this._connection.connectionId);
		}
		return this._connection;
	}

	public static async ownerUri(): Promise<string> {
		if (!DiagramUtils._ownerUri) {
			await this.currentConnection();
			return this._ownerUri;
		}
		return this._ownerUri;
	}
}
