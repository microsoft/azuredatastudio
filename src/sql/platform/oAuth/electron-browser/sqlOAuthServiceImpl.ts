/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as electron from 'electron';
import { ISqlOAuthService } from 'sql/platform/oAuth/common/sqlOAuthService';

/**
 * Implements simple electron based utilities for registering and sending IPC to the main thread to
 * handle OAuth requests. This is to avoid breaking layering issues caused when certain
 * electron-based services are referenced in unit testable code.
 */
export class SqlOAuthService implements ISqlOAuthService {
	public _serviceBrand: any;

	/**
	 * Sends request to main thread to handle OAuth request
	 * @param {string} eventId Unique ID of the request to return upon completion
	 * @param {string} url URL to load to do OAuth
	 * @param {boolean} silent Whether or not to show the OAuth window
	 * @return {Thenable<string>} Promise to return an authorization code
	 */
	performOAuthAuthorization(eventId: string, url: string, silent: boolean): void {
		// Setup the args and send the IPC call
		electron.ipcRenderer.send(
			'oauth',
			{
				url: url,
				silent: silent,
				eventId: eventId
			}
		);
	}

	/**
	 * Registers a handler for the oauth-reply event on the IPC channel
	 * @param {(event, args) => void} handler Handler to call when the event is triggered
	 */
	registerOAuthCallback(handler: (event, args) => void): void {
		electron.ipcRenderer.on('oauth-reply', handler);
	}
}
