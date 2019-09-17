/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Event, Emitter } from 'vs/base/common/event';
import * as azdata from 'azdata';

import { IAccountPickerService } from 'sql/platform/accounts/browser/accountPicker';
import { AccountPicker } from 'sql/platform/accounts/browser/accountPickerImpl';

export class AccountPickerService implements IAccountPickerService {
	_serviceBrand: undefined;

	private _accountPicker: AccountPicker;

	// EVENTING ////////////////////////////////////////////////////////////
	private _addAccountCompleteEmitter: Emitter<void>;
	public get addAccountCompleteEvent(): Event<void> { return this._addAccountCompleteEmitter.event; }

	private _addAccountErrorEmitter: Emitter<string>;
	public get addAccountErrorEvent(): Event<string> { return this._addAccountErrorEmitter.event; }

	private _addAccountStartEmitter: Emitter<void>;
	public get addAccountStartEvent(): Event<void> { return this._addAccountStartEmitter.event; }

	private _onAccountSelectionChangeEvent: Emitter<azdata.Account | undefined>;
	public get onAccountSelectionChangeEvent(): Event<azdata.Account | undefined> { return this._onAccountSelectionChangeEvent.event; }

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		// Create event emitters
		this._addAccountCompleteEmitter = new Emitter<void>();
		this._addAccountErrorEmitter = new Emitter<string>();
		this._addAccountStartEmitter = new Emitter<void>();
		this._onAccountSelectionChangeEvent = new Emitter<azdata.Account>();
	}

	/**
	 * Get selected account
	 */
	public get selectedAccount(): azdata.Account | undefined {
		return this._accountPicker.viewModel.selectedAccount;
	}

	/**
	 * Render account picker
	 */
	public renderAccountPicker(container: HTMLElement): void {
		if (!this._accountPicker) {
			// TODO: expand support to multiple providers
			const providerId: string = 'azurePublicCloud';
			this._accountPicker = this._instantiationService.createInstance(AccountPicker, providerId);
			this._accountPicker.createAccountPickerComponent();
		}

		this._accountPicker.addAccountCompleteEvent(() => this._addAccountCompleteEmitter.fire());
		this._accountPicker.addAccountErrorEvent((msg) => this._addAccountErrorEmitter.fire(msg));
		this._accountPicker.addAccountStartEvent(() => this._addAccountStartEmitter.fire());
		this._accountPicker.onAccountSelectionChangeEvent((account) => this._onAccountSelectionChangeEvent.fire(account));
		this._accountPicker.render(container);
	}
}
