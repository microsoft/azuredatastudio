/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
//import * as azdata from 'azdata';

// import { GuestSessionManager } from './guestSession';
// import { HostSessionManager } from './hostSession';
import { ConnectionFeature } from './providers/connectionProvider';
import { QueryFeature } from './providers/queryProvider';

declare var require: any;
let vsls = require('vsls');

export class State {
	private static _extContext: vscode.ExtensionContext;

	public static get extensionContext(): vscode.ExtensionContext {
		return this._extContext;
	}

	public static set extensionContext(ec: vscode.ExtensionContext) {
		this._extContext = ec;
	}
}

// const changeColorOfLiveShareSessionFactory = (isHost: boolean) => {
// 	return async function changeColorOfLiveShareSession() {

// 		const vslsApi = await vsls.getApi();
// 		const serviceName = 'mssql-query';
// 		if (isHost) {
// 			//const sharedService = await vslsApi.shareService(serviceName);
// 			//this.sharedService.request('load', [ this.adapterId ]);
// 		} else {
// 			const sharedServiceProxy = await vslsApi.getSharedService(serviceName);
// 			sharedServiceProxy.request('load', [ 1050 ]);
// 		}

// 		return State.extensionContext;
// 	};
//   };

//   export const changeColorOfLiveShareHostHandler = changeColorOfLiveShareSessionFactory(
// 	true
//   );
//   export const changeColorOfLiveShareGuestHandler = changeColorOfLiveShareSessionFactory(
// 	false
//   );


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

const vslsPrefix: string = 'vsls';

function isLiveShareDocument(doc: vscode.TextDocument): boolean {
	return (doc && doc.uri.toString().startsWith(vslsPrefix));
}

async function onDidOpenTextDocument(doc: vscode.TextDocument): Promise<void> {
	//let queryDoc = await azdata.queryeditor.getQueryDocument(doc.uri.toString());
	if (isLiveShareDocument(doc)) {

	}
}

export async function activate(context: vscode.ExtensionContext) {

	State.extensionContext = context;

	const vslsApi = await vsls.getApi();
	// await vscode.commands.executeCommand(
	// 	'setContext',
	// 	'ads:liveshare',
	// 	!!vslsApi
	// );

	if (!vslsApi) {
		return;
	}

	vscode.workspace.onDidOpenTextDocument(params => onDidOpenTextDocument(params));

	vslsApi!.onDidChangeSession(async function onLiveShareSessionCHange(e: any) {
		// If there isn't a session ID, then that
		// means the session has been ended.
		const isHost = e.session.role === vsls.Role.Host;
		if (!e.session.id && isHost) {
			return;
		}

		const serviceName = 'mssql-query';
		const sharedService = await vslsApi.shareService(serviceName);

		if (!sharedService) {
			vscode.window.showErrorMessage('Could not create a shared service. You have to set "liveshare.features" to "experimental" in your user settings in order to use this extension.');
			return;
		}

		const sharedServiceProxy = await vslsApi.getSharedService(serviceName);
		if (!sharedServiceProxy) {
			vscode.window.showErrorMessage('Could not access a shared service. You have to set "liveshare.features" to "experimental" in your user settings in order to use this extension.');
			return;
		}

		// new HostSessionManager(context, sharedService);
		// new GuestSessionManager(context, sharedServiceProxy);

		let connection = new ConnectionFeature();
		connection.registerProvider();
		connection.registerListeners(isHost, sharedService, sharedServiceProxy);

		new QueryFeature().registerProvider();
		return;
	});

	registerLiveShareIntegrationCommands();




}

export function deactivate(): void {
}
