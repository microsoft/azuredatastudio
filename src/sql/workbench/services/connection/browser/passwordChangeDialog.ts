/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/passwordDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import * as DOM from 'vs/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import Severity from 'vs/base/common/severity';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { defaultInputBoxStyles } from 'vs/platform/theme/browser/defaultStyles';

const dialogWidth: string = '500px'; // Width is set manually here as there is no default width for normal dialogs.
const okText: string = localize('passwordChangeDialog.ok', "OK");
const cancelText: string = localize('passwordChangeDialog.cancel', "Cancel");
const newPasswordText: string = localize('passwordChangeDialog.newPassword', "New password:");
const confirmPasswordText: string = localize('passwordChangeDialog.confirmPassword', "Confirm password:");
const passwordChangeLoadText: string = localize('passwordChangeDialog.connecting', "Connecting");
const errorHeader: string = localize('passwordChangeDialog.errorHeader', "Failure when attempting to change password");
const errorPasswordMismatchErrorMessage = localize('passwordChangeDialog.errorPasswordMismatchErrorMessage', "Passwords entered do not match");
const errorPasswordMismatchRecoveryInstructions = localize('passwordChangeDialog.errorPasswordMismatchRecoveryInstructions', "Press OK and enter the exact same password in both boxes.");

export class PasswordChangeDialog extends Modal {

	private _okButton?: Button;
	private _cancelButton?: Button;
	private _promiseResolver: (value: string) => void;
	private _profile: IConnectionProfile;
	private _uri: string;
	private _passwordValueText: InputBox;
	private _confirmValueText: InputBox;

	constructor(
		@IThemeService themeService: IThemeService,
		@IClipboardService clipboardService: IClipboardService,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@IErrorMessageService private readonly errorMessageService: IErrorMessageService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService logService: ILogService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
	) {
		super('', '', telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { hasSpinner: true, spinnerTitle: passwordChangeLoadText, dialogStyle: 'normal', width: dialogWidth, dialogPosition: 'left', height: 350 });
	}

	public open(profile: IConnectionProfile): Promise<string> {
		if (this._profile) {
			// If already in the middle of a password change, reject an incoming open.
			let message = localize('passwordChangeDialog.passwordChangeInProgress', "Password change already in progress")
			this.errorMessageService.showDialog(Severity.Error, errorHeader, message);
			return Promise.reject(new Error(message));
		}
		this._profile = profile;
		this._uri = this.connectionManagementService.getConnectionUri(profile);
		this.render();
		this.show();
		this._okButton!.focus();
		const promise = new Promise<string | undefined>((resolve) => {
			this._promiseResolver = resolve;
		});
		return promise;
	}

	public override dispose(): void { }

	public override render() {
		super.render();
		this.title = localize('passwordChangeDialog.title', 'Change Password');
		this._register(attachModalDialogStyler(this, this._themeService));
		this._okButton = this.addFooterButton(okText, async () => { await this.handleOkButtonClick(); });
		this._cancelButton = this.addFooterButton(cancelText, () => { this.handleCancelButtonClick(); }, 'right', true);
	}

	protected renderBody(container: HTMLElement) {
		const body = container.appendChild(DOM.$('.change-password-dialog'));
		body.appendChild(DOM.$('span.component-label-bold')).innerText = localize('passwordChangeDialog.Message1',
			`Password must be changed for '{0}' to continue logging into '{1}'.`, this._profile?.userName, this._profile?.serverName);
		body.appendChild(DOM.$('span.component-label')).innerText = localize('passwordChangeDialog.Message2',
			`Please enter a new password below:`);

		const contentElement = body.appendChild(DOM.$('.properties-content.components-grid'));
		contentElement.appendChild(DOM.$('')).appendChild(DOM.$('span.component-label')).innerText = newPasswordText;
		const passwordInputContainer = contentElement.appendChild(DOM.$(''));
		this._passwordValueText = new InputBox(passwordInputContainer, this.contextViewService, {
			type: 'password',
			inputBoxStyles: defaultInputBoxStyles
		});

		contentElement.appendChild(DOM.$('')).appendChild(DOM.$('span.component-label')).innerText = confirmPasswordText;
		const confirmInputContainer = contentElement.appendChild(DOM.$(''));
		this._confirmValueText = new InputBox(confirmInputContainer, this.contextViewService, {
			type: 'password',
			inputBoxStyles: defaultInputBoxStyles
		});
	}

	protected layout(height?: number): void {
		// Nothing to re-layout
	}

	/* espace key */
	protected override onClose() {
		this.handleCancelButtonClick();
	}

	/* enter key */
	protected override async onAccept() {
		await this.handleOkButtonClick();
	}

	private async handleOkButtonClick(): Promise<void> {
		this._okButton.enabled = false;
		this._cancelButton.enabled = false;
		this.spinner = true;
		try {
			let result = await this.changePasswordFunction(this._profile, this._uri, this._passwordValueText.value, this._confirmValueText.value);
			this.hide('ok'); /* password changed successfully */
			this._promiseResolver(result);
		}
		catch {
			// Error encountered, keep the dialog open and reset dialog back to previous state.
			this._okButton.enabled = true; /* ignore, user must try again */
			this._cancelButton.enabled = true;
			this.spinner = false;
		}

	}

	private handleCancelButtonClick(): void {
		this.hide('cancel');
		this._promiseResolver(undefined);
	}

	private async changePasswordFunction(connection: IConnectionProfile, uri: string, oldPassword: string, newPassword: string): Promise<string> {
		// Verify passwords match before changing the password.
		if (oldPassword !== newPassword) {
			this.errorMessageService.showDialog(Severity.Error, errorHeader, errorPasswordMismatchErrorMessage + '\n\n' + errorPasswordMismatchRecoveryInstructions);
			return Promise.reject(new Error(errorPasswordMismatchErrorMessage));
		}

		let passwordChangeResult = await this.connectionManagementService.changePassword(connection, uri, newPassword);
		if (!passwordChangeResult.result) {
			this.errorMessageService.showDialog(Severity.Error, errorHeader, passwordChangeResult.errorMessage);
			return Promise.reject(new Error(passwordChangeResult.errorMessage));
		}

		return newPassword;
	}
}
