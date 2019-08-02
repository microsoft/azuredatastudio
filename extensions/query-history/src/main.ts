/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { TelemetryReporter, TelemetryViews } from './telemetry';
const localize = nls.loadMessageBundle();

let channel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	registerCommands(context);
	azdata.queryeditor.registerQueryEventListener(new QueryEventListener());
	channel = vscode.window.createOutputChannel('Query History');
}

export async function deactivate(): Promise<void> {

}

export function onQueryEvent(type: azdata.queryeditor.QueryEvent, document: azdata.queryeditor.QueryDocument, args: any): void {
	channel.appendLine(type);
}

/**
 * Registers extension commands with command subsystem
 * @param context The context used to register the commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('queryHistory.openQueryHistory', handleOpenQueryHistory));
}

function handleOpenQueryHistory(): void {

}

class QueryEventListener {

	public onQueryEvent(type: azdata.queryeditor.QueryEvent, document: azdata.queryeditor.QueryDocument, args: any): void {
		channel.appendLine(type);
	}
}