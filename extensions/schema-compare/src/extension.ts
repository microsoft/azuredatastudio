/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { SchemaCompareMainWindow } from './schemaCompareMainWindow';

export async function activate(extensionContext: vscode.ExtensionContext): Promise<void> {
	vscode.commands.registerCommand('schemaCompare.start', async (sourceContext: any, targetContext: any = undefined, comparisonResult: any = undefined) => { await new SchemaCompareMainWindow(undefined, extensionContext, undefined).start(sourceContext, targetContext, comparisonResult); });
}

export function deactivate(): void {
}
