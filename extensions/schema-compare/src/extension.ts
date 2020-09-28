/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ApiWrapper } from './common/apiWrapper';
import { SchemaCompareMainWindow } from './schemaCompareMainWindow';

export async function activate(extensionContext: vscode.ExtensionContext): Promise<void> {
	vscode.commands.registerCommand('schemaCompare.start', async (context: any) => { await new SchemaCompareMainWindow(new ApiWrapper(), undefined, extensionContext).start(context); });
}

export function deactivate(): void {
}
