/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/dialogModal';
import { Modal, IModalOptions, HideReason } from 'sql/workbench/browser/modal/modal';
import { Wizard, DialogButton, WizardPage } from 'sql/workbench/services/dialog/common/dialogTypes';
import { DialogPane } from 'sql/workbench/services/dialog/browser/dialogPane';
import { bootstrapAngular } from 'sql/workbench/services/bootstrap/browser/bootstrapService';
import { DialogMessage } from 'sql/workbench/api/common/sqlExtHostTypes';
import { DialogModule } from 'sql/workbench/services/dialog/browser/dialog.module';
import { Button } from 'vs/base/browser/ui/button/button';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { Emitter } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { append, $ } from 'vs/base/browser/dom';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { onUnexpectedError } from 'vs/base/common/errors';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { status } from 'vs/base/browser/ui/aria/aria';
import { TelemetryView, TelemetryAction } from 'sql/platform/telemetry/common/telemetryKeys';

export class WizardModal extends Modal {
	private _dialogPanes = new Map<WizardPage, DialogPane>();
	private _onDone = new Emitter<void>();
	private _onCancel = new Emitter<void>();

	// Wizard HTML elements
	private _body: HTMLElement;

	private _pageContainer: HTMLElement;
	private _mpContainer: HTMLElement;

	// Buttons
	private _previousButton: Button;
	private _nextButton: Button;
	private _doneButton: Button;

	constructor(
		private _wizard: Wizard,
		options: IModalOptions,
		@ILayoutService layoutService: ILayoutService,
		@IThemeService themeService: IThemeService,
		@IAdsTelemetryService private _telemetryEventService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super(_wizard.title, _wizard.name, _telemetryEventService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, options);
		this._useDefaultMessageBoxLocation = false;
	}

	public layout(): void {

	}

