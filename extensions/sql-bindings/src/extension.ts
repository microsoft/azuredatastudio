/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as constants from './common/constants';
import { ITreeNodeInfo } from 'vscode-mssql';
import { IExtension, BindingType } from 'sql-bindings';
import { getAzdataApi, getVscodeMssqlApi } from './common/utils';
import { addSqlBinding, createAzureFunction, getAzureFunctions } from './services/azureFunctionsService';
import { launchAddSqlBindingQuickpick } from './dialogs/addSqlBindingQuickpick';
import { promptForBindingType, promptAndUpdateConnectionStringSetting, promptForObjectName } from './common/azureFunctionsUtils';

export async function activate(context: vscode.ExtensionContext): Promise<IExtension> {
	const vscodeMssqlApi = await getVscodeMssqlApi();
	void vscode.commands.executeCommand('setContext', 'azdataAvailable', !!getAzdataApi());
	// register the add sql binding command
	context.subscriptions.push(vscode.commands.registerCommand('sqlBindings.addSqlBinding', async (uri: vscode.Uri | undefined) => { return launchAddSqlBindingQuickpick(uri); }));
	// Generate Azure Function command
	context.subscriptions.push(vscode.commands.registerCommand('sqlBindings.createAzureFunction', async (node: ITreeNodeInfo) => {
		if (!node) {
			let openServerPane = await vscode.window.showErrorMessage(constants.chooseAConnection,
				constants.openPane, constants.learnMore);
			if (openServerPane === constants.openPane) {
				// open SQL Server connections pane
				await vscode.commands.executeCommand('objectExplorer.focus');
			} else if (openServerPane === constants.learnMore) {
				void vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(constants.sqlBindingsDoc));
			}
			return;
		}

		let connectionInfo = node?.connectionInfo;
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
		const connectionDetails = vscodeMssqlApi.createConnectionDetails(connectionInfo);
		const connectionString = await vscodeMssqlApi.getConnectionString(connectionDetails, false, false);
		await createAzureFunction(connectionString, node.metadata.schema, node.metadata.name, connectionInfo);
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
