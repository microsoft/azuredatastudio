/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class AzureAuthError extends Error {
	constructor(localizedMessage: string, public readonly originalMessage: string, private readonly originalException: any) {
		super(localizedMessage);
	}

	/**
	 * Localized message to display to the user describing this error.
	 */
	public get displayableErrorMessage(): string {
		return localize('azureAuthError.fullErrorMessage', '{0} ({1})', this.message, this.originalMessage);
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
