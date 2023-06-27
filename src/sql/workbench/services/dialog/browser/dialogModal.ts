/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/dialogModal';
import { Modal, IModalOptions, HideReason } from 'sql/workbench/browser/modal/modal';
import { Dialog, DialogButton } from 'sql/workbench/services/dialog/common/dialogTypes';
import { DialogPane } from 'sql/workbench/services/dialog/browser/dialogPane';

import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { Button } from 'vs/base/browser/ui/button/button';
import { Emitter } from 'vs/base/common/event';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { DialogMessage } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { append, $ } from 'vs/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { onUnexpectedError } from 'vs/base/common/errors';
import { attachCustomDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';

export class DialogModal extends Modal {
	private _dialogPane: DialogPane;
	private _onDone = new Emitter<void>();
	private _onCancel = new Emitter<void>();

	// Buttons
	private _doneButton: Button;

	constructor(
		private _dialog: Dialog,
		name: string,
		options: IModalOptions,
		@ILayoutService layoutService: ILayoutService,
		@IWorkbenchThemeService themeService: IWorkbenchThemeService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super(_dialog.title, name, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, options);
	}

	protected layout(): void {
		this._dialogPane.layout();
	}

	public override render() {
		super.render();
		attachCustomDialogStyler(this, this._themeService, this._modalOptions.dialogStyle);

		if (this._modalOptions.renderFooter !== false) {
			this._modalOptions.renderFooter = true;
		}

		if (this._modalOptions.renderFooter && this.backButton) {
			this.backButton.onDidClick(() => this.cancel());
		}

		if (this._modalOptions.renderFooter && this._dialog.customButtons) {
			this._dialog.customButtons.forEach(button => {
				let buttonElement = this.addDialogButton(button);
				this.updateButtonElement(buttonElement, button);
			});
		}

		if (this._modalOptions.renderFooter) {
			this._doneButton = this.addDialogButton(this._dialog.okButton, () => this.done(), false, true);
			this._dialog.okButton.registerClickEvent(this._onDone.event);
			this._dialog.onValidityChanged(valid => {
				this._doneButton.enabled = valid && this._dialog.okButton.enabled;
			});
			this.addDialogButton(this._dialog.cancelButton, () => this.cancel(), false);
			this._dialog.cancelButton.registerClickEvent(this._onCancel.event);
		}

		let messageChangeHandler = (message: DialogMessage) => {
			if (message && message.text) {
				this.setError(message.text, message.level, message.description);
			} else {
				this.setError('');
			}
		};

		messageChangeHandler(this._dialog.message);
		this._register(this._dialog.onMessageChange(message => messageChangeHandler(message)));
		this._register(this._dialog.onLoadingChange((loadingState) => {
			this.spinner = loadingState;
		}));
		this._register(this._dialog.onLoadingTextChange((loadingText) => {
			this._modalOptions.spinnerTitle = loadingText;

		}));
		this._register(this._dialog.onLoadingCompletedTextChange((loadingCompletedText) => {
			this._modalOptions.onSpinnerHideText = loadingCompletedText;
		}));
	}

	private addDialogButton(button: DialogButton, onSelect: () => void = () => undefined, registerClickEvent: boolean = true, requireDialogValid: boolean = false): Button {
		let buttonElement = this.addFooterButton(button.label, onSelect, button.position, button.secondary);
		buttonElement.enabled = button.enabled;
		if (registerClickEvent) {
			button.registerClickEvent(buttonElement.onDidClick);
		}
		button.onUpdate(() => {
			this.updateButtonElement(buttonElement, button, requireDialogValid);
		});
		this.updateButtonElement(buttonElement, button, requireDialogValid);
		return buttonElement;
	}

	private updateButtonElement(buttonElement: Button, dialogButton: DialogButton, requireDialogValid: boolean = false) {
		buttonElement.label = dialogButton.label;
		buttonElement.enabled = requireDialogValid ? dialogButton.enabled && this._dialog.valid : dialogButton.enabled;
		dialogButton.hidden ? buttonElement.element.parentElement.classList.add('dialogModal-hidden') : buttonElement.element.parentElement.classList.remove('dialogModal-hidden');
	}

	protected renderBody(container: HTMLElement): void {
		const body = append(container, $('div.dialogModal-body'));

		this._dialogPane = new DialogPane(this._dialog.title, this._dialog.content,
			valid => this._dialog.notifyValidityChanged(valid), this._instantiationService, this._themeService, false);
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
				this.hide('ok');
			}
			clearTimeout(buttonSpinnerHandler);
			this._doneButton.element.classList.remove('validating');
			this.updateButtonElement(this._doneButton, this._dialog.okButton, true);
		}
	}

	public close(): void {
		this.cancel('close');
	}

	public cancel(hideReason: HideReason = 'cancel'): void {
		this._onCancel.fire();
		this.dispose();
		this.hide(hideReason);
	}

	/**
	 * Overridable to change behavior of escape key
	 */
	protected override onClose(e: StandardKeyboardEvent): void {
		this.cancel();
	}

	/**
	 * Overridable to change behavior of enter key
	 */
	protected override onAccept(e: StandardKeyboardEvent): void {
		this.done().catch(err => onUnexpectedError(err));
	}

	public override dispose(): void {
		super.dispose();
		this._dialogPane.dispose();
	}
}
