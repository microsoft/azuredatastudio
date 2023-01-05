/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/passwordDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { attachInputBoxStyler } from 'sql/platform/theme/common/styler';
import { INewConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import * as DOM from 'vs/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import Severity from 'vs/base/common/severity';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';

const dialogWidth: string = '300px'; // Width is set manually here as there is no default width for normal dialogs.
const okText: string = localize('passwordChangeDialog.ok', "OK");
const cancelText: string = localize('passwordChangeDialog.cancel', "Cancel");
const dialogTitle: string = localize('passwordChangeDialog.title', "Change Password");
const newPasswordText: string = localize('passwordChangeDialog.newPassword', 'New password:');
const confirmPasswordText: string = localize('passwordChangeDialog.confirmPassword', 'Confirm password:');
const passwordChangeLoadText: string = localize('passwordChangeDialog.connecting', "Connecting");
const errorHeader: string = localize('passwordChangeDialog.errorHeader', "Failure when attempting to change password");
const errorPasswordMismatchErrorMessage = localize('passwordChangeDialog.errorPasswordMismatchErrorMessage', "Passwords entered do not match");
const errorPasswordMismatchRecoveryInstructions = localize('passwordChangeDialog.errorPasswordMismatchRecoveryInstructions', "Press OK and enter the exact same password in both boxes.");

export class PasswordChangeDialog extends Modal {

	private _okButton?: Button;
	private _cancelButton?: Button;
	private _profile: IConnectionProfile;
	private _params: INewConnectionParams;
	private _uri: string;
	private _passwordValueText: InputBox;
	private _confirmValueText: InputBox;

	constructor(
		@IThemeService themeService: IThemeService,
		@IClipboardService clipboardService: IClipboardService,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@IErrorMessageService private readonly errorMessageService: IErrorMessageService,
		@IConnectionDialogService private readonly connectionDialogService: IConnectionDialogService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService logService: ILogService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
	) {
		super('', '', telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { hasSpinner: true, spinnerTitle: passwordChangeLoadText, dialogStyle: 'normal', width: dialogWidth, dialogPosition: 'left' });
	}

	public open(profile: IConnectionProfile, params: INewConnectionParams) {
		this._profile = profile;
		this._params = params;
		this._uri = this.connectionManagementService.getConnectionUri(profile);
		this.render();
		this.show();
		this._okButton!.focus();
	}

	public override dispose(): void {

	}

	public override render() {
		super.render();
		this.title = dialogTitle;
		this._register(attachModalDialogStyler(this, this._themeService));
		this._okButton = this.addFooterButton(okText, () => this.handleOkButtonClick());
		this._cancelButton = this.addFooterButton(cancelText, () => this.hide('cancel'), 'right', true);
		this._register(attachButtonStyler(this._okButton, this._themeService));
		this._register(attachButtonStyler(this._cancelButton, this._themeService));
	}

	protected renderBody(container: HTMLElement) {
		const body = container.appendChild(DOM.$('.change-password-dialog'));
		const contentElement = body.appendChild(DOM.$('.properties-content.components-grid'));
		contentElement.appendChild(DOM.$('')).appendChild(DOM.$('span.component-label')).innerText = newPasswordText;
		const passwordInputContainer = contentElement.appendChild(DOM.$(''));
		this._passwordValueText = new InputBox(passwordInputContainer, this.contextViewService, { type: 'password' });
		this._register(attachInputBoxStyler(this._passwordValueText, this._themeService));

		contentElement.appendChild(DOM.$('')).appendChild(DOM.$('span.component-label')).innerText = confirmPasswordText;
		const confirmInputContainer = contentElement.appendChild(DOM.$(''));
		this._confirmValueText = new InputBox(confirmInputContainer, this.contextViewService, { type: 'password' });
		this._register(attachInputBoxStyler(this._confirmValueText, this._themeService));
	}

	protected layout(height?: number): void {
		// Nothing to re-layout
	}

	/* espace key */
	protected override onClose() {
		this.hide('close');
	}

	/* enter key */
	protected override onAccept() {
		this.handleOkButtonClick();
	}

	private handleOkButtonClick(): void {
		this._okButton.enabled = false;
		this._cancelButton.enabled = false;
		this.spinner = true;
		this.changePasswordFunction(this._profile, this._params, this._uri, this._passwordValueText.value, this._confirmValueText.value).then(
			() => {
				this.hide('ok'); /* password changed successfully */
			},
			() => {
				this._okButton.enabled = true; /* ignore, user must try again */
				this._cancelButton.enabled = true;
				this.spinner = false;
			}
		);
	}

	private async changePasswordFunction(connection: IConnectionProfile, params: INewConnectionParams, uri: string, oldPassword: string, newPassword: string): Promise<void> {
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
		connection.options['password'] = newPassword;
		await this.connectionDialogService.callDefaultOnConnect(connection, params);
	}
}
