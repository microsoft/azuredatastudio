/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/sqlConnection';

import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import * as DialogHelper from 'sql/workbench/browser/modal/dialogHelper';
import { IConnectionComponentCallbacks } from 'sql/workbench/services/connection/browser/connectionDialogService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ConnectionOptionSpecialType } from 'sql/workbench/api/common/sqlExtHostTypes';
import * as styler from 'sql/platform/theme/common/styler';

import * as azdata from 'azdata';

import * as lifecycle from 'vs/base/common/lifecycle';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { ILogService } from 'vs/platform/log/common/log';

export enum AuthenticationType {
	SqlLogin = 'SqlLogin',
	Integrated = 'Integrated',
	AzureMFA = 'AzureMFA',
	AzureMFAAndUser = 'AzureMFAAndUser',
	dSTSAuth = 'dstsAuth',
	None = 'None' // Kusto supports no authentication
}

export class PasswordResetWidget extends lifecycle.Disposable {
	private _userNameInputBox: InputBox;
	private _newPasswordInputBox: InputBox;
	private _confirmPasswordInputBox: InputBox;
	private _callbacks: IConnectionComponentCallbacks;
	protected _container: HTMLElement;
	protected _optionsMaps: { [optionType: number]: azdata.ConnectionOption };

	constructor(options: azdata.ConnectionOption[],
		callbacks: IConnectionComponentCallbacks,
		@IThemeService protected _themeService: IThemeService,
		@IContextViewService protected _contextViewService: IContextViewService,
		@ILogService protected _logService: ILogService,
	) {
		super();
		this._callbacks = callbacks;
		this._optionsMaps = {};
		for (let i = 0; i < options.length; i++) {
			let option = options[i];
			this._optionsMaps[option.specialValueType] = option;
		}
	}

	public activatePasswordResetDialog(): void {
		this._callbacks.onPasswordChange();
	}

	public createPasswordResetWidget(container: HTMLElement): void {
		this._container = DOM.append(container, DOM.$('div.connection-table'));
		this.addLoginOptions();
		this.registerListeners();
	}

	protected addLoginOptions(): void {
		// Username
		let self = this;
		let userNameOption = this._optionsMaps[ConnectionOptionSpecialType.userName];
		let userName = DialogHelper.appendRow(this._container, userNameOption.displayName, 'connection-label', 'connection-input', 'username-row', userNameOption.isRequired);
		this._userNameInputBox = new InputBox(userName, this._contextViewService, {
			validationOptions: {
				validation: (value: string) => self.validateUsername(value, userNameOption.isRequired) ? ({ type: MessageType.ERROR, content: localize('connectionWidget.missingRequireField', "{0} is required.", userNameOption.displayName) }) : null
			},
			ariaLabel: userNameOption.displayName
		});
		this._register(this._userNameInputBox);
		this._userNameInputBox.disable();
		// Password
		let passwordOption = this._optionsMaps[ConnectionOptionSpecialType.password];
		let newPassword = DialogHelper.appendRow(this._container, passwordOption.displayName, 'connection-label', 'connection-input', 'new-password-row');
		this._newPasswordInputBox = new InputBox(newPassword, this._contextViewService, { ariaLabel: passwordOption.displayName });
		this._newPasswordInputBox.inputElement.type = 'password';
		this._register(this._newPasswordInputBox);
		let confirmPassword = DialogHelper.appendRow(this._container, passwordOption.displayName, 'connection-label', 'connection-input', 'confirm-password-row');
		this._confirmPasswordInputBox = new InputBox(confirmPassword, this._contextViewService, { ariaLabel: passwordOption.displayName });
		this._confirmPasswordInputBox.inputElement.type = 'password';
		this._register(this._confirmPasswordInputBox);
	}

	private validateUsername(value: string, isOptionRequired: boolean): boolean {
		if (!value && isOptionRequired) {
			return true;
		}
		return false;
	}

	protected registerListeners(): void {
		// Theme styler
		this._register(styler.attachInputBoxStyler(this._userNameInputBox, this._themeService));
		this._register(styler.attachInputBoxStyler(this._newPasswordInputBox, this._themeService));
		this._register(styler.attachInputBoxStyler(this._confirmPasswordInputBox, this._themeService));
	}


	public initDialog(connectionInfo: IConnectionProfile): void {
		this.fillInConnectionInputs(connectionInfo);
	}

	public focusOnOpen(): void {
		this.focusPasswordIfNeeded();
		this.clearValidationMessages();
	}

	private clearValidationMessages(): void {
		this._userNameInputBox.hideMessage();
	}

	private getModelValue(value: string): string {
		return value ? value : '';
	}

	public fillInConnectionInputs(connectionInfo: IConnectionProfile) {
		if (connectionInfo) {
			this._userNameInputBox.value = this.getModelValue(connectionInfo.userName);
			this.focusPasswordIfNeeded();
		}
	}

	public get userName(): string {
		return this._userNameInputBox.value;
	}

	public get password(): string {
		return this._newPasswordInputBox.value;
	}

	private validateInputs(): boolean {

		let isFocused = false;
		const isUserNameValid = this._userNameInputBox.validate() === undefined;
		if (!isUserNameValid && !isFocused) {
			this._userNameInputBox.focus();
			isFocused = true;
		}
		const isPasswordValid = this._newPasswordInputBox.validate() === undefined;
		if (!isPasswordValid && !isFocused) {
			this._newPasswordInputBox.focus();
			isFocused = true;
		}

		const isPasswordConfirmed = this._newPasswordInputBox.value === this._confirmPasswordInputBox.value;

		return isUserNameValid && isPasswordValid && isPasswordConfirmed;
	}

	public async changePasswordForModel(model: IConnectionProfile): Promise<boolean> {
		let validInputs = this.validateInputs();
		if (validInputs) {
			model.userName = this.userName;
			model.password = this.password;
		}
		return validInputs;
	}


	private focusPasswordIfNeeded(): void {
		if (this.userName && !this.password) {
			this._newPasswordInputBox.focus();
		}
	}
}
