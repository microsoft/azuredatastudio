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
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

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
		@IWorkbenchThemeService private _themeService: IWorkbenchThemeService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IInstantiationService private _instantiationService: IInstantiationService
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

		this._doneButton = this.addDialogButton(this._dialog.okButton, () => this.done(), false);
		this._dialog.okButton.registerClickEvent(this._onDone.event);
		this._cancelButton = this.addDialogButton(this._dialog.cancelButton, () => this.cancel(), false);
		this._dialog.cancelButton.registerClickEvent(this._onCancel.event);
	}

	private addDialogButton(button: DialogButton, onSelect: () => void = () => undefined, registerClickEvent: boolean = true): Button {
		let buttonElement = this.addFooterButton(button.label, onSelect);
		buttonElement.enabled = button.enabled;
		if (registerClickEvent) {
			button.registerClickEvent(buttonElement.onDidClick);
		}
		button.onUpdate(() => {
			this.updateButtonElement(buttonElement, button);
		});
		attachButtonStyler(buttonElement, this._themeService);
		this.updateButtonElement(buttonElement, button);
		return buttonElement;
	}

	private updateButtonElement(buttonElement: Button, dialogButton: DialogButton) {
		buttonElement.label = dialogButton.label;
		buttonElement.enabled = dialogButton.enabled;
		dialogButton.hidden ? buttonElement.element.classList.add('dialogModal-hidden') : buttonElement.element.classList.remove('dialogModal-hidden');
	}

	protected renderBody(container: HTMLElement): void {
		let body: HTMLElement;
		new Builder(container).div({ class: 'dialogModal-body' }, (bodyBuilder) => {
			body = bodyBuilder.getHTMLElement();
		});

		this._dialogPane = new DialogPane(this._dialog, this._instantiationService);
		this._dialogPane.createBody(body);
	}

	public open(): void {
		this.show();
	}

	public done(): void {
		if (this._dialog.okButton.enabled) {
			this._onDone.fire();
			this.dispose();
			this.hide();
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
