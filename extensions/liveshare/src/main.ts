/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { GuestSessionManager } from './guestSessionManager';
import { HostSessionManager } from './hostSessionManager';

declare var require: any;
let vsls = require('vsls');

function testCommand1() {

}

function testCommand2() {

}

export function registerLiveShareIntegrationCommands() {
	vscode.commands.registerCommand(
		'collaboration.testcmd1',
		testCommand1
	);
	vscode.commands.registerCommand(
		'collaboration.testcmd2',
		testCommand2
	);
}


export async function activate(context: vscode.ExtensionContext) {
	const vslsApi = await vsls.getApi();
	if (!vslsApi) {
		return;
	}

	new HostSessionManager(context, vslsApi);
	new GuestSessionManager(context, vslsApi);

	// test commands for easy entry points during early dev
	registerLiveShareIntegrationCommands();
}

export function deactivate(): void {
}


// scrap snippets for deletion
// function isLiveShareDocument(doc: vscode.TextDocument): boolean {
// 	return (doc && doc.uri.toString().startsWith(vslsPrefix));
// }
// async function onDidOpenTextDocument(doc: vscode.TextDocument): Promise<void> {
// 	//let queryDoc = await azdata.queryeditor.getQueryDocument(doc.uri.toString());
// 	if (isLiveShareDocument(doc)) {
// 		azdata.conn
// 	}
// }
// await vscode.commands.executeCommand(
// 	'setContext',
// 	'ads:liveshare',
// 	!!vslsApi
// );
// vscode.workspace.onDidOpenTextDocument(params => onDidOpenTextDocument(params));
// export class State {
// 	private static _extContext: vscode.ExtensionContext;
// 	public static connection: ConnectionProvider;
// 	public static guestSessionManager: GuestSession;
// 	public static get extensionContext(): vscode.ExtensionContext {
// 		return this._extContext;
// 	}
// 	public static set extensionContext(ec: vscode.ExtensionContext) {
// 		this._extContext = ec;
// 	}
// }
