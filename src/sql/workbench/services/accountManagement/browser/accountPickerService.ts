/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Event, Emitter } from 'vs/base/common/event';
import * as azdata from 'azdata';

import { IAccountPickerService } from 'sql/workbench/services/accountManagement/browser/accountPicker';
import { AccountPicker } from 'sql/workbench/services/accountManagement/browser/accountPickerImpl';
import { ILogService } from 'vs/platform/log/common/log';

export class AccountPickerService implements IAccountPickerService {
	_serviceBrand: undefined;

	private _accountPicker?: AccountPicker;

	// EVENTING ////////////////////////////////////////////////////////////
	private _addAccountCompleteEmitter: Emitter<void>;
	public get addAccountCompleteEvent(): Event<void> { return this._addAccountCompleteEmitter.event; }

	private _addAccountErrorEmitter: Emitter<string>;
	public get addAccountErrorEvent(): Event<string> { return this._addAccountErrorEmitter.event; }

	private _addAccountStartEmitter: Emitter<void>;
	public get addAccountStartEvent(): Event<void> { return this._addAccountStartEmitter.event; }

	private _onAccountSelectionChangeEvent: Emitter<azdata.Account | undefined>;
	public get onAccountSelectionChangeEvent(): Event<azdata.Account | undefined> { return this._onAccountSelectionChangeEvent.event; }

	private _onTenantSelectionChangeEvent: Emitter<string | undefined>;
	public get onTenantSelectionChangeEvent(): Event<string | undefined> { return this._onTenantSelectionChangeEvent.event; }

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@ILogService private readonly _logService: ILogService
	) {
		// Create event emitters
		this._addAccountCompleteEmitter = new Emitter<void>();
		this._addAccountErrorEmitter = new Emitter<string>();
		this._addAccountStartEmitter = new Emitter<void>();
		this._onAccountSelectionChangeEvent = new Emitter<azdata.Account | undefined>();
		this._onTenantSelectionChangeEvent = new Emitter<string | undefined>();
	}

	/**
	 * Get selected account
	 */
	public get selectedAccount(): azdata.Account | undefined {
		if (this._accountPicker) {
			return this._accountPicker.viewModel.selectedAccount;
		} else {
			return undefined;
		}
	}

	public setInitialAccountTenant(account: string, tenant: string): void {
		if (this._accountPicker) {
			this._accountPicker.setInitialAccount(account);
			this._accountPicker.setInitialTenant(tenant);
			this._logService.info(`Set initial account: ${account} and tenant: ${tenant}`)
		} else {
			this._logService.error('Account Picker was undefined. Could not set initial account/tenant for firewall dialog.');
		}
	}


	/**
	 * Render account picker
	 */
	public renderAccountPicker(rootContainer: HTMLElement): void {
		if (!this._accountPicker) {
			this._accountPicker = this._instantiationService.createInstance(AccountPicker);
			this._accountPicker.createAccountPickerComponent();
		}

		this._accountPicker.addAccountCompleteEvent(() => this._addAccountCompleteEmitter.fire());
		this._accountPicker.addAccountErrorEvent((msg) => this._addAccountErrorEmitter.fire(msg));
		this._accountPicker.addAccountStartEvent(() => this._addAccountStartEmitter.fire());
		this._accountPicker.onAccountSelectionChangeEvent((account) => this._onAccountSelectionChangeEvent.fire(account));
		this._accountPicker.onTenantSelectionChangeEvent((tenantId) => this._onTenantSelectionChangeEvent.fire(tenantId));
		this._accountPicker.render(rootContainer);
	}
}
