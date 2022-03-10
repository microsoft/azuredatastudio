/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { getAzdataApi } from './common/utils';
import { launchAddSqlBindingQuickpick } from '../src/dialogs/addSqlBindingQuickpick';

export function activate(context: vscode.ExtensionContext): void {
	void vscode.commands.executeCommand('setContext', 'azdataAvailable', !!getAzdataApi());
	context.subscriptions.push(vscode.commands.registerCommand('sqlBindings.addSqlBinding', async (uri: vscode.Uri | undefined) => { return launchAddSqlBindingQuickpick(uri); }));
}

export function deactivate(): void {
}
