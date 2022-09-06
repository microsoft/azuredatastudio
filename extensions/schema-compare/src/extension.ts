/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as mssql from 'mssql';
import { SchemaCompareMainWindow } from './schemaCompareMainWindow';

export async function activate(extensionContext: vscode.ExtensionContext): Promise<void> {
	vscode.commands.registerCommand('schemaCompare.start', async (sourceContext: any, targetContext: any = undefined, comparisonResult: any = undefined) => { await new SchemaCompareMainWindow(undefined, extensionContext, undefined).start(sourceContext, targetContext, comparisonResult); });
	vscode.commands.registerCommand('schemaCompare.runComparison', async (source: mssql.SchemaCompareEndpointInfo | undefined, target: mssql.SchemaCompareEndpointInfo | undefined, runComparison: boolean = false, comparisonResult: mssql.SchemaCompareResult | undefined) => { await new SchemaCompareMainWindow(undefined, extensionContext, undefined).launch(source, target, runComparison, comparisonResult); });
	vscode.commands.registerCommand('schemaCompare.openInScmp', async (fileUri: vscode.Uri) => { await new SchemaCompareMainWindow(undefined, extensionContext, undefined).openScmpFile(fileUri); });
}

export function deactivate(): void {
}
