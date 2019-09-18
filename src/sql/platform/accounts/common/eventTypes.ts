/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

/**
 * Result from calling add/update on the account store
 */
export interface AccountAdditionResult {
	/**
	 * Whether or not an account was added in the add/update process
	 */
	accountAdded: boolean;

	/**
	 * Whether or not an account was updated in the add/update process
	 */
	accountModified: boolean;

	/**
	 * The account that was added/updated (with any updates applied)
	 */
	changedAccount: azdata.Account | undefined;
}

/**
 * Parameters that go along with an account provider being added
 */
export interface AccountProviderAddedEventParams {
	/**
	 * The provider that was registered
	 */
	addedProvider: azdata.AccountProviderMetadata;

	/**
	 * The accounts that were rehydrated with the provider
	 */
	initialAccounts: azdata.Account[];
}

/**
 * Parameters that go along when a provider's account list changes
 */
export interface UpdateAccountListEventParams {
	/**
	 * ID of the provider who's account list changes
	 */
	providerId: string;

	/**
	 * Updated list of accounts, sorted appropriately
	 */
	accountList: azdata.Account[];
}
