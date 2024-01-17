/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Event, Emitter } from 'vs/base/common/event';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';
import { AccountProviderAddedEventParams, UpdateAccountListEventParams } from 'sql/platform/accounts/common/eventTypes';
import { coalesce } from 'vs/base/common/arrays';
import { ILogService } from 'vs/platform/log/common/log';
import { IAuthenticationService } from 'vs/workbench/services/authentication/common/authentication';

/**
 * View model for account dialog
 */
export class AccountViewModel {
	// EVENTING ///////////////////////////////////////////////////////
	private _addProviderEmitter: Emitter<AccountProviderAddedEventParams>;
	public get addProviderEvent(): Event<AccountProviderAddedEventParams> { return this._addProviderEmitter.event; }

	private _removeProviderEmitter: Emitter<azdata.AccountProviderMetadata>;
	public get removeProviderEvent(): Event<azdata.AccountProviderMetadata> { return this._removeProviderEmitter.event; }

	private _updateAccountListEmitter: Emitter<UpdateAccountListEventParams>;
	public get updateAccountListEvent(): Event<UpdateAccountListEventParams> { return this._updateAccountListEmitter.event; }

	constructor(
		@IAccountManagementService private readonly _accountManagementService: IAccountManagementService,
		@ILogService private readonly _logService: ILogService,
		@IAuthenticationService private readonly _authenticationService: IAuthenticationService
	) {
		// Create our event emitters
		this._addProviderEmitter = new Emitter<AccountProviderAddedEventParams>();
		this._removeProviderEmitter = new Emitter<azdata.AccountProviderMetadata>();
		this._updateAccountListEmitter = new Emitter<UpdateAccountListEventParams>();

		// Register handlers for any changes to the providers or accounts
		this._accountManagementService.addAccountProviderEvent(arg => this._addProviderEmitter.fire(arg));
		this._accountManagementService.removeAccountProviderEvent(arg => this._removeProviderEmitter.fire(arg));
		this._accountManagementService.updateAccountListEvent(arg => this._updateAccountListEmitter.fire(arg));
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	/**
	 * Loads an initial list of account providers and accounts from the account management service
	 * and fires an event after each provider/accounts has been loaded.
	 *
	 */
	public async initialize(): Promise<AccountProviderAddedEventParams[]> {
		// Load a baseline of the account provider metadata and accounts
		// 1) Get all the providers from the account management service
		// 2) For each provider, get the accounts
		// 3) Build parameters to add a provider and return it
		try {
			let accounts = await this.getAccountsForProviders();
			const sessionAccounts = await this.getAccountForSessions();
			accounts = accounts.concat(sessionAccounts);

			return coalesce(accounts);
		} catch (err) {
			this._logService.warn(`Error getting account provider metadata : ${err}`);
			return [];
		}
	}

	private async getAccountsForProviders(): Promise<AccountProviderAddedEventParams[]> {
		const metadata = await this._accountManagementService.getAccountProviderMetadata();
		const accounts = await Promise.all(metadata.map(async (providerMetadata) => {
			try {
				const accounts = await this._accountManagementService.getAccountsForProvider(providerMetadata.id);

				return <AccountProviderAddedEventParams>{
					addedProvider: providerMetadata,
					initialAccounts: accounts
				};
			} catch (err) {
				this._logService.warn(`Error getting accounts for provider ${providerMetadata.id} : ${err}`);
				return undefined;
			}
		}));

		return accounts.filter(account => !!account);
	}

	private async getAccountForSessions(): Promise<AccountProviderAddedEventParams[]> {
		const sessionAccounts: AccountProviderAddedEventParams[] = [];
		const providerIds = this._authenticationService.getProviderIds();

		for (const providerId of providerIds) {
			const displayName = this._authenticationService.getLabel(providerId);
			const accountType = providerId === 'github' ? 'github' : 'microsoft'; // TODO: Find a better default account icon.

			const sessions = await this._authenticationService.getSessions(providerId);
			const accounts = sessions.map(session => {
				return ({
					key: { providerId: providerId, accountId: session.account.id } as azdata.AccountKey,
					displayInfo: { contextualDisplayName: displayName, accountType: accountType, displayName: session.account.label, userId: session.account.label } as azdata.AccountDisplayInfo,
					isStale: false,
				}) as azdata.Account;
			});

			const sessionAccount: AccountProviderAddedEventParams = {
				addedProvider: {
					id: providerId,
					displayName: displayName
				},
				initialAccounts: accounts
			};
			sessionAccounts.push(sessionAccount);
		}

		return sessionAccounts;
	}
}
