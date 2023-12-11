/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class AzureAuthError extends Error {
	constructor(localizedMessage: string, public readonly originalMessage: string, private readonly originalException: unknown) {
		super(localizedMessage);
	}

	/**
	 * The original message and exception for displaying extra information
	 */
	public get originalMessageAndException(): string {
		return JSON.stringify({
			originalMessage: this.originalMessage,
			originalException: this.originalException
		}, undefined, 2);
	}
}
