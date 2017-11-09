/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as electron from 'electron';
import * as urlLib from 'url';
import { IWindowsMainService } from 'vs/platform/windows/electron-main/windows';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import { warn } from 'sql/base/common/log';

export class ProxyOAuthHandler {
	_serviceBrand: any;

	private disposables: IDisposable[] = [];

	constructor( @IWindowsMainService private windowsService: IWindowsMainService) {
		let self = this;
		electron.ipcMain.on('oauth', (event, args) => {
			self.onOAuthRequest(event, args);
		});
	}

	private static sendOAuthResponse(event, eventId: string, error: any, code: string) {
		let args = {
			eventId: eventId,
			error: error,
			code: code
		};
		event.sender.send('oauth-reply', args);
	}

	private onOAuthRequest(event, args) {
		// Verify the arguments are correct
		if (!args || args['eventId'] === undefined) {
			warn('Received OAuth request with invalid arguments');
			return;
		}
		let eventId: string = args['eventId'];
		let url: string = args['url'];
		let silent: boolean = args['silent'];

		let windowConfig = {
			show: !silent,
			width: 568,
			height: 720,
			resizable: false,
			center: false,
			alwaysOnTop: true,
			autoHideMenuBar: true,
			webPreferences: {
				nodeIntegration: false
			}
		};

		let authWindow = new electron.BrowserWindow(windowConfig);

		// TODO: Determine if we need to do the fancy logic that devdiv did to get around buggy AAD calls

		// Define a function that will parse the redirect URI
		// NOTE: This is defined like this b/c we need access to a lot of scope
		function onCallback(webEvent, url: string) {
			let query: any = urlLib.parse(url, true).query;
			let code: string = query.code;
			let error: string = query.error;

			if (error !== undefined) {
				// We received an error
				ProxyOAuthHandler.sendOAuthResponse(event, eventId, error, null);
			} else if (code) {
				// We received a successful authorization code
				ProxyOAuthHandler.sendOAuthResponse(event, eventId, null, code);
			} else {
				// We didn't get a code or error, so let this redirect continue on
				return;
			}

			// We got an error or a code, so we should close the window without redirecting
			authWindow.removeAllListeners('closed');
			authWindow.close();
			webEvent.preventDefault();
		}

		// Remove all 'will-navigate' events since VS Code prevents navigation by default
		authWindow.webContents.removeAllListeners('will-navigate');

		// Setup event handlers
		// closed -> user closed the window
		// will-navigate, did-get-redirect-request -> OAuth redirected back to the redirect URL
		authWindow.on('closed', () => { ProxyOAuthHandler.sendOAuthResponse(event, eventId, 'User cancelled authentication', null); });
		authWindow.webContents.on('will-navigate', (event, url) => { onCallback(event, url); });
		authWindow.webContents.on('did-get-redirect-request', (event, oldUrl, newUrl) => { onCallback(event, newUrl); });

		// Load the URL
		authWindow.loadURL(url);
	}

	public dispose(): void {
		this.disposables = dispose(this.disposables);
	}
}
