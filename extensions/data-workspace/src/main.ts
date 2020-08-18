/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	vscode.commands.registerCommand('dataworkspace.addProject', () => {
	});
}

export function deactivate(): void {
}
