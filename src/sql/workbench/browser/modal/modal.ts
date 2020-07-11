/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/modal';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { Color } from 'vs/base/common/color';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { mixin } from 'vs/base/common/objects';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { generateUuid } from 'vs/base/common/uuid';
import { IContextKeyService, RawContextKey, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';

import { Button } from 'sql/base/browser/ui/button/button';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { localize } from 'vs/nls';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { URI } from 'vs/base/common/uri';
import { Schemas } from 'vs/base/common/network';
import { find, firstIndex } from 'vs/base/common/arrays';
import { IThemable } from 'vs/base/common/styler';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { alert } from 'vs/base/browser/ui/aria/aria';

export enum MessageLevel {
	Error = 0,
	Warning = 1,
	Information = 2
}

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

export type DialogWidth = 'narrow' | 'medium' | 'wide' | number;

export interface IModalOptions {
	isFlyout?: boolean;
	width?: DialogWidth;
	isAngular?: boolean;
	hasBackButton?: boolean;
	hasTitleIcon?: boolean;
	hasErrors?: boolean;
	hasSpinner?: boolean;
	spinnerTitle?: string;
}

const defaultOptions: IModalOptions = {
	isFlyout: true,
	width: 'narrow',
	isAngular: false,
	hasBackButton: false,
	hasTitleIcon: false,
	hasErrors: false,
	hasSpinner: false
};

const tabbableElementsQuerySelector = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]';

export abstract class Modal extends Disposable implements IThemable {
	protected _useDefaultMessageBoxLocation: boolean = true;
	protected _messageElement: HTMLElement;
	protected _modalOptions: IModalOptions;
	protected readonly disposableStore = this._register(new DisposableStore());
	private _detailsButtonContainer: HTMLElement;
	private _messageIcon: HTMLElement;
	private _messageSeverity: HTMLElement;
	private _messageSummary: HTMLElement;
	private _messageBody: HTMLElement;
	private _messageDetail: HTMLElement;
	private _toggleMessageDetailButton: Button;
	private _copyMessageButton: Button;
	private _closeMessageButton: Button;
	private _messageSummaryText: string;
	private _messageDetailText: string;

	private _spinnerElement: HTMLElement;
	private _firstTabbableElement: HTMLElement; // The first element in the dialog the user could tab to
	private _lastTabbableElement: HTMLElement; // The last element in the dialog the user could tab to
	private _focusedElementBeforeOpen: HTMLElement;

	private _dialogForeground?: Color;
	private _dialogBorder?: Color;
	private _dialogHeaderAndFooterBackground?: Color;
	private _dialogBodyBackground?: Color;

	private _modalDialog: HTMLElement;
	private _modalContent: HTMLElement;
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
		private readonly _telemetryService: IAdsTelemetryService,
		protected readonly layoutService: ILayoutService,
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

		this._bodyContainer = DOM.$(`.${builderClass}`, { role: 'dialog', 'aria-label': this._title });
		const top = this.layoutService.offset?.top ?? 0;
		this._bodyContainer.style.top = `${top}px`;
		this._modalDialog = DOM.append(this._bodyContainer, DOM.$('.modal-dialog'));
		this._modalContent = DOM.append(this._modalDialog, DOM.$('.modal-content'));

		if (typeof this._modalOptions.width === 'number') {
			this._modalDialog.style.width = `${this._modalOptions.width}px`;
		} else {
			this._modalDialog.classList.add(`${this._modalOptions.width}-dialog`);
		}

