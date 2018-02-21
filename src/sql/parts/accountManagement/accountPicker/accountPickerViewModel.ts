/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import Event, { Emitter } from 'vs/base/common/event';

import { IAccountManagementService } from 'sql/services/accountManagement/interfaces';
import { UpdateAccountListEventParams } from 'sql/services/accountManagement/eventTypes';

/**
 * View model for account picker
 */
export class AccountPickerViewModel {
	// EVENTING ////////////////////////////////////////////////////////////
	private _updateAccountListEmitter: Emitter<UpdateAccountListEventParams>;
	public get updateAccountListEvent(): Event<UpdateAccountListEventParams> { return this._updateAccountListEmitter.event; }

	public selectedAccount: sqlops.Account;

	constructor(
		private _providerId: string,
		@IAccountManagementService private _accountManagementService: IAccountManagementService
	) {
		let self = this;

		// Create our event emitters
		this._updateAccountListEmitter = new Emitter<UpdateAccountListEventParams>();

		// Register handlers for any changes to the accounts
		this._accountManagementService.updateAccountListEvent(arg => self._updateAccountListEmitter.fire(arg));
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	/**
	 * Loads an initial list of accounts from the account management service
	 * @return {Thenable<Account[]>} Promise to return the list of accounts
	 */
	public initialize(): Thenable<sqlops.Account[]> {
		// Load a baseline of the accounts for the provider
		return this._accountManagementService.getAccountsForProvider(this._providerId)
			.then(null, () => {
				// In the event we failed to lookup accounts for the provider, just send
				// back an empty collection
				return [];
			});
	}
}