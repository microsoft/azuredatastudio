/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class AzureAuthError extends Error {
	private readonly _originalMessage: string;

	constructor(localizedMessage: string, _originalMessage: string, private readonly originalException: any) {
		super(localizedMessage);

	}

	get originalMessage(): string {
		return this._originalMessage;
	}

	getPrintableString(): string {
		return JSON.stringify({
			originalMessage: this.originalMessage,
			originalException: this.originalException
		}, undefined, 2);
	}
}
