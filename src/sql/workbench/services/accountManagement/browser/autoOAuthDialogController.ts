/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import Severity from 'vs/base/common/severity';
import { localize } from 'vs/nls';

import { AutoOAuthDialog } from 'sql/workbench/services/accountManagement/browser/autoOAuthDialog';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';

export class AutoOAuthDialogController {
	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _autoOAuthDialog: AutoOAuthDialog;
	private _providerId?: string;
	private _userCode: string;
	private _uri: string;

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IAccountManagementService private _accountManagementService: IAccountManagementService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService
	) { }

	/**
	 * Open auto OAuth dialog
	 */
	public openAutoOAuthDialog(providerId: string, title: string, message: string, userCode: string, uri: string): Thenable<void> {
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
		this._autoOAuthDialog.close();
		this._providerId = undefined;
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private handleOnCancel(): void {
		this._accountManagementService.cancelAutoOAuthDeviceCode(this._providerId!); // this should be always true
	}

	private handleOnClose(): void {
		this._providerId = undefined;
	}

	private handleOnAddAccount(): void {
		this._accountManagementService.copyUserCodeAndOpenBrowser(this._userCode, this._uri);
	}
}
