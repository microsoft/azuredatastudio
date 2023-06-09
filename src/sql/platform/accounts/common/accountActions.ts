/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Event, Emitter } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';

import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';
import { IDialogService, IConfirmation } from 'vs/platform/dialogs/common/dialogs';
import { INotificationService } from 'vs/platform/notification/common/notification';
import Severity from 'vs/base/common/severity';
import { ILogService } from 'vs/platform/log/common/log';

/**
 * Actions to add a new account
 */
export class AddAccountAction extends Action {
	// CONSTANTS ///////////////////////////////////////////////////////////
	public static ID = 'account.addLinkedAccount';
	public static LABEL = localize('addAccount', "Add an account");

	// EVENTING ////////////////////////////////////////////////////////////
	private _addAccountCompleteEmitter: Emitter<void>;
	public get addAccountCompleteEvent(): Event<void> { return this._addAccountCompleteEmitter.event; }

	private _addAccountErrorEmitter: Emitter<string>;
	public get addAccountErrorEvent(): Event<string> { return this._addAccountErrorEmitter.event; }

	private _addAccountStartEmitter: Emitter<void>;
	public get addAccountStartEvent(): Event<void> { return this._addAccountStartEmitter.event; }

	constructor(
		private _providerId: string,
		@IAccountManagementService private _accountManagementService: IAccountManagementService,
		@ILogService private readonly logService: ILogService
	) {
		super(AddAccountAction.ID, AddAccountAction.LABEL);
		this.class = 'add-linked-account-action';

		this._addAccountCompleteEmitter = new Emitter<void>();
		this._addAccountErrorEmitter = new Emitter<string>();
		this._addAccountStartEmitter = new Emitter<void>();
	}

	public override async run(): Promise<void> {

		// Fire the event that we've started adding accounts
		this._addAccountStartEmitter.fire();
		try {
			await this._accountManagementService.addAccount(this._providerId);
			this._addAccountCompleteEmitter.fire();
		} catch (err) {
			this.logService.error(`Error while adding account: ${err}`);
			this._addAccountErrorEmitter.fire(err);
			this._addAccountCompleteEmitter.fire();
		}
	}
}

/**
 * Actions to remove the account
 */
export class RemoveAccountAction extends Action {
	public static ID = 'account.removeAccount';
	public static LABEL = localize('removeAccount', "Remove account");

	constructor(
		private _account: azdata.Account,
		@IDialogService private _dialogService: IDialogService,
		@INotificationService private _notificationService: INotificationService,
		@IAccountManagementService private _accountManagementService: IAccountManagementService
	) {
		super(RemoveAccountAction.ID, RemoveAccountAction.LABEL, 'remove-account-action codicon remove');
	}

	public override async run(): Promise<void> {
		// Ask for Confirm
		const confirm: IConfirmation = {
			message: localize('confirmRemoveUserAccountMessage', "Are you sure you want to remove '{0}'?", this._account.displayInfo.displayName),
			primaryButton: localize('accountActions.yes', "Yes"),
			secondaryButton: localize('accountActions.no', "No"),
			type: 'question'
		};

		const result = await this._dialogService.confirm(confirm);
		if (result?.confirmed) {
			try {
				await this._accountManagementService.removeAccount(this._account.key);
			} catch (err) {
				this._notificationService.notify({
					severity: Severity.Error,
					message: localize('removeAccountFailed', "Failed to remove account")
				});
			}
		}
	}
}

/**
 * Actions to apply filter to the account
 */
export class ApplyFilterAction extends Action {
	public static ID = 'account.applyFilters';
	public static LABEL = localize('applyFilters', "Apply Filters");

	constructor(
		id: string,
		label: string
	) {
		super(id, label, 'apply-filters-action codicon filter');
	}

	public override async run(): Promise<void> {
		// Todo: apply filter to the account
	}
}

/**
 * Actions to refresh the account
 */
export class RefreshAccountAction extends Action {
	public static ID = 'account.refresh';
	public static LABEL = localize('refreshAccount', "Refresh your credentials");
	public account?: azdata.Account;

	constructor(
		@IAccountManagementService private _accountManagementService: IAccountManagementService,
		@ILogService private readonly logService: ILogService
	) {
		super(RefreshAccountAction.ID, RefreshAccountAction.LABEL, 'refresh-account-action codicon refresh');
	}
	public override async run(): Promise<void> {
		if (this.account) {
			try {
				await this._accountManagementService.refreshAccount(this.account);
			} catch (err) {
				this.logService.error(`Error while refreshing account: ${err}`);
			}
		} else {
			const errorMessage = localize('NoAccountToRefresh', "There is no account to refresh");
			throw new Error(errorMessage);
		}
	}
}
