/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class AzureResourceCredentialError extends Error {
	constructor(
		message: string,
		public readonly innerError: Error
	) {
		super(message);
	}
}
