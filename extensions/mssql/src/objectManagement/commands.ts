/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ServerRoleDialog } from './ui/serverRoleDialog';


export function registerObjectManagementCommands(appContext: AppContext) {
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newServerRole', async (context: azdata.ObjectExplorerContext) => {
		const dialog = new ServerRoleDialog(undefined);
		dialog.open();
	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newLogin', async (context: azdata.ObjectExplorerContext) => {

	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newApplicationRole', async (context: azdata.ObjectExplorerContext) => {

	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newDatabaseRole', async (context: azdata.ObjectExplorerContext) => {

	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.newUser', async (context: azdata.ObjectExplorerContext) => {

	}));
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand('mssql.objectProperties', async (context: azdata.ObjectExplorerContext) => {

	}));
}
