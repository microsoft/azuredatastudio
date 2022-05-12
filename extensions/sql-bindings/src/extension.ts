/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { IConnectionInfo, ITreeNodeInfo } from 'vscode-mssql';
import { IExtension, BindingType, GetAzureFunctionsResult, ResultStatus, IConnectionStringInfo } from 'sql-bindings';
import { addSqlBinding, createAzureFunction, getAzureFunctions } from './services/azureFunctionsService';
import { launchAddSqlBindingQuickpick } from './dialogs/addSqlBindingQuickpick';
import { promptForBindingType, promptAndUpdateConnectionStringSetting, promptForObjectName } from './common/azureFunctionsUtils';

export async function activate(context: vscode.ExtensionContext): Promise<IExtension> {
	// register the add sql binding command
	context.subscriptions.push(vscode.commands.registerCommand('sqlBindings.addSqlBinding', async (uri: vscode.Uri | undefined) => { return launchAddSqlBindingQuickpick(uri); }));
	// Generate Azure Function command
	context.subscriptions.push(vscode.commands.registerCommand('sqlBindings.createAzureFunction', async (node?: ITreeNodeInfo) => {
		return await createAzureFunction(node);
	}));
	return {
		addSqlBinding: async (bindingType: BindingType, filePath: string, functionName: string, objectName: string, connectionStringSetting: string): Promise<ResultStatus> => {
			return addSqlBinding(bindingType, filePath, functionName, objectName, connectionStringSetting);
		},
		promptForBindingType: async (funcName?: string): Promise<BindingType | undefined> => {
			return promptForBindingType(funcName);
		},
		promptForObjectName: async (bindingType: BindingType, connectionInfo?: IConnectionInfo): Promise<string | undefined> => {
			return promptForObjectName(bindingType, connectionInfo);
		},
		promptAndUpdateConnectionStringSetting: async (projectUri: vscode.Uri | undefined, connectionInfo?: IConnectionInfo): Promise<IConnectionStringInfo | undefined> => {
			return promptAndUpdateConnectionStringSetting(projectUri, connectionInfo);
		},
		getAzureFunctions: async (filePath: string): Promise<GetAzureFunctionsResult> => {
			return getAzureFunctions(filePath);
		}
	};
}

export function deactivate(): void {
}
