/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { LiveShare, SharedService } from './liveshare';
import { ConnectionProvider } from './providers/connectionProvider';
import { LiveShareSharedServiceName } from './constants';

export class HostSessionManager {
	constructor(
		context: vscode.ExtensionContext,
		vslsApi: LiveShare
	) {

		vslsApi!.onDidChangeSession(async function onLiveShareSessionCHange(e: any) {
			const sharedService: SharedService = await vslsApi.shareService(LiveShareSharedServiceName);
			if (!sharedService) {
				vscode.window.showErrorMessage('Could not create a shared service. You have to set "liveshare.features" to "experimental" in your user settings in order to use this extension.');
				return;
			}

			new ConnectionProvider(true, sharedService);
		});

		// context.subscriptions.push(sharedService.onDidChangeIsServiceAvailable(available => {
		// //	available ? this.startSession() : this.endSession();
		// }));
	}
}
