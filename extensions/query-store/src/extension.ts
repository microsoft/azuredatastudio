/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { TopResourceConsumingQueries } from './reports/topResourceConsumingQueries';
import { OverallResourceConsumption } from './reports/overallResourceConsumption';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// TODO: get db name
	context.subscriptions.push(vscode.commands.registerCommand('queryStore.topResourceConsumingQueriesOpen', async () => { await new TopResourceConsumingQueries(context, 'WideWorldImporters').open() }));
	context.subscriptions.push(vscode.commands.registerCommand('queryStore.overallResourceConsumptionOpen', async () => { await new OverallResourceConsumption(context, 'WideWorldImporters').open() }));
}

export function deactivate(): void {

}
