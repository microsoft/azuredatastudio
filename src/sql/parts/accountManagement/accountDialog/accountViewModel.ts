/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import Event, { Emitter } from 'vs/base/common/event';
import { IAccountManagementService } from 'sql/services/accountManagement/interfaces';
import { AccountProviderAddedEventParams, UpdateAccountListEventParams } from 'sql/services/accountManagement/eventTypes';

/**
 * View model for account dialog
 */
export class AccountViewModel {
	// EVENTING ///////////////////////////////////////////////////////
	private _addProviderEmitter: Emitter<AccountProviderAddedEventParams>;
	public get addProviderEvent(): Event<AccountProviderAddedEventParams> { return this._addProviderEmitter.event; }

	private _removeProviderEmitter: Emitter<sqlops.AccountProviderMetadata>;
	public get removeProviderEvent(): Event<sqlops.AccountProviderMetadata> { return this._removeProviderEmitter.event; }

	private _updateAccountListEmitter: Emitter<UpdateAccountListEventParams>;
	public get updateAccountListEvent(): Event<UpdateAccountListEventParams> { return this._updateAccountListEmitter.event; }

	constructor( @IAccountManagementService private _accountManagementService: IAccountManagementService) {
		let self = this;

		// Create our event emitters
		this._addProviderEmitter = new Emitter<AccountProviderAddedEventParams>();
		this._removeProviderEmitter = new Emitter<sqlops.AccountProviderMetadata>();
		this._updateAccountListEmitter = new Emitter<UpdateAccountListEventParams>();

		// Register handlers for any changes to the providers or accounts
		this._accountManagementService.addAccountProviderEvent(arg => self._addProviderEmitter.fire(arg));
		this._accountManagementService.removeAccountProviderEvent(arg => self._removeProviderEmitter.fire(arg));
		this._accountManagementService.updateAccountListEvent(arg => self._updateAccountListEmitter.fire(arg));
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	/**
	 * Loads an initial list of account providers and accounts from the account management service
	 * and fires an event after each provider/accounts has been loaded.
	 *
	 */
	public initialize(): Thenable<AccountProviderAddedEventParams[]> {
		let self = this;

		// Load a baseline of the account provider metadata and accounts
		// 1) Get all the providers from the account management service
		// 2) For each provider, get the accounts
		// 3) Build parameters to add a provider and return it
		return this._accountManagementService.getAccountProviderMetadata()
			.then(
			(providers: sqlops.AccountProviderMetadata[]) => {
				let promises = providers.map(provider => {
					return self._accountManagementService.getAccountsForProvider(provider.id)
						.then(
						accounts => <AccountProviderAddedEventParams>{
							addedProvider: provider,
							initialAccounts: accounts
						},
						() => { /* Swallow failures at getting accounts, we'll just hide that provider */ });
				});
				return Promise.all(promises);
			},
			() => {
				/* Swallow failures and just pretend we don't have any providers */
				return [];
			}
			);
	}
}