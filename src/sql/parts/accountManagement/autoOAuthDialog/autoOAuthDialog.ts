/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import 'vs/css!./media/autoOAuthDialog';
import { Builder, $ } from 'sql/base/browser/builder';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachInputBoxStyler } from 'vs/platform/theme/common/styler';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { Event, Emitter } from 'vs/base/common/event';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { localize } from 'vs/nls';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';

import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { attachModalDialogStyler, attachButtonStyler } from 'sql/platform/theme/common/styler';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';

export class AutoOAuthDialog extends Modal {
	private _copyAndOpenButton: Button;
	private _closeButton: Button;
	private _userCodeInputBox: InputBox;
	private _websiteInputBox: InputBox;
	private _descriptionElement: HTMLElement;

	// EVENTING ////////////////////////////////////////////////////////////
	private _onHandleAddAccount = new Emitter<void>();
	public get onHandleAddAccount(): Event<void> { return this._onHandleAddAccount.event; }

	private _onCancel = new Emitter<void>();
	public get onCancel(): Event<void> { return this._onCancel.event; }


	private _onCloseEvent = new Emitter<void>();
	public get onCloseEvent(): Event<void> { return this._onCloseEvent.event; }

	constructor(
		@IPartService partService: IPartService,
		@IThemeService themeService: IThemeService,
		@IContextViewService private _contextViewService: IContextViewService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService
	) {
		super(
			'',
			TelemetryKeys.AutoOAuth,
			partService,
			telemetryService,
			clipboardService,
			themeService,
			contextKeyService,
			{
				isFlyout: true,
				hasBackButton: true,
				hasSpinner: true
			}
		);
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);
		this.backButton.onDidClick(() => this.cancel());
		this._register(attachButtonStyler(this.backButton, this._themeService, { buttonBackground: SIDE_BAR_BACKGROUND, buttonHoverBackground: SIDE_BAR_BACKGROUND }));

		this._copyAndOpenButton = this.addFooterButton(localize('copyAndOpen', 'Copy & Open'), () => this.addAccount());
		this._closeButton = this.addFooterButton(localize('oauthDialog.cancel', 'Cancel'), () => this.cancel());
		this.registerListeners();
		this._userCodeInputBox.disable();
		this._websiteInputBox.disable();
	}

	protected layout(height?: number): void {
		// NO OP
	}

	protected renderBody(container: HTMLElement) {
		$().div({ class: 'auto-oauth-description-section new-section' }, (descriptionContainer) => {
			this._descriptionElement = descriptionContainer.getHTMLElement();
		});

		let addAccountSection;
		$().div({ class: 'auto-oauth-info-section  new-section' }, (addAccountContainer) => {
			addAccountSection = addAccountContainer.getHTMLElement();
			this._userCodeInputBox = this.createInputBoxHelper(addAccountContainer, localize('userCode', 'User code'));
			this._websiteInputBox = this.createInputBoxHelper(addAccountContainer, localize('website', 'Website'));
		});

		new Builder(container).div({ class: 'auto-oauth-dialog' }, (builder) => {
			builder.append(this._descriptionElement);
			builder.append(addAccountSection);
		});
	}

	private createInputBoxHelper(container: Builder, label: string): InputBox {
		let inputBox: InputBox;
		container.div({ class: 'dialog-input-section' }, (inputContainer) => {
			inputContainer.div({ class: 'dialog-label' }, (labelContainer) => {
				labelContainer.text(label);
			});

			inputContainer.div({ class: 'dialog-input' }, (inputCellContainer) => {
				inputBox = new InputBox(inputCellContainer.getHTMLElement(), this._contextViewService, {
					ariaLabel: label
				});
			});
		});
		return inputBox;
	}

	private registerListeners(): void {
		// Theme styler
		this._register(attachButtonStyler(this._copyAndOpenButton, this._themeService));
		this._register(attachButtonStyler(this._closeButton, this._themeService));
		this._register(attachInputBoxStyler(this._userCodeInputBox, this._themeService));
		this._register(attachInputBoxStyler(this._websiteInputBox, this._themeService));

	}

	/* Overwrite escape key behavior */
	protected onClose() {
		this.cancel();
	}

	/* Overwrite enter key behavior */
	protected onAccept() {
		this.addAccount();
	}

	private addAccount() {
		if (this._copyAndOpenButton.enabled) {
			this._copyAndOpenButton.enabled = false;
			this.showSpinner();
			this._onHandleAddAccount.fire();
		}
	}

	public cancel() {
		this._onCancel.fire();
	}

	public close() {
		this._copyAndOpenButton.enabled = true;
		this._onCloseEvent.fire();
		this.hideSpinner();
		this.hide();
	}

	public open(title: string, message: string, userCode: string, uri: string) {
		// Update dialog
		this.title = title;
		this._descriptionElement.innerText = message;
		this._userCodeInputBox.value = userCode;
		this._websiteInputBox.value = uri;
		this.show();
		this._copyAndOpenButton.focus();
	}
}
