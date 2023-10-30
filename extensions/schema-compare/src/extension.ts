/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as mssql from 'mssql';
import { SchemaCompareMainWindow } from './schemaCompareMainWindow';
import { TelemetryReporter } from './telemetry';

export async function activate(extensionContext: vscode.ExtensionContext): Promise<void> {
	extensionContext.subscriptions.push(vscode.commands.registerCommand('schemaCompare.start', async (sourceContext: any, targetContext: any = undefined, comparisonResult: any = undefined) => { await new SchemaCompareMainWindow(undefined, extensionContext, undefined).start(sourceContext, targetContext, comparisonResult); }));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('schemaCompare.runComparison', async (source: mssql.SchemaCompareEndpointInfo | undefined, target: mssql.SchemaCompareEndpointInfo | undefined, runComparison: boolean = false, comparisonResult: mssql.SchemaCompareResult | undefined) => { await new SchemaCompareMainWindow(undefined, extensionContext, undefined).launch(source, target, runComparison, comparisonResult); }));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('schemaCompare.openInScmp', async (fileUri: vscode.Uri) => { await new SchemaCompareMainWindow(undefined, extensionContext, undefined).openScmpFile(fileUri); }));
	extensionContext.subscriptions.push(TelemetryReporter);
}

export function deactivate(): void {
}
