/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/modal';
import { IThemable, attachButtonStyler } from 'vs/platform/theme/common/styler';
import { Color } from 'vs/base/common/color';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { mixin } from 'vs/base/common/objects';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { Builder, $ } from 'sql/base/browser/builder';
import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { generateUuid } from 'vs/base/common/uuid';
import { IContextKeyService, RawContextKey, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';

import { Button } from 'sql/base/browser/ui/button/button';
import * as TelemetryUtils from 'sql/common/telemetryUtilities';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import { localize } from 'vs/nls';
import { MessageLevel } from 'sql/workbench/api/common/sqlExtHostTypes';
import * as os from 'os';
import { IThemeService } from 'vs/platform/theme/common/themeService';

export const MODAL_SHOWING_KEY = 'modalShowing';
export const MODAL_SHOWING_CONTEXT = new RawContextKey<Array<string>>(MODAL_SHOWING_KEY, []);
const INFO_ALT_TEXT = localize('infoAltText', 'Information');
const WARNING_ALT_TEXT = localize('warningAltText', 'Warning');
const ERROR_ALT_TEXT = localize('errorAltText', 'Error');
const SHOW_DETAILS_TEXT = localize('showMessageDetails', 'Show Details');
const HIDE_DETAILS_TEXT = localize('hideMessageDetails', 'Hide Details');
const COPY_TEXT = localize('copyMessage', 'Copy');
const CLOSE_TEXT = localize('closeMessage', 'Close');
const MESSAGE_EXPANDED_MODE_CLASS = 'expanded';

export interface IModalDialogStyles {
	dialogForeground?: Color;
	dialogBorder?: Color;
	dialogHeaderAndFooterBackground?: Color;
	dialogBodyBackground?: Color;
}

export interface IModalOptions {
	isFlyout?: boolean;
	isWide?: boolean;
	isAngular?: boolean;
	hasBackButton?: boolean;
	hasTitleIcon?: boolean;
	hasErrors?: boolean;
	hasSpinner?: boolean;
}

// Needed for angular component dialogs to style modal footer
export class ModalFooterStyle {
	public static backgroundColor;
	public static borderTopWidth;
	public static borderTopStyle;
	public static borderTopColor;
}

const defaultOptions: IModalOptions = {
	isFlyout: true,
	isWide: false,
	isAngular: false,
	hasBackButton: false,
	hasTitleIcon: false,
	hasErrors: false,
	hasSpinner: false
};

export abstract class Modal extends Disposable implements IThemable {
	protected _useDefaultMessageBoxLocation: boolean = true;
	protected _messageElement: HTMLElement;
	private _messageIcon: HTMLElement;
	private _messageSeverity: Builder;
	private _messageSummary: Builder;
	private _messageSummaryElement: HTMLElement;
	private _messageDetail: Builder;
	private _messageDetailElement: HTMLElement;
	private _toggleMessageDetailButton: Button;
	private _copyMessageButton: Button;
	private _closeMessageButton: Button;
	private _messageSummaryText: string;
	private _messageDetailText: string;

	private _spinnerElement: HTMLElement;
	private _focusableElements: NodeListOf<Element>;
	private _firstFocusableElement: HTMLElement;
	private _lastFocusableElement: HTMLElement;
	private _focusedElementBeforeOpen: HTMLElement;

	private _dialogForeground: Color;
	private _dialogBorder: Color;
	private _dialogHeaderAndFooterBackground: Color;
	private _dialogBodyBackground: Color;

	private _modalDialog: Builder;
	private _modalHeaderSection: Builder;
	private _modalMessageSection: Builder;
	private _modalBodySection: HTMLElement;
	private _modalFooterSection: Builder;
	private _closeButtonInHeader: Builder;
	private _builder: Builder;
	private _footerBuilder: Builder;
	private _modalTitle: Builder;
	private _modalTitleIcon: HTMLElement;
	private _leftFooter: Builder;
	private _rightFooter: Builder;
	private _footerButtons: Button[];

	private _keydownListener: IDisposable;
	private _resizeListener: IDisposable;

	private _modalOptions: IModalOptions;
	private _backButton: Button;

	private _modalShowingContext: IContextKey<Array<string>>;
	private readonly _staticKey: string;

	/**
	 * Get the back button, only available after render and if the hasBackButton option is true
	 */
	protected get backButton(): Button {
		return this._backButton;
	}

	/**
	 * Set the dialog to have wide layout dynamically.
	 * Temporary solution to render file browser as wide or narrow layout.
	 * This will be removed once backup dialog is changed to wide layout.
	 * (hyoshi - 10/2/2017 tracked by https://github.com/Microsoft/carbon/issues/1836)
	 */
	public setWide(isWide: boolean): void {
		if (this._builder.hasClass('wide') && isWide === false) {
			this._builder.removeClass('wide');
		} else if (!this._builder.hasClass('wide') && isWide === true) {
			this._builder.addClass('wide');
		}
	}

	/**
	 * Constructor for modal
	 * @param _title Title of the modal, if undefined, the title section is not rendered
	 * @param _name Name of the modal, used for telemetry
	 * @param _partService
	 * @param options Modal options
	 */
	constructor(
		private _title: string,
		private _name: string,
		private _partService: IPartService,
		private _telemetryService: ITelemetryService,
		protected _clipboardService: IClipboardService,
		protected _themeService: IThemeService,
		_contextKeyService: IContextKeyService,
		options?: IModalOptions
	) {
		super();
		this._modalOptions = options || Object.create(null);
		mixin(this._modalOptions, defaultOptions, false);
		this._staticKey = generateUuid();
		this._modalShowingContext = MODAL_SHOWING_CONTEXT.bindTo(_contextKeyService);
		this._footerButtons = [];
	}

	/**
	 * Build and render the modal, will call {@link Modal#renderBody}
	 */
	public render() {
		let modalBodyClass = (this._modalOptions.isAngular === false ? 'modal-body' : 'modal-body-and-footer');
		let parts: Array<HTMLElement> = [];
		// This modal header section refers to the header of of the dialog
		// will not be rendered if the title is passed in as undefined
		if (this._title !== undefined) {
			this._modalHeaderSection = $().div({ class: 'modal-header' }, (modalHeader) => {
				if (this._modalOptions.hasBackButton) {
					modalHeader.div({ class: 'modal-go-back' }, (cellContainer) => {
						this._backButton = new Button(cellContainer.getHTMLElement());
						this._backButton.icon = 'backButtonIcon';
						this._backButton.title = localize('modalBack', "Back");
					});
				}
				if (this._modalOptions.hasTitleIcon) {
					modalHeader.div({ class: 'modal-title-icon' }, (modalIcon) => {
						this._modalTitleIcon = modalIcon.getHTMLElement();
					});
				}
				modalHeader.div({ class: 'modal-title' }, (modalTitle) => {
					this._modalTitle = modalTitle;
					modalTitle.text(this._title);
				});
			});
			parts.push(this._modalHeaderSection.getHTMLElement());
		}

		if (this._modalOptions.isAngular === false && this._modalOptions.hasErrors) {

			this._modalMessageSection = $().div({ class: 'dialog-message error' }, (messageContainer) => {
				messageContainer.div({ class: 'dialog-message-header' }, (headerContainer) => {
					headerContainer.div({ class: 'dialog-message-icon' }, (iconContainer) => {
						this._messageIcon = iconContainer.getHTMLElement();
					});
					headerContainer.div({ class: 'dialog-message-severity' }, (messageSeverityContainer) => {
						this._messageSeverity = messageSeverityContainer;
					});
					headerContainer.div({ class: 'dialog-message-button' }, (buttonContainer) => {
						this._toggleMessageDetailButton = new Button(buttonContainer.getHTMLElement());
						this._toggleMessageDetailButton.icon = 'message-details-icon';
						this._toggleMessageDetailButton.label = SHOW_DETAILS_TEXT;
						this._toggleMessageDetailButton.onDidClick((e) => {
							this.toggleMessageDetail();
						});
					});
					headerContainer.div({ class: 'dialog-message-button' }, (buttonContainer) => {
						this._copyMessageButton = new Button(buttonContainer.getHTMLElement());
						this._copyMessageButton.icon = 'copy-message-icon';
						this._copyMessageButton.label = COPY_TEXT;
						this._copyMessageButton.onDidClick((e) => {
							this._clipboardService.writeText(this.getTextForClipboard());
						});
					});
					headerContainer.div({ class: 'dialog-message-button' }, (buttonContainer) => {
						this._closeMessageButton = new Button(buttonContainer.getHTMLElement());
						this._closeMessageButton.icon = 'close-message-icon';
						this._closeMessageButton.label = CLOSE_TEXT;
						this._closeMessageButton.onDidClick((e) => {
							this.setError(undefined);
						});
					});

					attachButtonStyler(this._toggleMessageDetailButton, this._themeService);
					attachButtonStyler(this._copyMessageButton, this._themeService);
					attachButtonStyler(this._closeMessageButton, this._themeService);
				});
				messageContainer.div({ class: 'dialog-message-body' }, (messageBody) => {
					messageBody.div({ class: 'dialog-message-summary' }, (summaryContainer) => {
						this._messageSummary = summaryContainer;
						this._messageSummaryElement = summaryContainer.getHTMLElement();
						this._messageSummaryElement.onclick = (e) => {
							this.toggleMessageDetail();
						};
					});
					messageBody.div({ class: 'dialog-message-detail' }, (detailContainer) => {
						this._messageDetail = detailContainer;
						this._messageDetailElement = detailContainer.getHTMLElement();
						this._messageDetailElement.style.display = 'none';
					});
				});
			});
			this._messageElement = this._modalMessageSection.getHTMLElement();
			this.updateElementVisibility(this._messageElement, false);

			if (this._useDefaultMessageBoxLocation) {
				parts.push(this._messageElement);
			}
		}

		// This modal body section refers to the body of of the dialog
		let body: Builder;
		$().div({ class: modalBodyClass }, (builder) => {
			body = builder;
		});

		this._modalBodySection = body.getHTMLElement();
		parts.push(body.getHTMLElement());

		this.renderBody(body.getHTMLElement());

		// This modal footer section refers to the footer of of the dialog
		if (this._modalOptions.isAngular === false) {
			this._modalFooterSection = $().div({ class: 'modal-footer' }, (modelFooter) => {
				if (this._modalOptions.hasSpinner) {
					modelFooter.div({ 'class': 'icon in-progress' }, (spinnerContainer) => {
						this._spinnerElement = spinnerContainer.getHTMLElement();
						this._spinnerElement.style.visibility = 'hidden';
					});
				}
				modelFooter.div({ 'class': 'left-footer' }, (leftFooter) => {
					this._leftFooter = leftFooter;
				});
				modelFooter.div({ 'class': 'right-footer' }, (rightFooter) => {
					this._rightFooter = rightFooter;
				});
				this._footerBuilder = modelFooter;
			});
			parts.push(this._modalFooterSection.getHTMLElement());
		}

		let builderClass = 'modal fade';
		if (this._modalOptions.isFlyout) {
			builderClass += ' flyout-dialog';
		}
		if (this._modalOptions.isWide) {
			builderClass += ' wide';
		}

		// The builder builds the dialog. It append header, body and footer sections.
		this._builder = $().div({ class: builderClass, 'role': 'dialog', 'aria-label': this._title }, (dialogContainer) => {
			this._modalDialog = dialogContainer.div({ class: 'modal-dialog ', role: 'document' }, (modalDialog) => {
				modalDialog.div({ class: 'modal-content' }, (modelContent) => {
					parts.forEach((part) => {
						modelContent.append(part);
					});
				});
			});
		});
	}

	/**
	 * Called for extended classes to render the body
	 * @param container The parent container to attach the rendered body to
	 */
	protected abstract renderBody(container: HTMLElement): void;

	/**
	 * Overridable to change behavior of escape key
	 */
	protected onClose(e: StandardKeyboardEvent) {
		this.hide();
	}

	/**
	 * Overridable to change behavior of enter key
	 */
	protected onAccept(e: StandardKeyboardEvent) {
		this.hide();
	}

	private handleBackwardTab(e: KeyboardEvent) {
		if (this._firstFocusableElement && this._lastFocusableElement && document.activeElement === this._firstFocusableElement) {
			e.preventDefault();
			this._lastFocusableElement.focus();
		}
	}

	private handleForwardTab(e: KeyboardEvent) {
		if (this._firstFocusableElement && this._lastFocusableElement && document.activeElement === this._lastFocusableElement) {
			e.preventDefault();
			this._firstFocusableElement.focus();
		}
	}

	private getTextForClipboard(): string {
		return this._messageDetailText === '' ? this._messageSummaryText : `${this._messageSummaryText}${os.EOL}========================${os.EOL}${this._messageDetailText}`;
	}

	private updateElementVisibility(element: HTMLElement, visible: boolean) {
		element.style.display = visible ? 'block' : 'none';
	}

	private updateExpandMessageState() {
		this._messageSummaryElement.style.cursor = this.shouldShowExpandMessageButton ? 'pointer' : 'default';
		this._messageSummaryElement.classList.remove(MESSAGE_EXPANDED_MODE_CLASS);
		this.updateElementVisibility(this._toggleMessageDetailButton.element, this.shouldShowExpandMessageButton);
	}

	private toggleMessageDetail() {
		let isExpanded = this._messageSummaryElement.classList.contains(MESSAGE_EXPANDED_MODE_CLASS);
		if (isExpanded) {
			this._messageSummaryElement.classList.remove(MESSAGE_EXPANDED_MODE_CLASS);
			this._toggleMessageDetailButton.label = SHOW_DETAILS_TEXT;
		} else {
			this._messageSummaryElement.classList.add(MESSAGE_EXPANDED_MODE_CLASS);
			this._toggleMessageDetailButton.label = HIDE_DETAILS_TEXT;
		}

		if (this._messageDetailText !== '') {
			this.updateElementVisibility(this._messageDetailElement, !isExpanded);
		}
	}

	private get shouldShowExpandMessageButton(): boolean {
		return this._messageDetailText !== '' || this._messageSummaryElement.scrollWidth > this._messageSummaryElement.offsetWidth;
	}

	/**
	 * Set focusable elements in the modal dialog
	 */
	public setFocusableElements() {
		this._focusableElements = this._builder.getHTMLElement().querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]');
		if (this._focusableElements && this._focusableElements.length > 0) {
			this._firstFocusableElement = <HTMLElement>this._focusableElements[0];
			this._lastFocusableElement = <HTMLElement>this._focusableElements[this._focusableElements.length - 1];
		}

		this._focusedElementBeforeOpen = <HTMLElement>document.activeElement;
	}

	/**
	 * Shows the modal and attaches key listeners
	 */
	protected show() {
		this._modalShowingContext.get().push(this._staticKey);
		this._builder.appendTo(this._partService.getWorkbenchElement());

		this.setFocusableElements();

		this._keydownListener = DOM.addDisposableListener(document, DOM.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			let context = this._modalShowingContext.get();
			if (context[context.length - 1] === this._staticKey) {
				let event = new StandardKeyboardEvent(e);
				if (event.equals(KeyCode.Enter)) {
					this.onAccept(event);
				} else if (event.equals(KeyCode.Escape)) {
					this.onClose(event);
				} else if (event.equals(KeyMod.Shift | KeyCode.Tab)) {
					this.handleBackwardTab(e);
				} else if (event.equals(KeyCode.Tab)) {
					this.handleForwardTab(e);
				}
			}
		});
		this._resizeListener = DOM.addDisposableListener(window, DOM.EventType.RESIZE, (e: Event) => {
			this.layout(DOM.getTotalHeight(this._modalBodySection));
		});

		this.layout(DOM.getTotalHeight(this._modalBodySection));
		TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.ModalDialogOpened, { name: this._name });
	}

	/**
	 * Required to be implemented so that scrolling and other functions operate correctly. Should re-layout controls in the modal
	 */
	protected abstract layout(height: number): void;

	/**
	 * Hides the modal and removes key listeners
	 */
	protected hide() {
		this._modalShowingContext.get().pop();
		this._builder.offDOM();
		if (this._focusedElementBeforeOpen) {
			this._focusedElementBeforeOpen.focus();
		}
		this._keydownListener.dispose();
		this._resizeListener.dispose();
		TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.ModalDialogClosed, { name: this._name });
	}

	/**
	 * Adds a button to the footer of the modal
	 * @param label Label to show on the button
	 * @param onSelect The callback to call when the button is selected
	 */
	protected addFooterButton(label: string, onSelect: () => void, orientation: 'left' | 'right' = 'right'): Button {
		let footerButton = $('div.footer-button');
		let button = new Button(footerButton.getHTMLElement());
		button.label = label;
		button.onDidClick(() => onSelect());
		if (orientation === 'left') {
			footerButton.appendTo(this._leftFooter);
		} else {
			footerButton.appendTo(this._rightFooter);
		}
		this._footerButtons.push(button);
		return button;
	}

	/**
	 * Returns a footer button matching the provided label
	 * @param label Label to show on the button
	 * @param onSelect The callback to call when the button is selected
	 */
	protected findFooterButton(label: string): Button {
		return this._footerButtons.find(e => {
			try {
				return e && e.element.innerText === label;
			} catch {
				return false;
			}
		});
	}

	/**
	 * Show an error in the error message element
	 * @param message Text to show in the message
	 * @param level Severity level of the message
	 * @param description Description of the message
	 */
	protected setError(message: string, level: MessageLevel = MessageLevel.Error, description: string = '') {
		if (this._modalOptions.hasErrors) {
			this._messageSummaryText = message ? message : '';
			this._messageDetailText = description ? description : '';

			if (this._messageSummaryText !== '') {
				const levelClasses = ['info', 'warning', 'error'];
				let selectedLevel = levelClasses[2];
				let severityText = ERROR_ALT_TEXT;
				if (level === MessageLevel.Information) {
					selectedLevel = levelClasses[0];
					severityText = INFO_ALT_TEXT;
				} else if (level === MessageLevel.Warning) {
					selectedLevel = levelClasses[1];
					severityText = WARNING_ALT_TEXT;
				}
				levelClasses.forEach(level => {
					if (selectedLevel === level) {
						this._messageIcon.classList.add(level);
						this._messageElement.classList.add(level);
					} else {
						this._messageIcon.classList.remove(level);
						this._messageElement.classList.remove(level);
					}
				});

				this._messageIcon.title = severityText;
				this._messageSeverity.text(severityText);
				this._messageSummary.text(message);
				this._messageSummary.title(message);
				this._messageDetail.text(description);
			}
			this.updateElementVisibility(this._messageDetailElement, false);
			this.updateElementVisibility(this._messageElement, this._messageSummaryText !== '');
			this.updateExpandMessageState();
		}
	}

	/**
	 * Show the spinner element that shows something is happening, hidden by default
	 */
	protected showSpinner(): void {
		if (this._modalOptions.hasSpinner) {
			this._spinnerElement.style.visibility = 'visible';
		}
	}

	/**
	 * Hide the spinner element to show that something was happening, hidden by default
	 */
	protected hideSpinner(): void {
		if (this._modalOptions.hasSpinner) {
			this._spinnerElement.style.visibility = 'hidden';
		}
	}

	/**
	 * Set spinner element to show or hide
	 */
	public set spinner(show: boolean) {
		if (show) {
			this.showSpinner();
		} else {
			this.hideSpinner();
		}
	}

	/**
	 * Return background color of header and footer
	 */
	protected get headerAndFooterBackground(): string {
		return this._dialogHeaderAndFooterBackground ? this._dialogHeaderAndFooterBackground.toString() : null;
	}

	/**
	 * Set the title of the modal
	 * @param title
	 */
	protected set title(title: string) {
		if (this._title !== undefined) {
			this._modalTitle.text(title);
		}
	}

	protected get title(): string {
		return this._title;
	}

	/**
	 * Set the icon title class name
	 * @param iconClassName
	 */
	protected set titleIconClassName(iconClassName: string) {
		if (this._modalTitleIcon) {
			this._modalTitleIcon.className = 'modal-title-icon ' + iconClassName;
		}
	}

	/**
	 * Called by the theme registry on theme change to style the component
	 */
	public style(styles: IModalDialogStyles): void {
		this._dialogForeground = styles.dialogForeground;
		this._dialogBorder = styles.dialogBorder;
		this._dialogHeaderAndFooterBackground = styles.dialogHeaderAndFooterBackground;
		this._dialogBodyBackground = styles.dialogBodyBackground;
		this.applyStyles();
	}

	private applyStyles(): void {
		const foreground = this._dialogForeground ? this._dialogForeground.toString() : null;
		const border = this._dialogBorder ? this._dialogBorder.toString() : null;
		const headerAndFooterBackground = this._dialogHeaderAndFooterBackground ? this._dialogHeaderAndFooterBackground.toString() : null;
		const bodyBackground = this._dialogBodyBackground ? this._dialogBodyBackground.toString() : null;
		ModalFooterStyle.backgroundColor = headerAndFooterBackground;
		ModalFooterStyle.borderTopWidth = border ? '1px' : null;
		ModalFooterStyle.borderTopStyle = border ? 'solid' : null;
		ModalFooterStyle.borderTopColor = border;

		if (this._closeButtonInHeader) {
			this._closeButtonInHeader.style('color', foreground);
		}
		if (this._modalDialog) {
			this._modalDialog.style('color', foreground);
			this._modalDialog.style('border-width', border ? '1px' : null);
			this._modalDialog.style('border-style', border ? 'solid' : null);
			this._modalDialog.style('border-color', border);
		}

		if (this._modalHeaderSection) {
			this._modalHeaderSection.style('background-color', headerAndFooterBackground);
			this._modalHeaderSection.style('border-bottom-width', border ? '1px' : null);
			this._modalHeaderSection.style('border-bottom-style', border ? 'solid' : null);
			this._modalHeaderSection.style('border-bottom-color', border);
		}

		if (this._modalMessageSection) {
			this._modalMessageSection.style('background-color', headerAndFooterBackground);
			this._modalMessageSection.style('border-bottom-width', border ? '1px' : null);
			this._modalMessageSection.style('border-bottom-style', border ? 'solid' : null);
			this._modalMessageSection.style('border-bottom-color', border);
		}

		if (this._modalBodySection) {
			this._modalBodySection.style.backgroundColor = bodyBackground;
		}

		if (this._modalFooterSection) {
			this._modalFooterSection.style('background-color', ModalFooterStyle.backgroundColor);
			this._modalFooterSection.style('border-top-width', ModalFooterStyle.borderTopWidth);
			this._modalFooterSection.style('border-top-style', ModalFooterStyle.borderTopStyle);
			this._modalFooterSection.style('border-top-color', ModalFooterStyle.borderTopColor);
		}
	}

	public dispose() {
		super.dispose();
		this._keydownListener.dispose();
		this._footerButtons = [];
	}
}
