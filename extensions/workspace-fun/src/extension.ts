/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

export function activate() {
	vscode.commands.registerCommand('workspaceFun.addFolder', async () => {
		const uris = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: true });
		if (uris) {
			for (const uri of uris) {
				vscode.workspace.updateWorkspaceFolders(0, 0, { name: path.basename(uri.toString()), uri });
			}
		}
	});
}
