/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { QueryStoreDashboard } from './reports/queryStoreDashboard';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// TODO: get db name
	// TODO: add condition for command to only be visible for db's with Query Store enabled (or consider always showing and having a way to enable when dashboard is opened?)
	context.subscriptions.push(vscode.commands.registerCommand('queryStore.openQueryStoreDashboard', async () => { await new QueryStoreDashboard('AdventureWorks').open() }));
}

export function deactivate(): void {

}
