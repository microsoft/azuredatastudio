/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

export class DiagramUtils {

	private static _diagramServiceProvider: azdata.DiagramServicesProvider;
	private static _currentConnection: azdata.connection.Connection;

	public static async getDiagramService(): Promise<azdata.DiagramServicesProvider> {
		if (!DiagramUtils._diagramServiceProvider) {
			this._currentConnection = await DiagramUtils.currentConnection();
			this._diagramServiceProvider = azdata.dataprotocol.getProvider<azdata.DiagramServicesProvider>(this._currentConnection.providerName, azdata.DataProviderType.DiagramServicesProvider);
		}
		return DiagramUtils._diagramServiceProvider;
	}

	public static async currentConnection(): Promise<azdata.connection.Connection> {
		if (!DiagramUtils._currentConnection) {
			// first let user pick from active connections
			const connections = await azdata.connection.getActiveConnections();
			if (connections && connections.length > 0) {
				const connectionName = await vscode.window.showQuickPick(connections.map(c => c.providerName));
				this._currentConnection = connections.find(c => c.providerName === connectionName);
			} else {
				// open connection dialog
				this._currentConnection = await azdata.connection.openConnectionDialog();
			}
		}
		return this._currentConnection;
	}
}
