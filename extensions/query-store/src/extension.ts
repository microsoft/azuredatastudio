/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { QueryStoreDashboard } from './reports/queryStoreDashboard';
import { IconPathHelper } from './common/iconHelper';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// TODO: add OE entry point with condition for command to only be visible for db's with Query Store enabled (or consider always showing and having a way to enable when dashboard is opened?)
	context.subscriptions.push(vscode.commands.registerCommand('queryStore.openQueryStoreDashboard', async (connectionContext: azdata.ObjectExplorerContext, targetTab?: string) => {
		IconPathHelper.setExtensionContext(context);

		if (!connectionContext.connectionProfile) {
			return;
		}

		const dashboard = new QueryStoreDashboard(connectionContext.connectionProfile);
		await dashboard.open();

		if (targetTab) {
			dashboard.selectTab(targetTab);
		}
	}));
}

export function deactivate(): void {

}
