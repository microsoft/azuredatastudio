/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import Severity from 'vs/base/common/severity';
import { localize } from 'vs/nls';

import { AutoOAuthDialog } from 'sql/workbench/services/accountManagement/browser/autoOAuthDialog';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';

export class AutoOAuthDialogController {
	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _autoOAuthDialog?: AutoOAuthDialog;
	private _providerId?: string;
	private _userCode?: string;
	private _uri?: string;

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IAccountManagementService private _accountManagementService: IAccountManagementService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService
	) { }

	/**
	 * Open auto OAuth dialog
	 */
	public openAutoOAuthDialog(providerId: string, title: string, message: string, userCode: string, uri: string): Promise<void> {
		if (this._providerId !== undefined) {
			// If a oauth flyout is already open, return an error
			const errorMessage = localize('oauthFlyoutIsAlreadyOpen', "Cannot start auto OAuth. An auto OAuth is already in progress.");
			this._errorMessageService.showDialog(Severity.Error, '', errorMessage);
			return Promise.reject(new Error('Auto OAuth dialog already open'));
		}

		// Create a new dialog if one doesn't exist
		if (!this._autoOAuthDialog) {
			this._autoOAuthDialog = this._instantiationService.createInstance(AutoOAuthDialog);
			this._autoOAuthDialog.onHandleAddAccount(this.handleOnAddAccount, this);
			this._autoOAuthDialog.onCancel(this.handleOnCancel, this);
			this._autoOAuthDialog.onCloseEvent(this.handleOnClose, this);
			this._autoOAuthDialog.render();
		}

		this._userCode = userCode;
		this._uri = uri;

		// Open the dialog
		this._autoOAuthDialog.open(title, message, userCode, uri);
		this._providerId = providerId;
		return Promise.resolve();
	}

	/**
	 * Close auto OAuth dialog
	 */
	public closeAutoOAuthDialog(): void {
		if (this._autoOAuthDialog) {
			this._autoOAuthDialog.close();
		}
		this._providerId = undefined;
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private handleOnCancel(): void {
		this._accountManagementService.cancelAutoOAuthDeviceCode(this._providerId!); // this should be always true
	}

	private handleOnClose(): void {
		this._providerId = undefined;
	}

	private async handleOnAddAccount(): Promise<void> {
		if (this._userCode && this._uri) {
			if (!this._accountManagementService.copyUserCodeAndOpenBrowser(this._userCode, this._uri)) {
				const selfHelpMessage = localize('selfHelpMessage', "A web browser cannot be launched in this environment, please launch a browser, navigate to the URL above and enter code manually.");
				// URI could not be opened, prompt user to open themselves
				this._autoOAuthDialog.hideCopyButton();
				this._autoOAuthDialog.updateSelfHelpMessage(selfHelpMessage);
			}
		} else {
			throw new Error('Missing user code and uri');
		}
	}
}
