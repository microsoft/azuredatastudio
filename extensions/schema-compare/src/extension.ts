/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { SchemaCompareMainWindow } from './schemaCompareMainWindow';

export async function activate(extensionContext: vscode.ExtensionContext): Promise<void> {
	vscode.commands.registerCommand('schemaCompare.start', async (context: any) => { await new SchemaCompareMainWindow(undefined, extensionContext, undefined).start(context); });
}

export function deactivate(): void {
}
