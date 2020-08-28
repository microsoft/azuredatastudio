/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Event, Emitter } from 'vs/base/common/event';

import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';
import { UpdateAccountListEventParams } from 'sql/platform/accounts/common/eventTypes';

/**
 * View model for account picker
 */
export class AccountPickerViewModel {
	// EVENTING ////////////////////////////////////////////////////////////
	private _updateAccountListEmitter: Emitter<UpdateAccountListEventParams>;
	public get updateAccountListEvent(): Event<UpdateAccountListEventParams> { return this._updateAccountListEmitter.event; }

	public selectedAccount: azdata.Account | undefined;
	public selectedTenantId: string | undefined;

	constructor(
		_providerId: string,
		@IAccountManagementService private _accountManagementService: IAccountManagementService
	) {
		// Create our event emitters
		this._updateAccountListEmitter = new Emitter<UpdateAccountListEventParams>();

		// Register handlers for any changes to the accounts
		this._accountManagementService.updateAccountListEvent(arg => this._updateAccountListEmitter.fire(arg));
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	/**
	 * Loads an initial list of accounts from the account management service
	 * @return Promise to return the list of accounts
	 */
	public async initialize(): Promise<azdata.Account[]> {
		try {
			const accounts = await this._accountManagementService.getAccounts();
			return accounts;
		} catch{
			return [];
		}
	}
}
