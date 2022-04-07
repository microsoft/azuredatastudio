/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as constants from './common/constants';
import { IConnectionInfo, ITreeNodeInfo } from 'vscode-mssql';
import { IExtension, BindingType } from 'sql-bindings';
import { getAzdataApi, getVscodeMssqlApi, generateQuotedFullName, getErrorMessage } from './common/utils';
import { addSqlBinding, createAzureFunction, getAzureFunctions } from './services/azureFunctionsService';
import { launchAddSqlBindingQuickpick } from './dialogs/addSqlBindingQuickpick';
import { promptForBindingType, promptAndUpdateConnectionStringSetting, promptForObjectName } from './common/azureFunctionsUtils';

export async function activate(context: vscode.ExtensionContext): Promise<IExtension> {
	const vscodeMssqlApi = await getVscodeMssqlApi();
	void vscode.commands.executeCommand('setContext', 'azdataAvailable', !!getAzdataApi());
	// register the add sql binding command
	context.subscriptions.push(vscode.commands.registerCommand('sqlBindings.addSqlBinding', async (uri: vscode.Uri | undefined) => { return launchAddSqlBindingQuickpick(uri); }));
	// Generate Azure Function command
	context.subscriptions.push(vscode.commands.registerCommand('sqlBindings.createAzureFunction', async (node?: ITreeNodeInfo) => {
		let selectedBinding: (vscode.QuickPickItem & { type: BindingType; }) | undefined;
		let connectionInfo: IConnectionInfo | undefined;
		let connectionURI: string;
		let listDatabases: string[] | undefined;
		let objectName: string | undefined;
		if (!node) {
			// if user selects command in command palette we prompt user for information
			try {
				// Ask binding type for promptObjectName
				selectedBinding = await promptForBindingType();

				if (!selectedBinding) {
					return;
				}
				// prompt user for connection profile to get connection info
				connectionInfo = await vscodeMssqlApi.promptForConnection(true);
				if (!connectionInfo) {
					void vscode.window.showWarningMessage(constants.needConnection);
					return;
				}
				connectionURI = await vscodeMssqlApi.connect(connectionInfo);
				// list databases based on connection profile selected
				listDatabases = await vscodeMssqlApi.listDatabases(connectionURI);
				const selectedDatabase = (await vscode.window.showQuickPick(listDatabases, {
					canPickMany: false,
					title: constants.selectDatabase,
					ignoreFocusOut: true
				}));

				if (!selectedDatabase) {
					// User cancelled
					return;
				}
				connectionInfo.database = selectedDatabase;

				// prompt user for object name to create function from
				objectName = await promptForObjectName(selectedBinding.type);

			} catch (e) {
				void vscode.window.showErrorMessage(getErrorMessage(e));
			}
		} else {
			connectionInfo = node.connectionInfo;
			// set the database containing the selected table so it can be used
			// for the initial catalog property of the connection string
			let newNode: ITreeNodeInfo = node;
			while (newNode) {
				if (newNode.nodeType === 'Database') {
					connectionInfo.database = newNode.metadata.name;
					break;
				} else {
					newNode = newNode.parentNode;
				}
			}
			objectName = generateQuotedFullName(node.metadata.schema, node.metadata.name);
		}
		if (!connectionInfo) {
			void vscode.window.showWarningMessage(constants.needConnection);
			return;
		}
		if (!objectName) {
			// user cancelled
			return;
		}
		const connectionDetails = vscodeMssqlApi.createConnectionDetails(connectionInfo);
		const connectionString = await vscodeMssqlApi.getConnectionString(connectionDetails, false, false);
		await createAzureFunction(connectionString, connectionInfo, objectName, selectedBinding);
	}));
	return {
		addSqlBinding: async (bindingType: BindingType, filePath: string, functionName: string, objectName: string, connectionStringSetting: string) => {
			return addSqlBinding(bindingType, filePath, functionName, objectName, connectionStringSetting);
		},
		promptForBindingType: async () => {
			return promptForBindingType();
		},
		promptForObjectName: async (bindingType: BindingType) => {
			return promptForObjectName(bindingType);
		},
		promptAndUpdateConnectionStringSetting: async (projectUri: vscode.Uri | undefined) => {
			return promptAndUpdateConnectionStringSetting(projectUri);
		},
		getAzureFunctions: async (filePath: string) => {
			return getAzureFunctions(filePath);
		}
	};
}

export function deactivate(): void {
}
