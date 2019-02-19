/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/dialogModal';
import { Modal, IModalOptions } from 'sql/workbench/browser/modal/modal';
import { attachModalDialogStyler } from 'sql/platform/theme/common/styler';
import { Dialog, DialogButton } from 'sql/platform/dialog/dialogTypes';
import { DialogPane } from 'sql/platform/dialog/dialogPane';

import { Builder } from 'sql/base/browser/builder';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { Button } from 'vs/base/browser/ui/button/button';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { localize } from 'vs/nls';
import { Emitter } from 'vs/base/common/event';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { DialogMessage, MessageLevel } from '../../workbench/api/common/sqlExtHostTypes';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';

export class DialogModal extends Modal {
	private _dialogPane: DialogPane;
	private _onDone = new Emitter<void>();
	private _onCancel = new Emitter<void>();

	// Buttons
	private _cancelButton: Button;
	private _doneButton: Button;

	constructor(
		private _dialog: Dialog,
		name: string,
		options: IModalOptions,
		@IPartService partService: IPartService,
		@IWorkbenchThemeService themeService: IWorkbenchThemeService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super(_dialog.title, name, partService, telemetryService, clipboardService, themeService, contextKeyService, options);
	}

	public layout(): void {
		this._dialogPane.layout();
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);

		if (this.backButton) {
			this.backButton.onDidClick(() => this.cancel());
			attachButtonStyler(this.backButton, this._themeService, { buttonBackground: SIDE_BAR_BACKGROUND, buttonHoverBackground: SIDE_BAR_BACKGROUND });
		}

		if (this._dialog.customButtons) {
			this._dialog.customButtons.forEach(button => {
				let buttonElement = this.addDialogButton(button);
				this.updateButtonElement(buttonElement, button);
			});
		}

		this._doneButton = this.addDialogButton(this._dialog.okButton, () => this.done(), false, true);
		this._dialog.okButton.registerClickEvent(this._onDone.event);
		this._dialog.onValidityChanged(valid => {
			this._doneButton.enabled = valid && this._dialog.okButton.enabled;
		});
		this._cancelButton = this.addDialogButton(this._dialog.cancelButton, () => this.cancel(), false);
		this._dialog.cancelButton.registerClickEvent(this._onCancel.event);

		let messageChangeHandler = (message: DialogMessage) => {
			if (message && message.text) {
				this.setError(message.text, message.level, message.description);
			} else {
				this.setError('');
			}
		};

		messageChangeHandler(this._dialog.message);
		this._dialog.onMessageChange(message => messageChangeHandler(message));
	}

	private addDialogButton(button: DialogButton, onSelect: () => void = () => undefined, registerClickEvent: boolean = true, requireDialogValid: boolean = false): Button {
		let buttonElement = this.addFooterButton(button.label, onSelect);
		buttonElement.enabled = button.enabled;
		if (registerClickEvent) {
			button.registerClickEvent(buttonElement.onDidClick);
		}
		button.onUpdate(() => {
			this.updateButtonElement(buttonElement, button, requireDialogValid);
		});
		attachButtonStyler(buttonElement, this._themeService);
		this.updateButtonElement(buttonElement, button, requireDialogValid);
		return buttonElement;
	}

	private updateButtonElement(buttonElement: Button, dialogButton: DialogButton, requireDialogValid: boolean = false) {
		buttonElement.label = dialogButton.label;
		buttonElement.enabled = requireDialogValid ? dialogButton.enabled && this._dialog.valid : dialogButton.enabled;
		dialogButton.hidden ? buttonElement.element.parentElement.classList.add('dialogModal-hidden') : buttonElement.element.parentElement.classList.remove('dialogModal-hidden');
	}

	protected renderBody(container: HTMLElement): void {
		let body: HTMLElement;
		new Builder(container).div({ class: 'dialogModal-body' }, (bodyBuilder) => {
			body = bodyBuilder.getHTMLElement();
		});

		this._dialogPane = new DialogPane(this._dialog.title, this._dialog.content,
			valid => this._dialog.notifyValidityChanged(valid), this._instantiationService, false);
		this._dialogPane.createBody(body);
	}

	public open(): void {
		this.show();
	}

	public async done(): Promise<void> {
		if (this._doneButton.enabled) {
			let buttonSpinnerHandler = setTimeout(() => {
				this._doneButton.enabled = false;
				this._doneButton.element.innerHTML = '&nbsp';
				this._doneButton.element.classList.add('validating');
			}, 100);
			if (await this._dialog.validateClose()) {
				this._onDone.fire();
				this.dispose();
				this.hide();
			}
			clearTimeout(buttonSpinnerHandler);
			this._doneButton.element.classList.remove('validating');
			this.updateButtonElement(this._doneButton, this._dialog.okButton, true);
		}
	}

	public cancel(): void {
		this._onCancel.fire();
		this.dispose();
		this.hide();
	}

	protected hide(): void {
		super.hide();
	}

	protected show(): void {
		super.show();
	}

	/**
	 * Overridable to change behavior of escape key
	 */
	protected onClose(e: StandardKeyboardEvent) {
		this.cancel();
	}

	/**
	 * Overridable to change behavior of enter key
	 */
	protected onAccept(e: StandardKeyboardEvent) {
		this.done();
	}

	public dispose(): void {
		super.dispose();
		this._dialogPane.dispose();
	}
}
