/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { sqlProviderName } from '../constants';
import { generateUuid } from 'vscode-languageclient/lib/utils/uuid';

export function registerTableDesignerCommands(appContext: AppContext) {
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newTable', async (context: azdata.ObjectExplorerContext) => {
		const connectionString = await azdata.connection.getConnectionString(context.connectionProfile.id, true);
		await azdata.designers.openTableDesigner(sqlProviderName, {
			server: context.connectionProfile.serverName,
			database: context.connectionProfile.databaseName,
			isNewTable: true,
			id: generateUuid(),
			connectionString: connectionString
		});
	}));

	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.designTable', async (context: azdata.ObjectExplorerContext) => {
		const server = context.connectionProfile.serverName;
		const database = context.connectionProfile.databaseName;
		const schema = context.nodeInfo.metadata.schema;
		const name = context.nodeInfo.metadata.name;
		const connectionString = await azdata.connection.getConnectionString(context.connectionProfile.id, true);
		const connectionUri = await azdata.connection.getUriForConnection(context.connectionProfile.id);
		await azdata.designers.openTableDesigner(sqlProviderName, {
			server: server,
			database: database,
			isNewTable: false,
			name: name,
			schema: schema,
			id: `${connectionUri}|${database}|${schema}|${name}`,
			connectionString: connectionString
		});
	}));
}
