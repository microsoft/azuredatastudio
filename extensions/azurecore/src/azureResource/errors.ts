/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class AzureSubscriptionError extends Error {
	constructor(
		accountName: string,
		public readonly errors: Error[]
	) {
		super(localize('azure.subscriptionError', "Failed to get subscriptions for account {0}. Please refresh the account.", accountName));
	}
}
