/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function invalidProvider(name?: string): Error {
	if (name) {
		return new Error(`Invalid provider: ${name}`);
	} else {
		return new Error('Invalid provider');
	}
}

export class UserCancelledConnectionError extends Error {
	constructor(message?: string) {
		super(message);
	}
}