		if (!isUndefinedOrNull(this._title)) {
			this._modalHeaderSection = DOM.append(this._modalContent, DOM.$('.modal-header'));
			if (this._modalOptions.hasBackButton) {
				const container = DOM.append(this._modalHeaderSection, DOM.$('.modal-go-back'));
				this._backButton = new Button(container);
				this._backButton.icon = 'backButtonIcon';
				this._backButton.title = localize('modal.back', "Back");
			}

			if (this._modalOptions.hasTitleIcon) {
				this._modalTitleIcon = DOM.append(this._modalHeaderSection, DOM.$('.modal-title-icon'));
			}

			this._modalTitle = DOM.append(this._modalHeaderSection, DOM.$('h1.modal-title'));
			this._modalTitle.innerText = this._title;
		}

		if (!this._modalOptions.isAngular && this._modalOptions.hasErrors) {
			this._messageElement = DOM.$('.dialog-message.error', { role: 'alert' });
			const headerContainer = DOM.append(this._messageElement, DOM.$('.dialog-message-header'));
			this._messageIcon = DOM.append(headerContainer, DOM.$('.dialog-message-icon'));
			this._messageSeverity = DOM.append(headerContainer, DOM.$('.dialog-message-severity'));
			this._detailsButtonContainer = DOM.append(headerContainer, DOM.$('.dialog-message-button'));
			this._toggleMessageDetailButton = new Button(this._detailsButtonContainer);
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

			this._messageBody = DOM.append(this._messageElement, DOM.$('.dialog-message-body'));
			this._messageSummary = DOM.append(this._messageBody, DOM.$('.dialog-message-summary'));
			this._register(DOM.addDisposableListener(this._messageSummary, DOM.EventType.CLICK, () => this.toggleMessageDetail()));

			this._messageDetail = DOM.$('.dialog-message-detail');
		}

		const modalBodyClass = (this._modalOptions.isAngular === false ? 'modal-body' : 'modal-body-and-footer');

		this._modalBodySection = DOM.append(this._modalContent, DOM.$(`.${modalBodyClass}`));
		this.renderBody(this._modalBodySection);

