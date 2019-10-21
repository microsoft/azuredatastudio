/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const ISqlOAuthService = createDecorator<ISqlOAuthService>('sqlOAuthService');

/**
 * Defines simple electron based utilities for registering and sending IPC to the main thread to
 * handle OAuth requests. This is to avoid breaking layering issues caused when certain
 * electron-based services are referenced in unit testable code.
 */
export interface ISqlOAuthService {
	_serviceBrand: undefined;

	/**
	 * Sends request to main thread to handle OAuth request
	 * @param eventId Unique ID of the request to return upon completion
	 * @param url URL to load to do OAuth
	 * @param silent Whether or not to show the OAuth window
	 * @return Promise to return an authorization code
	 */
	performOAuthAuthorization(eventId: string, url: string, silent: boolean): void;
}
