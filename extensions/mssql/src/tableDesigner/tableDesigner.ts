/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { sqlProviderName, TableType } from '../constants';
import { generateUuid } from 'vscode-languageclient/lib/utils/uuid';
import { ITelemetryEventProperties, Telemetry } from '../telemetry';

export function registerTableDesignerCommands(appContext: AppContext) {
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newTable', async (context: azdata.ObjectExplorerContext) => {
		const connectionString = await azdata.connection.getConnectionString(context.connectionProfile.id, true);
		const telemetryInfo = await getTelemetryInfo(context, TableType.Basic);
		await azdata.designers.openTableDesigner(sqlProviderName, {
			server: context.connectionProfile.serverName,
			database: context.connectionProfile.databaseName,
			isNewTable: true,
			id: generateUuid(),
			connectionString: connectionString,
			accessToken: context.connectionProfile.options.azureAccountToken
		}, telemetryInfo);
	}));

	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.designTable', async (context: azdata.ObjectExplorerContext) => {
		const server = context.connectionProfile.serverName;
		const database = context.connectionProfile.databaseName;
		const schema = context.nodeInfo.metadata.schema;
		const name = context.nodeInfo.metadata.name;
		const connectionString = await azdata.connection.getConnectionString(context.connectionProfile.id, true);
		const telemetryInfo = await getTelemetryInfo(context, TableType.Basic);
		await azdata.designers.openTableDesigner(sqlProviderName, {
			server: server,
			database: database,
			isNewTable: false,
			name: name,
			schema: schema,
			id: `${sqlProviderName}|${server}|${database}|${schema}|${name}`,
			connectionString: connectionString,
			accessToken: context.connectionProfile.options.azureAccountToken
		}, telemetryInfo);
	}));
}

async function getTelemetryInfo(context: azdata.ObjectExplorerContext, tableType: string): Promise<ITelemetryEventProperties> {
	const serverInfo = await azdata.connection.getServerInfo(context.connectionProfile.id);
	const telemetryInfo: ITelemetryEventProperties = {};
	Telemetry.fillServerInfo(telemetryInfo, serverInfo);
	telemetryInfo['tableType'] = tableType;
	return telemetryInfo;
}
