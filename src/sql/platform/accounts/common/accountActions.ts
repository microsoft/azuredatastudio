/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
import { IAuthenticationService } from 'vs/workbench/services/authentication/common/authentication';

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

		this._addAccountCompleteEmitter = this._register(new Emitter<void>());
		this._addAccountErrorEmitter = this._register(new Emitter<string>());
		this._addAccountStartEmitter = this._register(new Emitter<void>());
	}

	public override async run(): Promise<void> {

		// Fire the event that we've started adding accounts
		this._addAccountStartEmitter.fire();
		try {
			if (!this._providerId) {
				let providerId = await this._accountManagementService.promptProvider();
				await this._accountManagementService.addAccount(providerId);
			} else {
				await this._accountManagementService.addAccount(this._providerId);
			}
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
			cancelButton: localize('accountActions.no', "No"),
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

/**
 * Action to sign out of GitHub Copilot account
 */
export class GitHubCopilotSignOutAction extends Action {
	public static ID = 'account.github.copilot.sign.out';
	public static LABEL = localize('githubCopilotSignOut', "Sign out of GitHub Copilot");

	constructor(
		private _account: azdata.Account,
		@IAccountManagementService private readonly _accountManagementService: IAccountManagementService,
		@IAuthenticationService private readonly authenticationService: IAuthenticationService
	) {
		super(GitHubCopilotSignOutAction.ID, GitHubCopilotSignOutAction.LABEL, 'remove-account-action codicon remove');
	}

	public override async run(): Promise<void> {
		this.authenticationService.onDidChangeSessions(async () => {
			await this._accountManagementService.updateAccountListAuthSessions(this._account);
		});

		const providerId = this._account.key.providerId;
		const allSessions = await this.authenticationService.getSessions(providerId);
		const sessionsForAccount = allSessions.filter(s => s.account.label === this._account.displayInfo.userId);
		await this.authenticationService.removeAccountSessions(providerId, this._account.displayInfo.userId, sessionsForAccount);
	}
}
