/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Severity from 'vs/base/common/severity';
import { AccountDialog } from 'sql/workbench/services/accountManagement/browser/accountDialog';
import { localize } from 'vs/nls';
import { Event } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';

export class AccountDialogController {

	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _addAccountErrorTitle = localize('accountDialog.addAccountErrorTitle', "Error adding account");

	private _accountDialog?: AccountDialog;
	public get accountDialog(): AccountDialog | undefined { return this._accountDialog; }

	constructor(
		private _providerRegisteredEvent: Event<void>,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService
	) { }

	/**
	 * Open account dialog
	 */
	public openAccountDialog(): void {
		// Create a new dialog if one doesn't exist
		if (!this._accountDialog) {
			this._providerRegisteredEvent(() => {
				this._errorMessageService.showDialog(Severity.Info, 'AccountProviderMessage', 'receiving AccountProvider event in accountDialogController');
			});
			this._accountDialog = this._instantiationService.createInstance(AccountDialog);
			this._accountDialog.onAddAccountErrorEvent(msg => this.handleOnAddAccountError(msg));
			this._accountDialog.onCloseEvent(() => this.handleOnClose());
			this._accountDialog.render();
		}

		// Open the dialog
		this._accountDialog.open();
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private handleOnClose(): void { }

	private handleOnAddAccountError(msg: string): void {
		this._errorMessageService.showDialog(Severity.Error, this._addAccountErrorTitle, msg);
	}
}
