/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/dialogModal';
import { Modal, IModalOptions } from 'sql/base/browser/ui/modal/modal';
import { attachModalDialogStyler } from 'sql/common/theme/styler';
import { Wizard, Dialog, DialogButton } from 'sql/platform/dialog/dialogTypes';
import { DialogPane } from 'sql/platform/dialog/dialogPane';
import { IBootstrapService } from 'sql/services/bootstrap/bootstrapService';
import { Button } from 'vs/base/browser/ui/button/button';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { Builder } from 'vs/base/browser/builder';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { localize } from 'vs/nls';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { Emitter } from 'vs/base/common/event';

export class WizardModal extends Modal {
	private _pages: DialogPane[];
	private _onDone = new Emitter<void>();
	private _onCancel = new Emitter<void>();

	// Wizard HTML elements
	private _body: HTMLElement;
	private _progressBar: HTMLElement;
	private _pageHeader: HTMLElement;
	private _pageContent: HTMLElement;

	// Buttons
	private _previousButton: Button;
	private _nextButton: Button;
	private _doneButton: Button;
	private _cancelButton: Button;

	constructor(
		private _wizard: Wizard,
		name: string,
		options: IModalOptions,
		@IPartService partService: IPartService,
		@IWorkbenchThemeService private _themeService: IWorkbenchThemeService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IBootstrapService private _bootstrapService: IBootstrapService
	) {
		super(_wizard.title, name, partService, telemetryService, contextKeyService, options);
		this._pages = [];
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

		this._previousButton = this.addDialogButton(this._wizard.backButton, () => this.showPage(this.getCurrentPage() - 1));
		this._nextButton = this.addDialogButton(this._wizard.nextButton, () => this.showPage(this.getCurrentPage() + 1));
		this._doneButton = this.addDialogButton(this._wizard.doneButton, () => this.done(), false);
		this._wizard.doneButton.registerClickEvent(this._onDone.event);
		this._cancelButton = this.addDialogButton(this._wizard.cancelButton, () => this.cancel(), false);
		this._wizard.cancelButton.registerClickEvent(this._onCancel.event);
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
		new Builder(container).div({ class: 'dialogModal-body' }, (bodyBuilder) => {
			this._body = bodyBuilder.getHTMLElement();
		});

		let builder = new Builder(this._body);
		builder.div({ class: 'wizardModal-progressBar' }, (progressBarBuilder) => {
			this._progressBar = progressBarBuilder.getHTMLElement();
		});
		this._wizard.pages.forEach(page => {
			let dialogPane = new DialogPane(page.title, page.content, valid => page.notifyValidityChanged(valid), this._bootstrapService);
			dialogPane.createBody(this._body);
			this._pages.push(dialogPane);
		});
	}

	private showPage(index: number): void {
		if (!this._pages[index]) {
			this.done();
			return;
		}
		this.setButtonsForPage(index);
		this._pages.forEach(page => page.hide());
		this._pages[index].show();
		this._wizard.setCurrentPage(index);
	}

	private setButtonsForPage(index: number) {
		if (this._pages[index - 1]) {
			this._previousButton.element.parentElement.classList.remove('dialogModal-hidden');
		} else {
			this._previousButton.element.parentElement.classList.add('dialogModal-hidden');
		}

		if (this._pages[index + 1]) {
			this._nextButton.element.parentElement.classList.remove('dialogModal-hidden');
			this._doneButton.element.parentElement.classList.add('dialogModal-hidden');
		} else {
			this._nextButton.element.parentElement.classList.add('dialogModal-hidden');
			this._doneButton.element.parentElement.classList.remove('dialogModal-hidden');
		}
	}

	private getCurrentPage(): number {
		return this._wizard.currentPage;
	}

	public open(): void {
		this.showPage(0);
		this.show();
	}

	public done(): void {
		if (this._wizard.doneButton.enabled) {
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
		this._pages.forEach(dialogPane => dialogPane.dispose());
	}
}