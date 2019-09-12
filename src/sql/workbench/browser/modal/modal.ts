/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/modal';
import { IThemable, attachButtonStyler } from 'vs/platform/theme/common/styler';
import { Color } from 'vs/base/common/color';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { mixin } from 'vs/base/common/objects';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { generateUuid } from 'vs/base/common/uuid';
import { IContextKeyService, RawContextKey, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';

import { Button } from 'sql/base/browser/ui/button/button';
import * as TelemetryUtils from 'sql/platform/telemetry/common/telemetryUtilities';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { localize } from 'vs/nls';
import { MessageLevel } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { ILogService } from 'vs/platform/log/common/log';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/resourceConfiguration';
import { URI } from 'vs/base/common/uri';
import { Schemas } from 'vs/base/common/network';

export const MODAL_SHOWING_KEY = 'modalShowing';
export const MODAL_SHOWING_CONTEXT = new RawContextKey<Array<string>>(MODAL_SHOWING_KEY, []);
const INFO_ALT_TEXT = localize('infoAltText', "Information");
const WARNING_ALT_TEXT = localize('warningAltText', "Warning");
const ERROR_ALT_TEXT = localize('errorAltText', "Error");
const SHOW_DETAILS_TEXT = localize('showMessageDetails', "Show Details");
const COPY_TEXT = localize('copyMessage', "Copy");
const CLOSE_TEXT = localize('closeMessage', "Close");
const MESSAGE_EXPANDED_MODE_CLASS = 'expanded';

export interface IModalDialogStyles {
	dialogForeground?: Color;
	dialogBorder?: Color;
	dialogHeaderAndFooterBackground?: Color;
	dialogBodyBackground?: Color;
	footerBackgroundColor?: Color;
	footerBorderTopWidth?: Color;
	footerBorderTopStyle?: Color;
	footerBorderTopColor?: Color;
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
	protected _modalOptions: IModalOptions;
	private _messageIcon: HTMLElement;
	private _messageSeverity: HTMLElement;
	private _messageSummary: HTMLElement;
	private _messageDetail: HTMLElement;
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

	private _dialogForeground?: Color;
	private _dialogBorder?: Color;
	private _dialogHeaderAndFooterBackground?: Color;
	private _dialogBodyBackground?: Color;

	private _modalDialog: HTMLElement;
	private _modalHeaderSection: HTMLElement;
	private _modalBodySection: HTMLElement;
	private _modalFooterSection: HTMLElement;
	private _closeButtonInHeader: HTMLElement;
	private _bodyContainer: HTMLElement;
	private _modalTitle: HTMLElement;
	private _modalTitleIcon: HTMLElement;
	private _leftFooter: HTMLElement;
	private _rightFooter: HTMLElement;
	private _footerButtons: Button[];

	private _keydownListener: IDisposable;
	private _resizeListener: IDisposable;

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
		DOM.toggleClass(this._bodyContainer, 'wide', isWide);
	}

	/**
	 * Constructor for modal
	 * @param _title Title of the modal, if undefined, the title section is not rendered
	 * @param _name Name of the modal, used for telemetry
	 * @param options Modal options
	 */
	constructor(
		private _title: string,
		private _name: string,
		private readonly _telemetryService: ITelemetryService,
		protected readonly layoutService: IWorkbenchLayoutService,
		protected readonly _clipboardService: IClipboardService,
		protected readonly _themeService: IThemeService,
		protected readonly logService: ILogService,
		protected readonly textResourcePropertiesService: ITextResourcePropertiesService,
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
		let builderClass = 'modal fade';
		if (this._modalOptions.isFlyout) {
			builderClass += ' flyout-dialog';
		}

		if (this._modalOptions.isWide) {
			builderClass += ' wide';
		}

		this._bodyContainer = DOM.$(`.${builderClass}`, { role: 'dialog', 'aria-label': this._title });
		const top = this.layoutService.getTitleBarOffset();
		this._bodyContainer.style.top = `${top}px`;
		this._modalDialog = DOM.append(this._bodyContainer, DOM.$('.modal-dialog', { role: 'document' }));
		const modalContent = DOM.append(this._modalDialog, DOM.$('.modal-content'));

		if (!isUndefinedOrNull(this._title)) {
			this._modalHeaderSection = DOM.append(modalContent, DOM.$('.modal-header'));
			if (this._modalOptions.hasBackButton) {
				const container = DOM.append(this._modalHeaderSection, DOM.$('.modal-go-back'));
				this._backButton = new Button(container);
				this._backButton.icon = 'backButtonIcon';
				this._backButton.title = localize('modal.back', "Back");
			}

			if (this._modalOptions.hasTitleIcon) {
				this._modalTitleIcon = DOM.append(this._modalHeaderSection, DOM.$('.modal-title-icon'));
			}

			this._modalTitle = DOM.append(this._modalHeaderSection, DOM.$('.modal-title'));
			this._modalTitle.innerText = this._title;
		}

		if (!this._modalOptions.isAngular && this._modalOptions.hasErrors) {
			this._messageElement = DOM.$('.dialog-message.error');
			const headerContainer = DOM.append(this._messageElement, DOM.$('.dialog-message-header'));
			this._messageIcon = DOM.append(headerContainer, DOM.$('.dialog-message-icon'));
			this._messageSeverity = DOM.append(headerContainer, DOM.$('.dialog-message-severity'));
			const detailsButtonContainer = DOM.append(headerContainer, DOM.$('.dialog-message-button'));
			this._toggleMessageDetailButton = new Button(detailsButtonContainer);
			this._toggleMessageDetailButton.icon = 'message-details-icon';
			this._toggleMessageDetailButton.label = SHOW_DETAILS_TEXT;
			this._register(this._toggleMessageDetailButton.onDidClick(() => this.toggleMessageDetail()));
			const copyMessageButtonContainer = DOM.append(headerContainer, DOM.$('.dialog-message-button'));
			this._copyMessageButton = new Button(copyMessageButtonContainer);
			this._copyMessageButton.icon = 'copy-message-icon';
			this._copyMessageButton.label = COPY_TEXT;
			this._register(this._copyMessageButton.onDidClick(() => this._clipboardService.writeText(this.getTextForClipboard())));
			const closeMessageButtonContainer = DOM.append(headerContainer, DOM.$('.dialog-message-button'));
			this._closeMessageButton = new Button(closeMessageButtonContainer);
			this._closeMessageButton.icon = 'close-message-icon';
			this._closeMessageButton.label = CLOSE_TEXT;
			this._register(this._closeMessageButton.onDidClick(() => this.setError(undefined)));

			this._register(attachButtonStyler(this._toggleMessageDetailButton, this._themeService));
			this._register(attachButtonStyler(this._copyMessageButton, this._themeService));
			this._register(attachButtonStyler(this._closeMessageButton, this._themeService));

			const messageBody = DOM.append(this._messageElement, DOM.$('.dialog-message-body'));
			this._messageSummary = DOM.append(messageBody, DOM.$('.dialog-message-summary'));
			this._register(DOM.addDisposableListener(this._messageSummary, DOM.EventType.CLICK, () => this.toggleMessageDetail()));

			this._messageDetail = DOM.append(messageBody, DOM.$('.dialog-message-detail'));
			DOM.hide(this._messageDetail);
			DOM.hide(this._messageElement);

			if (this._useDefaultMessageBoxLocation) {
				DOM.append(modalContent, (this._messageElement));
			}
		}

		const modalBodyClass = (this._modalOptions.isAngular === false ? 'modal-body' : 'modal-body-and-footer');

		this._modalBodySection = DOM.append(modalContent, DOM.$(`.${modalBodyClass}`));
		this.renderBody(this._modalBodySection);

		// This modal footer section refers to the footer of of the dialog
		if (!this._modalOptions.isAngular) {
			this._modalFooterSection = DOM.append(modalContent, DOM.$('.modal-footer'));
			if (this._modalOptions.hasSpinner) {
				this._spinnerElement = DOM.append(this._modalFooterSection, DOM.$('.icon.in-progress'));
				DOM.hide(this._spinnerElement);
			}
			this._leftFooter = DOM.append(this._modalFooterSection, DOM.$('.left-footer'));
			this._rightFooter = DOM.append(this._modalFooterSection, DOM.$('.right-footer'));
		}
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
		const eol = this.textResourcePropertiesService.getEOL(URI.from({ scheme: Schemas.untitled }));
		return this._messageDetailText === '' ? this._messageSummaryText : `${this._messageSummaryText}${eol}========================${eol}${this._messageDetailText}`;
	}

	private updateExpandMessageState() {
		this._messageSummary.style.cursor = this.shouldShowExpandMessageButton ? 'pointer' : 'default';
		DOM.removeClass(this._messageSummary, MESSAGE_EXPANDED_MODE_CLASS);
		if (this.shouldShowExpandMessageButton) {
			DOM.show(this._toggleMessageDetailButton.element);
		} else {
			DOM.hide(this._toggleMessageDetailButton.element);
		}
	}

	private toggleMessageDetail() {
		const isExpanded = DOM.hasClass(this._messageSummary, MESSAGE_EXPANDED_MODE_CLASS);
		DOM.toggleClass(this._messageSummary, MESSAGE_EXPANDED_MODE_CLASS, !isExpanded);
		this._toggleMessageDetailButton.label = isExpanded ? SHOW_DETAILS_TEXT : localize('hideMessageDetails', "Hide Details");

		if (this._messageDetailText) {
			if (isExpanded) {
				DOM.hide(this._messageDetail);
			} else {
				DOM.show(this._messageDetail);
			}
		}
	}

	private get shouldShowExpandMessageButton(): boolean {
		return this._messageDetailText !== '' || this._messageSummary.scrollWidth > this._messageSummary.offsetWidth;
	}

	/**
	 * Set focusable elements in the modal dialog
	 */
	public setFocusableElements() {
		// try to find focusable element in dialog pane rather than overall container
		this._focusableElements = this._modalBodySection ?
			this._modalBodySection.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]') :
			this._bodyContainer.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]');
		if (this._focusableElements && this._focusableElements.length > 0) {
			this._firstFocusableElement = <HTMLElement>this._focusableElements[0];
			this._lastFocusableElement = <HTMLElement>this._focusableElements[this._focusableElements.length - 1];
		}

		this._focusedElementBeforeOpen = <HTMLElement>document.activeElement;
		this.focus();
	}

	/**
	 * Focuses the modal
	 * Default behavior: focus the first focusable element
	 */
	protected focus() {
		if (this._firstFocusableElement) {
			this._firstFocusableElement.focus();
		}
	}

	/**
	 * Shows the modal and attaches key listeners
	 */
	protected show() {
		this._modalShowingContext.get()!.push(this._staticKey);
		DOM.append(this.layoutService.container, this._bodyContainer);
		this.setFocusableElements();

		this._keydownListener = DOM.addDisposableListener(document, DOM.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			let context = this._modalShowingContext.get()!;
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
		TelemetryUtils.addTelemetry(this._telemetryService, this.logService, TelemetryKeys.ModalDialogOpened, { name: this._name });
	}

	/**
	 * Required to be implemented so that scrolling and other functions operate correctly. Should re-layout controls in the modal
	 */
	protected abstract layout(height: number): void;

	/**
	 * Hides the modal and removes key listeners
	 */
	protected hide() {
		this._modalShowingContext.get()!.pop();
		this._bodyContainer.remove();
		if (this._focusedElementBeforeOpen) {
			this._focusedElementBeforeOpen.focus();
		}
		this._keydownListener.dispose();
		this._resizeListener.dispose();
		TelemetryUtils.addTelemetry(this._telemetryService, this.logService, TelemetryKeys.ModalDialogClosed, { name: this._name });
	}

	/**
	 * Adds a button to the footer of the modal
	 * @param label Label to show on the button
	 * @param onSelect The callback to call when the button is selected
	 */
	protected addFooterButton(label: string, onSelect: () => void, orientation: 'left' | 'right' = 'right'): Button {
		let footerButton = DOM.$('.footer-button');
		let button = new Button(footerButton);
		button.label = label;
		button.onDidClick(() => onSelect()); // @todo this should be registered to dispose but that brakes some dialogs
		if (orientation === 'left') {
			DOM.append(this._leftFooter, footerButton);
		} else {
			DOM.append(this._rightFooter, footerButton);
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
	* removes the footer button matching the provided label
	* @param label Label on the button
	*/
	protected removeFooterButton(label: string): void {
		let buttonIndex = this._footerButtons.findIndex(e => {
			return e && e.element && e.element.innerText === label;
		});
		if (buttonIndex > -1 && buttonIndex < this._footerButtons.length) {
			let button = this._footerButtons[buttonIndex];
			DOM.removeNode(button.element);
			button.dispose();
			this._footerButtons.splice(buttonIndex, 1);
		}
	}

	/**
	 * Show an error in the error message element
	 * @param message Text to show in the message
	 * @param level Severity level of the message
	 * @param description Description of the message
	 */
	protected setError(message: string | undefined, level: MessageLevel = MessageLevel.Error, description: string = '') {
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
					DOM.toggleClass(this._messageIcon, level, selectedLevel === level);
					DOM.toggleClass(this._messageElement, level, selectedLevel === level);
				});

				this._messageIcon.title = severityText;
				this._messageSeverity.innerText = severityText;
				this._messageSummary.innerText = message!;
				this._messageSummary.title = message!;
				this._messageDetail.innerText = description;
			}
			DOM.hide(this._messageDetail);
			if (this._messageSummaryText) {
				DOM.show(this._messageElement);
			} else {
				DOM.hide(this._messageElement);
			}
			this.updateExpandMessageState();
		}
	}

	/**
	 * Set spinner element to show or hide
	 */
	public set spinner(show: boolean) {
		if (this._modalOptions.hasSpinner) {
			if (show) {
				DOM.show(this._spinnerElement);
			} else {
				DOM.hide(this._spinnerElement);
			}
		}
	}

	/**
	 * Return background color of header and footer
	 */
	protected get headerAndFooterBackground(): string | null {
		return this._dialogHeaderAndFooterBackground ? this._dialogHeaderAndFooterBackground.toString() : null;
	}

	/**
	 * Set the title of the modal
	 */
	protected set title(title: string) {
		if (this._title !== undefined) {
			this._modalTitle.innerText = title;
		}
	}

	protected get title(): string {
		return this._title;
	}

	/**
	 * Set the icon title class name
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
		const footerBorderTopWidth = border ? '1px' : null;
		const footerBorderTopStyle = border ? 'solid' : null;

		if (this._closeButtonInHeader) {
			this._closeButtonInHeader.style.color = foreground;
		}
		if (this._modalDialog) {
			this._modalDialog.style.color = foreground;
			this._modalDialog.style.borderWidth = border ? '1px' : null;
			this._modalDialog.style.borderStyle = border ? 'solid' : null;
			this._modalDialog.style.borderColor = border;
		}

		if (this._modalHeaderSection) {
			this._modalHeaderSection.style.backgroundColor = headerAndFooterBackground;
			this._modalHeaderSection.style.borderBottomWidth = border ? '1px' : null;
			this._modalHeaderSection.style.borderBottomStyle = border ? 'solid' : null;
			this._modalHeaderSection.style.borderBottomColor = border;
		}

		if (this._messageElement) {
			this._messageElement.style.backgroundColor = headerAndFooterBackground;
			this._messageElement.style.borderBottomWidth = border ? '1px' : null;
			this._messageElement.style.borderBottomStyle = border ? 'solid' : null;
			this._messageElement.style.borderBottomColor = border;
		}

		if (this._modalBodySection) {
			this._modalBodySection.style.backgroundColor = bodyBackground;
		}

		if (this._modalFooterSection) {
			this._modalFooterSection.style.backgroundColor = headerAndFooterBackground;
			this._modalFooterSection.style.borderTopWidth = footerBorderTopWidth;
			this._modalFooterSection.style.borderTopStyle = footerBorderTopStyle;
			this._modalFooterSection.style.borderTopColor = border;
		}
	}

	public dispose() {
		super.dispose();
		this._keydownListener.dispose();
		this._footerButtons = [];
	}
}