		// This modal footer section refers to the footer of of the dialog
		if (!this._modalOptions.isAngular) {
			this._modalFooterSection = DOM.append(this._modalContent, DOM.$('.modal-footer'));
			if (this._modalOptions.hasSpinner) {
				this._spinnerElement = DOM.append(this._modalFooterSection, DOM.$('.codicon.in-progress'));
				this._spinnerElement.setAttribute('title', this._modalOptions.spinnerTitle);
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
		this.setFirstLastTabbableElement(); // called every time to get the current elements
		if (this._firstTabbableElement && this._lastTabbableElement && document.activeElement === this._firstTabbableElement) {
			e.preventDefault();
			this._lastTabbableElement.focus();
		}
	}

	private handleForwardTab(e: KeyboardEvent) {
		this.setFirstLastTabbableElement(); // called everytime to get the current elements
		if (this._firstTabbableElement && this._lastTabbableElement && document.activeElement === this._lastTabbableElement) {
			e.preventDefault();
			this._firstTabbableElement.focus();
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
			DOM.append(this._detailsButtonContainer, this._toggleMessageDetailButton.element);
		} else {
			DOM.removeNode(this._toggleMessageDetailButton.element);
		}
	}

	private toggleMessageDetail() {
		const isExpanded = DOM.hasClass(this._messageSummary, MESSAGE_EXPANDED_MODE_CLASS);
		DOM.toggleClass(this._messageSummary, MESSAGE_EXPANDED_MODE_CLASS, !isExpanded);
		this._toggleMessageDetailButton.label = isExpanded ? SHOW_DETAILS_TEXT : localize('hideMessageDetails', "Hide Details");

		if (this._messageDetailText) {
			if (isExpanded) {
				DOM.removeNode(this._messageDetail);
			} else {
				DOM.append(this._messageBody, this._messageDetail);
			}
		}
	}

	private get shouldShowExpandMessageButton(): boolean {
		return this._messageDetailText !== '' || this._messageSummary.scrollWidth > this._messageSummary.offsetWidth;
	}

	/**
	 * Figures out the first and last elements which the user can tab to in the dialog
	 */
	public setFirstLastTabbableElement() {
		const tabbableElements = this._bodyContainer.querySelectorAll(tabbableElementsQuerySelector);
		if (tabbableElements && tabbableElements.length > 0) {
			this._firstTabbableElement = <HTMLElement>tabbableElements[0];
			this._lastTabbableElement = <HTMLElement>tabbableElements[tabbableElements.length - 1];
		}
	}

	/**
	 * Set focusable elements in the modal dialog
	 */
	public setInitialFocusedElement() {
		// Try to find focusable element in dialog pane rather than overall container. _modalBodySection contains items in the pane for a wizard.
		// This ensures that we are setting the focus on a useful element in the form when possible.
		const focusableElements = this._modalBodySection ?
			this._modalBodySection.querySelectorAll(tabbableElementsQuerySelector) :
			this._bodyContainer.querySelectorAll(tabbableElementsQuerySelector);

		if (focusableElements && focusableElements.length > 0) {
			(<HTMLElement>focusableElements[0]).focus();
		}
	}

	/**
	 * Shows the modal and attaches key listeners
	 */
	protected show() {
		this._focusedElementBeforeOpen = <HTMLElement>document.activeElement;
		this._modalShowingContext.get()!.push(this._staticKey);
		DOM.append(this.layoutService.container, this._bodyContainer);
		this.setInitialFocusedElement();

		this.disposableStore.add(DOM.addDisposableListener(document, DOM.EventType.KEY_DOWN, (e: KeyboardEvent) => {
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
		}));
		this.disposableStore.add(DOM.addDisposableListener(window, DOM.EventType.RESIZE, (e: Event) => {
			this.layout(DOM.getTotalHeight(this._modalBodySection));
		}));

		this.layout(DOM.getTotalHeight(this._modalBodySection));
		this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.ModalDialogOpened)
			.withAdditionalProperties({ name: this._name })
			.send();
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
		this.disposableStore.clear();
		this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.ModalDialogClosed)
			.withAdditionalProperties({ name: this._name })
			.send();
		this.restoreKeyboardFocus();
	}

	private restoreKeyboardFocus() {
		if (this._focusedElementBeforeOpen) {
			this._focusedElementBeforeOpen.focus();
		}
	}

	/**
	 * Adds a button to the footer of the modal
	 * @param label Label to show on the button
	 * @param onSelect The callback to call when the button is selected
	 */
	protected addFooterButton(label: string, onSelect: () => void, orientation: 'left' | 'right' = 'right'): Button {
		let footerButton = DOM.$('.footer-button');
		let button = this._register(new Button(footerButton));
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
		return find(this._footerButtons, e => {
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
		let buttonIndex = firstIndex(this._footerButtons, e => {
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
			DOM.removeNode(this._messageDetail);
			this.messagesElementVisible = !!this._messageSummaryText;
			this.updateExpandMessageState();
		}
	}

	protected set messagesElementVisible(visible: boolean) {
		if (visible) {
			if (this._useDefaultMessageBoxLocation) {
				DOM.prepend(this._modalContent, (this._messageElement));
			}
		} else {
			DOM.removeNode(this._messageElement);
			// Set the focus to first focus element if the focus is not within the dialog
			if (!DOM.isAncestor(document.activeElement, this._bodyContainer)) {
				this.setInitialFocusedElement();
			}
		}
	}

	/**
	 * Set spinner element to show or hide
	 */
	public set spinner(show: boolean) {
		if (this._modalOptions.hasSpinner) {
			if (show) {
				DOM.show(this._spinnerElement);
				if (this._modalOptions.spinnerTitle) {
					alert(this._modalOptions.spinnerTitle);
				}
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
		this._title = title;
		if (this._modalTitle) {
			this._modalTitle.innerText = title;
		}
		if (this._bodyContainer) {
			this._bodyContainer.setAttribute('aria-label', title);
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
		this._footerButtons = [];
	}
}
