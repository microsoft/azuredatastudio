/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { LiveShare, SharedServiceProxy } from './liveshare';
import { ConnectionProvider } from './providers/connectionProvider';
import { LiveShareSharedServiceName } from './constants';
import { QueryProvider } from './providers/queryProvider';

declare var require: any;
let vsls = require('vsls');

export class GuestSessionManager {
	private static readonly VslsPrefix: string = 'vsls';

	constructor(
		context: vscode.ExtensionContext,
		vslsApi: LiveShare
	) {
		vscode.workspace.onDidOpenTextDocument(params => this.onDidOpenTextDocument(params));

		vslsApi!.onDidChangeSession(async function onLiveShareSessionCHange(e: any) {
			const isHost = e.session.role === vsls.Role.Host;
			if (!e.session.id && isHost) {
				return;
			}

			const sharedServiceProxy: SharedServiceProxy = await vslsApi.getSharedService(LiveShareSharedServiceName);
			if (!sharedServiceProxy) {
				vscode.window.showErrorMessage('Could not access a shared service. You have to set "liveshare.features" to "experimental" in your user settings in order to use this extension.');
				return;
			}

			const connectionProvider = new ConnectionProvider(false);
			connectionProvider.initialize(false, sharedServiceProxy);

			const queryProvider = new QueryProvider(false);
			queryProvider.initialize(false, sharedServiceProxy);
		});
	}

	private isLiveShareDocument(doc: vscode.TextDocument): boolean {
		return (doc && doc.uri.toString().startsWith(GuestSessionManager.VslsPrefix));
	}

	private async onDidOpenTextDocument(doc: vscode.TextDocument): Promise<void> {
		if (this.isLiveShareDocument(doc)) {
		}
	}
}
