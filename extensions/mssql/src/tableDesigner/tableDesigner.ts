/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { sqlProviderName } from '../constants';
import { generateUuid } from 'vscode-languageclient/lib/utils/uuid';
import { fillServerInfo } from '../telemetry';
import * as telemetry from '@microsoft/ads-extension-telemetry';
import * as nls from 'vscode-nls';
import { getConfigPreloadDatabaseModel, getErrorMessage, setConfigPreloadDatabaseModel } from '../utils';
const localize = nls.loadMessageBundle();

const NewTableText = localize('tableDesigner.NewTable', "New Table");
const DidInformUserKey: string = 'tableDesigner.DidInformUser';
const FailedToGetConnectionStringError = localize('tableDesigner.FailedToGetConnectionStringError', "Failed to get connection string for the table. Please reconnect to the server and try again.");

export function registerTableDesignerCommands(appContext: AppContext) {
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newTable', async (context: azdata.ObjectExplorerContext) => {
		try {
			void showPreloadDbModelSettingPrompt(appContext);
			const connectionString = await azdata.connection.getConnectionString(context.connectionProfile!.id, true);
			if (!connectionString) {
				throw new Error(FailedToGetConnectionStringError);
			}
			const tableIcon = context.nodeInfo!.nodeSubType as azdata.designers.TableIcon;
			const telemetryInfo = await getTelemetryInfo(context, tableIcon);
			let nonDefaultOptions = await azdata.connection.getNonDefaultOptions(context.connectionProfile);
			await azdata.designers.openTableDesigner(sqlProviderName, {
				title: NewTableText,
				tooltip: context.connectionProfile!.connectionName ? `${context.connectionProfile!.connectionName} - ${NewTableText}` : `${context.connectionProfile!.serverName} - ${context.connectionProfile!.databaseName} - ${NewTableText}`,
				server: context.connectionProfile!.serverName,
				database: context.connectionProfile!.databaseName,
				isNewTable: true,
				id: generateUuid(),
				connectionString: connectionString,
				accessToken: context.connectionProfile!.options.azureAccountToken as string,
				tableIcon: tableIcon,
				additionalInfo: `${context.connectionProfile!.serverName + ' - ' + context.connectionProfile!.databaseName}${nonDefaultOptions}`
			}, telemetryInfo, context);
		} catch (error) {
			console.error(error);
			await vscode.window.showErrorMessage(getErrorMessage(error), { modal: true });
		}
	}));

	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.designTable', async (context: azdata.ObjectExplorerContext) => {
		try {
			void showPreloadDbModelSettingPrompt(appContext);
			const connName = context.connectionProfile!.connectionName;
			const server = context.connectionProfile!.serverName;
			const database = context.connectionProfile!.databaseName;
			const schema = context.nodeInfo!.metadata!.schema;
			const name = context.nodeInfo!.metadata!.name;
			const connectionString = await azdata.connection.getConnectionString(context.connectionProfile!.id, true);
			if (!connectionString) {
				throw new Error(FailedToGetConnectionStringError);
			}
			const tableIcon = context.nodeInfo!.nodeSubType as azdata.designers.TableIcon;
			const telemetryInfo = await getTelemetryInfo(context, tableIcon);
			let nonDefaultOptions = await azdata.connection.getNonDefaultOptions(context.connectionProfile);
			await azdata.designers.openTableDesigner(sqlProviderName, {
				title: `${schema}.${name}`,
				tooltip: connName ? `${connName} - ${schema}.${name}` : `${server} - ${database} - ${schema}.${name}`,
				server: server,
				database: database,
				isNewTable: false,
				name: name,
				schema: schema,
				id: `${sqlProviderName}|${server}|${database}|${schema}|${name}`,
				connectionString: connectionString,
				accessToken: context.connectionProfile!.options.azureAccountToken as string,
				tableIcon: tableIcon,
				additionalInfo: `${server + ' - ' + database}${nonDefaultOptions}`
			}, telemetryInfo, context);
		} catch (error) {
			console.error(error);
			await vscode.window.showErrorMessage(getErrorMessage(error), { modal: true });
		}
	}));
}

async function getTelemetryInfo(context: azdata.ObjectExplorerContext, tableType: string): Promise<telemetry.TelemetryEventProperties> {
	const serverInfo = await azdata.connection.getServerInfo(context.connectionProfile!.id);
	const telemetryInfo: telemetry.TelemetryEventProperties = {
		tableType
	};
	fillServerInfo(telemetryInfo, serverInfo);
	return telemetryInfo;
}

async function showPreloadDbModelSettingPrompt(appContext: AppContext): Promise<void> {
	// skip if the setting is already enabled.
	if (getConfigPreloadDatabaseModel()) {
		return;
	}

	// only show the prompt once.
	const didInformUser = appContext.extensionContext.globalState.get<boolean>(DidInformUserKey);
	if (!didInformUser) {
		void appContext.extensionContext.globalState.update(DidInformUserKey, true);
	} else {
		return;
	}
	const yesOption = localize('tableDesigner.yes', "Yes");
	const noOption = localize('tableDesigner.no', "No");

	const result = await vscode.window.showInformationMessage(localize('tableDesigner.turnOnPreloadingMessage', "Do you want to reduce the table designer load time by enabling the database model preloading? The database model will be preloaded when you expand the database node in object explorer."), yesOption, noOption);
	if (result === yesOption) {
		setConfigPreloadDatabaseModel(true);
	}
}
