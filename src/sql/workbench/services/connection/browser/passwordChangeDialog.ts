/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button } from 'sql/base/browser/ui/button/button';
import { MessageLevel, Modal } from 'sql/workbench/browser/modal/modal';
//import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { attachInputBoxStyler, attachCheckboxStyler } from 'sql/platform/theme/common/styler';
import { INewConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import * as DOM from 'vs/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';


const OkText: string = localize('passwordChangeDialog.ok', "OK");
const CancelText: string = localize('passwordChangeDialog.cancel', "Cancel");
const DialogTitle: string = localize('passwordChangeDialog.title', "Change Password");
const TitleIconClass: string = 'icon filterLabel';

export class PasswordChangeDialog extends Modal {

	private _okButton?: Button;
	private _cancelButton?: Button;
	private _profile: IConnectionProfile;
	private _params: INewConnectionParams;
	private _uri: string;
	private _passwordValueText: InputBox;
	private _confirmValueText: InputBox;
	private _connectOnClose: Checkbox;


	constructor(
		@IThemeService themeService: IThemeService,
		@IClipboardService clipboardService: IClipboardService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService logService: ILogService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IConnectionDialogService private connectionDialogService: IConnectionDialogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super('', '', telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { dialogStyle: 'normal', hasTitleIcon: true, hasErrors: true });
	}

	public open(profile: IConnectionProfile, params: INewConnectionParams, uri: string) {
		this._profile = profile;
		this._params = params;
		this._uri = uri;
		this.render();
		this.show();
		this._okButton!.focus();
	}

	public override dispose(): void {

	}

	public override render() {
		super.render();
		this.title = DialogTitle;
		this.titleIconClassName = TitleIconClass;
		this._register(attachModalDialogStyler(this, this._themeService));
		this._okButton = this.addFooterButton(OkText, () => this.handleOkButtonClick());
		this._cancelButton = this.addFooterButton(CancelText, () => this.hide('cancel'), 'right', true);
		this._register(attachButtonStyler(this._okButton, this._themeService));
		this._register(attachButtonStyler(this._cancelButton, this._themeService));
	}

	protected renderBody(container: HTMLElement) {
		const body = DOM.append(container, DOM.$('.change-password-dialog'));
		const passwordRow = DOM.append(body, DOM.$('tr'));
		DOM.append(passwordRow, DOM.$('td')).innerText = 'new password:';
		this._passwordValueText = new InputBox(DOM.append(passwordRow, DOM.$('td')), this.contextViewService, {});
		this._passwordValueText.inputElement.type = 'password';
		this._register(attachInputBoxStyler(this._passwordValueText, this._themeService));

		const confirmPasswordRow = DOM.append(body, DOM.$('tr'));
		DOM.append(confirmPasswordRow, DOM.$('td')).innerText = 'confirm password:';
		this._confirmValueText = new InputBox(DOM.append(confirmPasswordRow, DOM.$('td')), this.contextViewService, {});
		this._confirmValueText.inputElement.type = 'password';
		this._register(attachInputBoxStyler(this._confirmValueText, this._themeService));

		const saveAndCloseCheckboxRow = DOM.append(body, DOM.$('tr'));
		DOM.append(saveAndCloseCheckboxRow, DOM.$('td')).innerText = 'Connect?';
		this._connectOnClose = new Checkbox(DOM.append(saveAndCloseCheckboxRow, DOM.$('td')), { label: 'Connect upon close and save if needed' });
		this._register(attachCheckboxStyler(this._connectOnClose, this._themeService));
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
		//TODO - verify password here before continuing.
		if (this._passwordValueText.value === this._confirmValueText.value) {
			this.connectionDialogService.changePasswordFunction(this._profile, this._params, this._uri, this._passwordValueText.value, this._connectOnClose.checked).then(() => {
				this.hide('ok');
			});
		}
		else {
			this.setError(`Mismatching password entered`, MessageLevel.Warning, 'The passwords entered do not match, please enter the same password for both input boxes.');
		}
	}
}
