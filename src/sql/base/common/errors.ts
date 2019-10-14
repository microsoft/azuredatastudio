/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function invalidProvider(name?: string): Error {
	if (name) {
		return new Error(`Invalid provider: ${name}`);
	} else {
		return new Error('Invalid provider');
	}
}

export class UserCancelledConnectionError extends Error {
	static code(): string {
		return 'loginCanceled';
	}
	public readonly code: string;
	constructor(message?) {
		super(message);

		this.code = UserCancelledConnectionError.code();
	}

}
