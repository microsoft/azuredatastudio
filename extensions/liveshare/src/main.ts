/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { registerLiveShareIntegrationCommands } from './commands';
import { setExtensionContext } from './extension-context';

declare var require: any;
let vsls = require('vsls');

export async function activate(context: vscode.ExtensionContext) {

	setExtensionContext(context);

	const vslsApi = await vsls.getApi();
	await vscode.commands.executeCommand(
		'setContext',
		'peacock:liveshare',
		!!vslsApi
	);


	if (!vslsApi) {
		return;
	}

	vslsApi!.onDidChangeSession(async function onLiveShareSessionCHange(e: any) {
		// If there isn't a session ID, then that
		// means the session has been ended.
		const isHost = e.session.role === vsls.Role.Host;
		if (!e.session.id && isHost) {
			//return await revertLiveShareWorkspaceColors();
			return;
		}

		return;
		//return await setLiveShareSessionWorkspaceColors(isHost);
	});

	registerLiveShareIntegrationCommands();
}

export function deactivate(): void {
}



