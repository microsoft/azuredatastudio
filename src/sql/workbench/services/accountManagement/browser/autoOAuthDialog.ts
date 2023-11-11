/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/autoOAuthDialog';

import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Event, Emitter } from 'vs/base/common/event';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { localize } from 'vs/nls';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { $, append } from 'vs/base/browser/dom';

import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { defaultInputBoxStyles } from 'vs/platform/theme/browser/defaultStyles';

export class AutoOAuthDialog extends Modal {
	private _copyAndOpenButton?: Button;
	private _closeButton?: Button;
	private _userCodeInputBox?: InputBox;
	private _websiteInputBox?: InputBox;
	private _descriptionElement?: HTMLElement;
	private _selfHelpElement?: HTMLElement;

	// EVENTING ////////////////////////////////////////////////////////////
	private _onHandleAddAccount = new Emitter<void>();
	public get onHandleAddAccount(): Event<void> { return this._onHandleAddAccount.event; }

	private _onCancel = new Emitter<void>();
	public get onCancel(): Event<void> { return this._onCancel.event; }

	public hideCopyButton(): void {
		this._copyAndOpenButton.element.hidden = true;
	}

	public updateSelfHelpMessage(message: string): void {
		this._selfHelpElement.innerText = message;
	}

	private _onCloseEvent = new Emitter<void>();
	public get onCloseEvent(): Event<void> { return this._onCloseEvent.event; }

	constructor(
		@ILayoutService layoutService: ILayoutService,
		@IThemeService themeService: IThemeService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super(
			localize('deviceCodeAuthDialogTitle', 'Azure Auth: Device Code'),
			TelemetryKeys.ModalDialogName.AutoOAuth,
			telemetryService,
			layoutService,
			clipboardService,
			themeService,
			logService,
			textResourcePropertiesService,
			contextKeyService,
			{
				dialogStyle: 'normal',
				height: 340,
				hasSpinner: true
			}
		);
	}

	public override render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);
		this._copyAndOpenButton = this.addFooterButton(localize('copyAndOpen', "Copy & Open"), () => this.addAccount());
		this._closeButton = this.addFooterButton(localize('oauthDialog.cancel', "Cancel"), () => this.cancel(), 'right', true);
		this.registerListeners();
		this._userCodeInputBox!.disable();
		this._websiteInputBox!.disable();
	}

	protected layout(height?: number): void {
		// NO OP
	}

	protected renderBody(container: HTMLElement) {
		const body = append(container, $('.auto-oauth-dialog'));
		this._descriptionElement = append(body, $('.auto-oauth-description-section.new-section'));
		const addAccountSection = append(body, $('.auto-oauth-info-section.new-section'));
		this._userCodeInputBox = this.createInputBoxHelper(addAccountSection, localize('userCode', "User code"));
		this._websiteInputBox = this.createInputBoxHelper(addAccountSection, localize('website', "Website"));
		this._selfHelpElement = append(body, $('.auto-oauth-selfhelp-section.new-section'));
	}

	private createInputBoxHelper(container: HTMLElement, label: string): InputBox {
		const inputContainer = append(container, $('.dialog-input-section'));
		append(inputContainer, $('.dialog-label')).innerText = label;
		const inputCellContainer = append(inputContainer, $('.dialog-input'));

		return new InputBox(inputCellContainer, this._contextViewService, {
			ariaLabel: label,
			inputBoxStyles: defaultInputBoxStyles
		});
	}

	private registerListeners(): void {
		// Theme styler
		this._register(this._copyAndOpenButton!);
		this._register(this._closeButton!);

	}

	/* Overwrite escape key behavior */
	protected override onClose() {
		this.cancel();
	}

	/* Overwrite enter key behavior */
	protected override onAccept() {
		this.addAccount();
	}

	private addAccount() {
		if (this._copyAndOpenButton!.enabled) {
			this._copyAndOpenButton!.enabled = false;
			this.spinner = true;
			this._onHandleAddAccount.fire();
		}
	}

	public cancel() {
		this._onCancel.fire();
	}

	public close() {
		this._copyAndOpenButton!.enabled = true;
		this._onCloseEvent.fire();
		this.spinner = false;
		this.hide('close');
	}

	public open(title: string, message: string, userCode: string, uri: string) {
		// Update dialog
		this.title = title;
		this._descriptionElement!.innerText = message;
		this._userCodeInputBox!.value = userCode;
		this._websiteInputBox!.value = uri;
		this.show();
		this._copyAndOpenButton!.focus();
	}
}
