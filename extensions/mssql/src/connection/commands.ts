/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import * as vscode from 'vscode';
import * as constants from './constants';
import { TelemetryReporter } from '../telemetry';
import { ConnectionService } from './connectionService';

const clearPooledConnectionsAction = 'clearPooledConnections';

export function registerConnectionCommands(appContext: AppContext) {
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.clearPooledConnections', async () => {
		TelemetryReporter.sendTelemetryEvent(clearPooledConnectionsAction);
		await getConnectionService(appContext).clearPooledConnections();
	}));
}

function getConnectionService(appContext: AppContext): ConnectionService {
	return appContext.getService<ConnectionService>(constants.ConnectionService);
}