	public override render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);

		if (this.backButton) {
			this.backButton.onDidClick(() => this.cancel());
			attachButtonStyler(this.backButton, this._themeService, { buttonBackground: SIDE_BAR_BACKGROUND, buttonHoverBackground: SIDE_BAR_BACKGROUND });
		}

		this._wizard.customButtons.forEach(button => {
			let buttonElement = this.addDialogButton(button);
			this.updateButtonElement(buttonElement, button);
		});

		this._previousButton = this.addDialogButton(this._wizard.backButton, () => this.showPage(this._wizard.currentPage - 1));
		this._nextButton = this.addDialogButton(this._wizard.nextButton, () => this.showPage(this._wizard.currentPage + 1, true, true), true, true);
		this.addDialogButton(this._wizard.generateScriptButton, () => undefined);
		this._doneButton = this.addDialogButton(this._wizard.doneButton, () => this.done(), false, true);
		this._wizard.doneButton.registerClickEvent(this._onDone.event);
		this.addDialogButton(this._wizard.cancelButton, () => this.cancel(), false);
		this._wizard.cancelButton.registerClickEvent(this._onCancel.event);

		let messageChangeHandler = (message: DialogMessage) => {
			if (message && message.text) {
				this.setError(message.text, message.level, message.description);
			} else {
				this.setError('');
			}
		};

		messageChangeHandler(this._wizard.message);
		this._wizard.onMessageChange(message => messageChangeHandler(message));
	}

	private addDialogButton(button: DialogButton, onSelect: () => void = () => undefined, registerClickEvent: boolean = true, requirePageValid: boolean = false, index?: number): Button {
		let buttonElement = this.addFooterButton(button.label, onSelect, button.position, button.secondary, index);
		buttonElement.enabled = button.enabled;
		if (registerClickEvent) {
			button.registerClickEvent(buttonElement.onDidClick);
		}
		button.onUpdate(() => {
			this.updateButtonElement(buttonElement, button, requirePageValid);
		});
		attachButtonStyler(buttonElement, this._themeService);
		this.updateButtonElement(buttonElement, button, requirePageValid);
		return buttonElement;
	}

	private updateButtonElement(buttonElement: Button, dialogButton: DialogButton, requirePageValid: boolean = false) {
		buttonElement.label = dialogButton.label;
		buttonElement.enabled = requirePageValid ? dialogButton.enabled && this._wizard.pages[this._wizard.currentPage].valid : dialogButton.enabled;
		dialogButton.hidden ? buttonElement.element.parentElement.classList.add('dialogModal-hidden') : buttonElement.element.parentElement.classList.remove('dialogModal-hidden');

		if (dialogButton.focused) {
			buttonElement.focus();
		}

		this.setButtonsForPage(this._wizard.currentPage);
	}

	protected renderBody(container: HTMLElement): void {
		this._body = append(container, $('div.dialogModal-body'));

		this.initializeNavigation(this._body);

		this._mpContainer = append(this._body, $('div.dialog-message-and-page-container'));
		this._pageContainer = append(this._mpContainer, $('div.dialogModal-page-container'));

		this._wizard.pages.forEach((page, index) => {
			this.registerPage(page, index === 0); // only do auto-focus for the first page.
		});
		this._wizard.onPageAdded(page => {
			this.registerPage(page);
			this.updatePageNumbers();
			this.showPage(this._wizard.currentPage, false, false, false).catch(err => onUnexpectedError(err));
		});
		this._wizard.onPageRemoved(page => {
			let dialogPane = this._dialogPanes.get(page);
			this._dialogPanes.delete(page);
			this.updatePageNumbers();
			this.showPage(this._wizard.currentPage, false, false, false).catch(err => onUnexpectedError(err));
			dialogPane.dispose();
		});
		this.updatePageNumbers();
	}

	protected override set messagesElementVisible(visible: boolean) {
		if (visible) {
			this._mpContainer.prepend(this._messageElement);
		} else {
			// Let base class handle it
			super.messagesElementVisible = false;
		}
	}

	private updatePageNumbers(): void {
		this._wizard.pages.forEach((page, index) => {
			let dialogPane = this._dialogPanes.get(page);
			dialogPane.pageNumber = index + 1;
		});
	}

	private registerPage(page: WizardPage, setInitialFocus: boolean = false): void {
		let dialogPane = new DialogPane(page.title, page.content, valid => page.notifyValidityChanged(valid), this._instantiationService, this._themeService, this._wizard.displayPageTitles, page.description, setInitialFocus);
		dialogPane.createBody(this._pageContainer);
		this._dialogPanes.set(page, dialogPane);
		page.onUpdate(() => this.setButtonsForPage(this._wizard.currentPage));
	}

	public async showPage(index: number, validate: boolean = true, focus: boolean = false, readHeader: boolean = true): Promise<void> {
		let pageToShow = this._wizard.pages[index];
		const prevPageIndex = this._wizard.currentPage;
		if (!pageToShow) {
			this.done(validate).catch(err => onUnexpectedError(err));
			return;
		}
		if (validate && !await this.validateNavigation(index)) {
			return;
		}

		let dialogPaneToShow: DialogPane | undefined = undefined;
		this._dialogPanes.forEach((dialogPane, page) => {
			if (page === pageToShow) {
				dialogPaneToShow = dialogPane;
				dialogPane.show(focus);
				dialogPane.layout(true);
			} else {
				dialogPane.hide();
			}
		});

		if (dialogPaneToShow && readHeader) {
			status(`${dialogPaneToShow.pageNumberDisplayText} ${dialogPaneToShow.title}`);
		}

		// Remove the current page's custom buttons
		this._wizard.pages[this._wizard.currentPage]?.customButtons.forEach(button => {
			this.removeFooterButton(button.label);
		});
		// Add the custom buttons for the new page
		this._wizard.pages[index]?.customButtons.forEach((button, buttonIndex) => {
			let buttonElement = this.addDialogButton(button, undefined, undefined, undefined, buttonIndex);
			this.updateButtonElement(buttonElement, button);
		});
		this.setButtonsForPage(index);
		this._wizard.setCurrentPage(index);
		let currentPageValid = this._wizard.pages[this._wizard.currentPage].valid;
		this._nextButton.enabled = this._wizard.nextButton.enabled && currentPageValid;
		this._doneButton.enabled = this._wizard.doneButton.enabled && currentPageValid;

		pageToShow.onValidityChanged(valid => {
			if (index === this._wizard.currentPage) {
				this._nextButton.enabled = this._wizard.nextButton.enabled && pageToShow.valid;
				this._doneButton.enabled = this._wizard.doneButton.enabled && pageToShow.valid;
			}
		});

		if (index !== prevPageIndex) {
			this._telemetryEventService.createActionEvent(TelemetryView.Shell, TelemetryAction.WizardPagesNavigation)
				.withAdditionalProperties({
					wizardName: this._wizard.name,
					pageNavigationFrom: this._wizard.pages[prevPageIndex].pageName ?? prevPageIndex,
					pageNavigationTo: this._wizard.pages[index].pageName ?? index,
					pageNavigationFromIndex: prevPageIndex,
					pageNavigationToIndex: index,
					direction: index > prevPageIndex ? 'forward' : 'backward'
				}).send();
		}
	}

	private setButtonsForPage(index: number) {
		if (this._previousButton) {
			if (this._wizard.pages[index - 1]) {
				this._previousButton.element.parentElement.classList.remove('dialogModal-hidden');
				this._previousButton.enabled = this._wizard.pages[index - 1].enabled;
			} else {
				this._previousButton.element.parentElement.classList.add('dialogModal-hidden');
			}
		}

		if (this._nextButton && this._doneButton) {
			if (this._wizard.pages[index + 1]) {
				let isPageValid = this._wizard.pages[index] && this._wizard.pages[index].valid;
				this._nextButton.element.parentElement.classList.remove('dialogModal-hidden');
				this._nextButton.enabled = isPageValid && this._wizard.pages[index + 1].enabled;
				this._doneButton.element.parentElement.classList.add('dialogModal-hidden');
			} else {
				this._nextButton.element.parentElement.classList.add('dialogModal-hidden');
				this._doneButton.element.parentElement.classList.remove('dialogModal-hidden');
			}
		}
	}

	/**
	 * Bootstrap angular for the wizard's left nav bar
	 */
	private initializeNavigation(bodyContainer: HTMLElement) {
		this._instantiationService.invokeFunction(bootstrapAngular,
			DialogModule,
			bodyContainer,
			'wizard-navigation',
			{
				wizard: this._wizard,
				navigationHandler: (index: number) => this.showPage(index, index > this._wizard.currentPage, true)
			},
			undefined,
			() => undefined);
	}

	/**
	 * Opens the dialog to the first page
	 * @param source Where the wizard was opened from for telemetry (ex: command palette, context menu)
	 */
	public open(source?: string): void {
		this.showPage(0, false, true).then(() => {
			this.show(source);
		}).catch(err => onUnexpectedError(err));
	}

	public async done(validate: boolean = true): Promise<void> {
		if (this._doneButton.enabled) {
			if (validate && !await this.validateNavigation(undefined)) {
				return;
			}
			this._onDone.fire();
			this.dispose();
			this.hide('ok');
		}
	}

	public close(): void {
		this.cancel('close');
	}
	public cancel(hideReason: HideReason = 'cancel'): void {
		const currentPage = this._wizard.pages[this._wizard.currentPage];
		this._onCancel.fire();
		this.dispose();
		this.hide(hideReason, currentPage.pageName ?? this._wizard.currentPage.toString());
	}

	private async validateNavigation(newPage: number): Promise<boolean> {
		let button = newPage === undefined ? this._doneButton : this._nextButton;
		let buttonSpinnerHandler = setTimeout(() => {
			button.enabled = false;
			button.element.innerHTML = '&nbsp';
			button.element.classList.add('validating');
		}, 100);
		let navigationValid = await this._wizard.validateNavigation(newPage);
		clearTimeout(buttonSpinnerHandler);
		button.element.classList.remove('validating');
		this.updateButtonElement(button, newPage === undefined ? this._wizard.doneButton : this._wizard.nextButton, true);
		return navigationValid;
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
		if (this._wizard.currentPage === this._wizard.pages.length - 1) {
			this.done().catch(err => onUnexpectedError(err));
		} else {
			if (this._nextButton.enabled) {
				this.showPage(this._wizard.currentPage + 1, true, true).catch(err => onUnexpectedError(err));
			}
		}
	}

	public override dispose(): void {
		super.dispose();
		this._dialogPanes.forEach(dialogPane => dialogPane.dispose());
	}
}
