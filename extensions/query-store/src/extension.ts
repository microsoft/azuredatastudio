/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { QueryStoreDashboard } from './reports/queryStoreDashboard';
import { IconPathHelper } from './common/iconHelper';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// TODO: get db name
	// TODO: add OE entry point with condition for command to only be visible for db's with Query Store enabled (or consider always showing and having a way to enable when dashboard is opened?)
	// TODO: remove entry point from command palette - keeping for now to speed up testing so a connection doesn't need to be made to launch the dashboard
	context.subscriptions.push(vscode.commands.registerCommand('queryStore.openQueryStoreDashboard', async (targetTab?: string) => {
		IconPathHelper.setExtensionContext(context);

		const dashboard = new QueryStoreDashboard('AdventureWorks')
		await dashboard.open();

		if (targetTab) {
			dashboard.selectTab(targetTab);
		}
	}));
}

export function deactivate(): void {

}
