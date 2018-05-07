/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/dialogModal';
import { Modal, IModalOptions } from 'sql/base/browser/ui/modal/modal';
import { attachModalDialogStyler } from 'sql/common/theme/styler';
import { Dialog, DialogButton } from 'sql/platform/dialog/dialogTypes';
import { DialogPane } from 'sql/platform/dialog/dialogPane';
import { IBootstrapService } from 'sql/services/bootstrap/bootstrapService';
import { Builder } from 'vs/base/browser/builder';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { Button } from 'vs/base/browser/ui/button/button';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { localize } from 'vs/nls';
import Event, { Emitter } from 'vs/base/common/event';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';

export class DialogModal extends Modal {
	private _dialogPane: DialogPane;

	// Wizard HTML elements
	private _body: HTMLElement;

	// Buttons
	private _cancelButton: Button;
	private _doneButton: Button;

	constructor(
		private _dialog: Dialog,
		name: string,
		options: IModalOptions,
		@IPartService partService: IPartService,
		@IWorkbenchThemeService private _themeService: IWorkbenchThemeService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IBootstrapService private _bootstrapService: IBootstrapService
	) {
		super(_dialog.title, name, partService, telemetryService, contextKeyService, options);
	}

	public layout(): void {

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

		this._cancelButton = this.addDialogButton(this._dialog.cancelButton, () => this.cancel());
		this.updateButtonElement(this._cancelButton, this._dialog.cancelButton);
		this._doneButton = this.addDialogButton(this._dialog.okButton, () => this.done());
		this.updateButtonElement(this._doneButton, this._dialog.okButton);
	}

	private addDialogButton(button: DialogButton, onSelect: () => void = () => undefined): Button {
		let buttonElement = this.addFooterButton(button.label, onSelect);
		buttonElement.enabled = button.enabled;
		button.registerClickEvent(buttonElement.onDidClick);
		button.onUpdate(() => {
			this.updateButtonElement(buttonElement, button);
		});
		attachButtonStyler(buttonElement, this._themeService);
		return buttonElement;
	}

	private updateButtonElement(buttonElement: Button, dialogButton: DialogButton) {
		buttonElement.label = dialogButton.label;
		buttonElement.enabled = dialogButton.enabled;
		dialogButton.hidden ? buttonElement.element.classList.add('dialogModal-hidden') : buttonElement.element.classList.remove('dialogModal-hidden');
	}

	protected renderBody(container: HTMLElement): void {
		new Builder(container).div({ class: 'dialogModal-body' }, (bodyBuilder) => {
			this._body = bodyBuilder.getHTMLElement();
		});

		this._dialogPane = new DialogPane(this._dialog, this._bootstrapService);
		this._dialogPane.createBody(this._body);
	}

	public open(): void {
		this.show();
	}

	public done(): void {
		if (this._dialog.okButton.enabled) {
			this.dispose();
			this.hide();
		}
	}

	public cancel(): void {
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
