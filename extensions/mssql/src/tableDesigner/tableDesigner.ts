/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { sqlProviderName } from '../constants';
import { generateUuid } from 'vscode-languageclient/lib/utils/uuid';
import { ITelemetryEventProperties, Telemetry } from '../telemetry';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

const NewTableText = localize('tableDesigner.NewTable', "New Table");
export function registerTableDesignerCommands(appContext: AppContext) {
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newTable', async (context: azdata.ObjectExplorerContext) => {
		const connectionString = await azdata.connection.getConnectionString(context.connectionProfile.id, true);
		const tableIcon = context.nodeInfo.nodeSubType as azdata.designers.TableIcon;
		const telemetryInfo = await getTelemetryInfo(context, tableIcon);
		await azdata.designers.openTableDesigner(sqlProviderName, {
			title: NewTableText,
			tooltip: `${context.connectionProfile.serverName} - ${context.connectionProfile.databaseName} - ${NewTableText}`,
			server: context.connectionProfile.serverName,
			database: context.connectionProfile.databaseName,
			isNewTable: true,
			id: generateUuid(),
			connectionString: connectionString,
			accessToken: context.connectionProfile.options.azureAccountToken,
			tableIcon: tableIcon
		}, telemetryInfo);
	}));

	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.designTable', async (context: azdata.ObjectExplorerContext) => {
		const server = context.connectionProfile.serverName;
		const database = context.connectionProfile.databaseName;
		const schema = context.nodeInfo.metadata.schema;
		const name = context.nodeInfo.metadata.name;
		const connectionString = await azdata.connection.getConnectionString(context.connectionProfile.id, true);
		const tableIcon = context.nodeInfo.nodeSubType as azdata.designers.TableIcon;
		const telemetryInfo = await getTelemetryInfo(context, tableIcon);
		await azdata.designers.openTableDesigner(sqlProviderName, {
			title: `${schema}.${name}`,
			tooltip: `${server} - ${database} - ${schema}.${name}`,
			server: server,
			database: database,
			isNewTable: false,
			name: name,
			schema: schema,
			id: `${sqlProviderName}|${server}|${database}|${schema}|${name}`,
			connectionString: connectionString,
			accessToken: context.connectionProfile.options.azureAccountToken,
			tableIcon: tableIcon
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
