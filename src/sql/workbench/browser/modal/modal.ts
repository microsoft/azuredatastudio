/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/calloutDialog';
import 'vs/css!./media/modal';
import { getFocusableElements, trapKeyboardNavigation } from 'sql/base/browser/dom';
import { Button } from 'sql/base/browser/ui/button/button';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { alert } from 'vs/base/browser/ui/aria/aria';
import { Color } from 'vs/base/common/color';
import { KeyCode } from 'vs/base/common/keyCodes';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import { mixin } from 'vs/base/common/objects';
import { IThemable } from 'vs/base/common/styler';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import { generateUuid } from 'vs/base/common/uuid';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { localize } from 'vs/nls';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IContextKey, IContextKeyService, RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ILogService } from 'vs/platform/log/common/log';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Emitter } from 'vs/base/common/event';

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
	dialogInteriorBorder?: Color;
	dialogExteriorBorder?: Color;
	dialogShadowColor?: Color;
}

export type DialogWidth = 'narrow' | 'medium' | 'wide' | number | string;
export type DialogStyle = 'normal' | 'flyout' | 'callout';
export type DialogPosition = 'left' | 'below' | 'above';

export interface IDialogProperties {
	xPos: number,
	yPos: number,
	width: number,
	height: number
}

export interface IModalOptions {
	dialogStyle?: DialogStyle;
	dialogPosition?: DialogPosition;
	width?: DialogWidth;
	isAngular?: boolean;
	hasBackButton?: boolean;
	hasTitleIcon?: boolean;
	hasErrors?: boolean;
	hasSpinner?: boolean;
	spinnerTitle?: string;
	renderHeader?: boolean;
	renderFooter?: boolean;
	dialogProperties?: IDialogProperties;
}

const defaultOptions: IModalOptions = {
	dialogStyle: 'flyout',
	dialogPosition: undefined,
	width: 'narrow',
	isAngular: false,
	hasBackButton: false,
	hasTitleIcon: false,
	hasErrors: false,
	hasSpinner: false,
	renderHeader: true,
	renderFooter: true,
	dialogProperties: undefined
};

export type HideReason = 'close' | 'cancel' | 'ok';

export abstract class Modal extends Disposable implements IThemable {
	protected _useDefaultMessageBoxLocation: boolean = true;
	private _styleElement: HTMLStyleElement;
	protected _messageElement?: HTMLElement;
	protected _modalOptions: IModalOptions;
	protected readonly disposableStore = this._register(new DisposableStore());
	private _detailsButtonContainer?: HTMLElement;
	private _messageIcon?: HTMLElement;
	private _messageSeverity?: HTMLElement;
	private _messageSummary?: HTMLElement;
	private _messageBody?: HTMLElement;
	private _messageDetail?: HTMLElement;
	private _toggleMessageDetailButton?: Button;
	private _copyMessageButton?: Button;
	private _closeMessageButton?: Button;
	private _messageSummaryText?: string;
	private _messageDetailText?: string;

	private _spinnerElement?: HTMLElement;
	private _focusedElementBeforeOpen?: HTMLElement;

	private _dialogForeground?: Color;
	private _dialogBorder?: Color;
	private _dialogHeaderAndFooterBackground?: Color;
	private _dialogBodyBackground?: Color;
	private _dialogInteriorBorder?: Color;
	private _dialogExteriorBorder?: Color;
	private _dialogShadowColor?: Color;

	private _modalDialog?: HTMLElement;
	private _modalContent?: HTMLElement;
	private _modalHeaderSection?: HTMLElement;
	private _modalBodySection?: HTMLElement;
	private _modalFooterSection?: HTMLElement;
	private _closeButtonInHeader?: HTMLElement;
	protected _bodyContainer?: HTMLElement;
	private _modalTitle?: HTMLElement;
	private _modalTitleIcon?: HTMLElement;
	private _leftFooter?: HTMLElement;
	private _rightFooter?: HTMLElement;
	private _footerButtons: Button[] = [];
	private _backButton?: Button;

	private _modalShowingContext: IContextKey<Array<string>>;
	private readonly _staticKey: string;

	private _onClosed = new Emitter<HideReason>();
	public onClosed = this._onClosed.event;

	/**
	 * Get the back button, only available after render and if the hasBackButton option is true
	 */
	protected get backButton(): Button | undefined {
		return this._backButton;
	}

	/**
	 * Set the dialog to have wide layout dynamically.
	 * Temporary solution to render file browser as wide or narrow layout.
	 * This will be removed once backup dialog is changed to wide layout.
	 * (hyoshi - 10/2/2017 tracked by https://github.com/Microsoft/carbon/issues/1836)
	 */
	public setWide(isWide: boolean): void {
		this._bodyContainer!.classList.toggle('wide', isWide);
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
		protected readonly _telemetryService: IAdsTelemetryService,
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
	}

	/**
	 * Build and render the modal, will call {@link Modal#renderBody}
	 *
	 */
	public render() {
		this._styleElement = DOM.createStyleSheet(this._bodyContainer);

		let top: number;
		let builderClass = '.modal.fade';
		builderClass += this._modalOptions.dialogStyle === 'flyout' ? '.flyout-dialog'
			: this._modalOptions.dialogStyle === 'callout' ? '.callout-dialog'
				: '';

		this._bodyContainer = DOM.$(`${builderClass}`, { role: 'dialog', 'aria-label': this._title });

		if (this._modalOptions.dialogStyle === 'callout') {
			top = 0;
		} else {
			top = this.layoutService.offset?.top ?? 0;
		}
		this._bodyContainer.style.top = `${top}px`;
		this._modalDialog = DOM.append(this._bodyContainer, DOM.$('.modal-dialog'));

		if (this._modalOptions.dialogStyle === 'callout') {
			let arrowClass = `.callout-arrow.from-${this._modalOptions.dialogPosition}`;
			this._modalContent = DOM.append(this._modalDialog, DOM.$(`.modal-content${arrowClass}`));
		} else {
			this._modalContent = DOM.append(this._modalDialog, DOM.$('.modal-content'));
		}

		if (typeof this._modalOptions.width === 'number') {
			this._modalDialog.style.width = `${this._modalOptions.width}px`;
		} else if (this._modalOptions.width === 'narrow'
			|| this._modalOptions.width === 'medium'
			|| this._modalOptions.width === 'wide') {
			this._modalDialog.classList.add(`${this._modalOptions.width}-dialog`);
		} else {
			this._modalDialog.style.width = this._modalOptions.width;
		}

		if (this._modalOptions.dialogStyle === 'callout') {
			this._register(DOM.addDisposableListener(this._bodyContainer, DOM.EventType.CLICK, (e) => this.handleClickOffModal(e)));
		}

		if (!isUndefinedOrNull(this._title)) {
			if (this._modalOptions.renderHeader || this._modalOptions.renderHeader === undefined) {
				this._modalHeaderSection = DOM.append(this._modalContent, DOM.$('.modal-header'));
				if (this._modalOptions.hasBackButton) {
					const container = DOM.append(this._modalHeaderSection, DOM.$('.modal-go-back'));
					this._backButton = new Button(container, { secondary: true });
					this._backButton.icon = {
						id: 'backButtonIcon'
					};
					this._backButton.title = localize('modal.back', "Back");
				}

				if (this._modalOptions.hasTitleIcon) {
					this._modalTitleIcon = DOM.append(this._modalHeaderSection, DOM.$('.modal-title-icon'));
				}

				this._modalTitle = DOM.append(this._modalHeaderSection, DOM.$('h1.modal-title'));
				this._modalTitle.innerText = this._title;
			}
		}

		if (!this._modalOptions.isAngular && this._modalOptions.hasErrors) {
			this._messageElement = DOM.$('.dialog-message.error', { role: 'alert' });
			const headerContainer = DOM.append(this._messageElement, DOM.$('.dialog-message-header'));
			this._messageIcon = DOM.append(headerContainer, DOM.$('.dialog-message-icon'));
			this._messageSeverity = DOM.append(headerContainer, DOM.$('.dialog-message-severity'));
			this._detailsButtonContainer = DOM.append(headerContainer, DOM.$('.dialog-message-button'));
			this._toggleMessageDetailButton = new Button(this._detailsButtonContainer);
			this._toggleMessageDetailButton.icon = {
				id: 'message-details-icon'
			};
			this._toggleMessageDetailButton.label = SHOW_DETAILS_TEXT;
			this._register(this._toggleMessageDetailButton.onDidClick(() => this.toggleMessageDetail()));
			const copyMessageButtonContainer = DOM.append(headerContainer, DOM.$('.dialog-message-button'));
			this._copyMessageButton = new Button(copyMessageButtonContainer);
			this._copyMessageButton.icon = {
				id: 'copy-message-icon'
			};
			this._copyMessageButton.label = COPY_TEXT;
			this._register(this._copyMessageButton.onDidClick(() => this._clipboardService.writeText(this.getTextForClipboard())));
			const closeMessageButtonContainer = DOM.append(headerContainer, DOM.$('.dialog-message-button'));
			this._closeMessageButton = new Button(closeMessageButtonContainer);
			this._closeMessageButton.icon = {
				id: 'close-message-icon'
			};
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

		if (this._modalOptions.renderFooter !== false) {
			if (!this._modalOptions.isAngular) {
				this._modalFooterSection = DOM.append(this._modalContent, DOM.$('.modal-footer'));
				if (this._modalOptions.hasSpinner) {
					this._spinnerElement = DOM.append(this._modalFooterSection, DOM.$('.codicon.in-progress'));
					this._spinnerElement.setAttribute('title', this._modalOptions.spinnerTitle ?? '');
					DOM.hide(this._spinnerElement);
				}
				this._leftFooter = DOM.append(this._modalFooterSection, DOM.$('.left-footer'));
				this._rightFooter = DOM.append(this._modalFooterSection, DOM.$('.right-footer'));
			}
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
	protected onClose(e?: StandardKeyboardEvent) {
		this.hide('close');
	}

	/**
	 * Used to close modal when a click occurs outside the modal.
	 * This is exclusive to the Callout.
	 * @param e The Callout modal click event
	 */
	private handleClickOffModal(e: MouseEvent): void {
		const target = e.target as HTMLElement;
		if (target.closest('.modal-content')) {
			return;
		} else {
			this.hide('close');
		}
	}

	/**
	 * Overridable to change behavior of enter key
	 */
	protected onAccept(e?: StandardKeyboardEvent) {
		this.hide('ok');
	}

	private getTextForClipboard(): string {
		const eol = this.textResourcePropertiesService.getEOL(URI.from({ scheme: Schemas.untitled }));
		return this._messageDetailText === '' ? this._messageSummaryText! : `${this._messageSummaryText}${eol}========================${eol}${this._messageDetailText}`;
	}

	private updateExpandMessageState() {
		this._messageSummary!.style.cursor = this.shouldShowExpandMessageButton ? 'pointer' : 'default';
		this._messageSummary!.classList.remove(MESSAGE_EXPANDED_MODE_CLASS);
		if (this.shouldShowExpandMessageButton) {
			DOM.append(this._detailsButtonContainer!, this._toggleMessageDetailButton!.element);
		} else {
			this._toggleMessageDetailButton!.element.remove();
		}
	}

	private toggleMessageDetail() {
		const isExpanded = this._messageSummary!.classList.contains(MESSAGE_EXPANDED_MODE_CLASS);
		this._messageSummary!.classList.toggle(MESSAGE_EXPANDED_MODE_CLASS, !isExpanded);
		this._toggleMessageDetailButton!.label = isExpanded ? SHOW_DETAILS_TEXT : localize('hideMessageDetails', "Hide Details");

		if (this._messageDetailText) {
			if (isExpanded) {
				this._messageDetail!.remove();
			} else {
				DOM.append(this._messageBody!, this._messageDetail!);
			}
		}
	}

	private get shouldShowExpandMessageButton(): boolean {
		return this._messageDetailText !== '' || this._messageSummary!.scrollWidth > this._messageSummary!.offsetWidth;
	}

	/**
	 * Set focusable elements in the modal dialog
	 */
	public setInitialFocusedElement() {
		const focusableElements = getFocusableElements(this._modalDialog!);
		if (focusableElements?.length > 0) {
			focusableElements[0].focus();
		}
	}

	/**
	 * Tasks to perform before callout dialog is shown
	 * Includes: positioning of dialog
	 */
	protected positionCalloutDialog(): void {
		/**
		 * In the case of 'below', dialog will be positioned beneath the trigger and arrow aligned with trigger.
		 * In the case of 'left', dialog will be positioned left of the trigger and arrow aligned with trigger.
		 */
		let dialogWidth;
		if (typeof this._modalOptions.width === 'number') {
			dialogWidth = this._modalOptions.width;
		}

		if (this._modalOptions.dialogPosition === 'above') {
			if (this._modalOptions.dialogProperties) {
				this._modalDialog.style.left = `${this._modalOptions.dialogProperties.xPos - this._modalOptions.dialogProperties.width}px`;
				this._modalDialog.style.top = `${this._modalOptions.dialogProperties.yPos - 235}px`;
			} else {
				this._modalDialog.style.left = `${this._modalOptions.dialogProperties.xPos}px`;
				this._modalDialog.style.top = `${this._modalOptions.dialogProperties.yPos - 235}px`;
			}
		} else if (this._modalOptions.dialogPosition === 'below') {
			if (this._modalOptions.dialogProperties) {
				this._modalDialog.style.left = `${this._modalOptions.dialogProperties.xPos - this._modalOptions.dialogProperties.width}px`;
				this._modalDialog.style.top = `${this._modalOptions.dialogProperties.yPos + (this._modalOptions.dialogProperties.height)}px`;
			} else {
				this._modalDialog.style.left = `${this._modalOptions.dialogProperties.xPos}px`;
				this._modalDialog.style.top = `${this._modalOptions.dialogProperties.yPos}px`;
			}
		} else if (this._modalOptions.dialogPosition === 'left') {
			if (this._modalOptions.dialogProperties) {
				this._modalDialog.style.left = `${this._modalOptions.dialogProperties.xPos - (dialogWidth + this._modalOptions.dialogProperties.width)}px`;
				this._modalDialog.style.top = `${this._modalOptions.dialogProperties.yPos - this._modalOptions.dialogProperties.height * 2}px`;
			} else {
				this._modalDialog.style.left = `${this._modalOptions.dialogProperties.xPos - (dialogWidth)}px`;
				this._modalDialog.style.top = `${this._modalOptions.dialogProperties.yPos}px`;
			}
		}

		this._modalDialog.style.width = `${dialogWidth}px`;
	}

	/**
	 * Shows the modal and attaches key listeners
	 * @param source Where the modal was opened from for telemetry (ex: command palette, context menu)
	 */
	protected show(source?: string) {
		if (this._modalOptions.dialogStyle === 'callout') {
			this.positionCalloutDialog();
		}
		this._focusedElementBeforeOpen = <HTMLElement>document.activeElement;
		this._modalShowingContext.get()!.push(this._staticKey);
		DOM.append(this.layoutService.container, this._bodyContainer!);
		this.setInitialFocusedElement();

		this.disposableStore.add(DOM.addDisposableListener(document, DOM.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			let context = this._modalShowingContext.get()!;
			if (context[context.length - 1] === this._staticKey) {
				let event = new StandardKeyboardEvent(e);
				if (event.equals(KeyCode.Enter)) {
					DOM.EventHelper.stop(e, true);
					this.onAccept(event);
				} else if (event.equals(KeyCode.Escape)) {
					DOM.EventHelper.stop(e, true);
					this.onClose(event);
				}
			}
		}));
		this.disposableStore.add(trapKeyboardNavigation(this._modalDialog!));
		this.disposableStore.add(DOM.addDisposableListener(window, DOM.EventType.RESIZE, e => {
			this.layout(DOM.getTotalHeight(this._modalBodySection!));
		}));

		this.layout(DOM.getTotalHeight(this._modalBodySection!));
		this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.TelemetryAction.ModalDialogOpened, undefined, source)
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
	protected hide(reason: HideReason = 'close', currentPageName?: string): void {
		this._modalShowingContext.get()!.pop();
		this._bodyContainer!.remove();
		this.disposableStore.clear();
		this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.TelemetryAction.ModalDialogClosed)
			.withAdditionalProperties({
				name: this._name,
				reason: reason,
				currentPageName: currentPageName
			})
			.send();
		this.restoreKeyboardFocus();
		this._onClosed.fire(reason);
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
	 * @param position The position of the button. Optional values: 'left', 'right'. Default value is 'right'
	 * @param isSecondary Indicates whether the button is a secondary button
	 * @param index If specified, the button will be inserted at the specified index
	 */
	protected addFooterButton(label: string, onSelect: () => void, position: 'left' | 'right' = 'right', isSecondary: boolean = false, index?: number): Button {
		let footerButton = DOM.$('.footer-button');
		let button = this._register(new Button(footerButton, { secondary: isSecondary }));
		button.label = label;
		button.onDidClick(() => onSelect()); // @todo this should be registered to dispose but that brakes some dialogs
		const container = position === 'left' ? this._leftFooter! : this._rightFooter!;
		const buttonIndex = index !== undefined && index <= container.childElementCount ? index : container.childElementCount;
		if (buttonIndex < container.childElementCount) {
			const insertBefore = container.children.item(buttonIndex);
			container.insertBefore(footerButton, insertBefore);
		} else {
			DOM.append(container, footerButton);
		}
		attachButtonStyler(button, this._themeService);
		this._footerButtons.push(button);
		return button;
	}

	/**
	 * Returns a footer button matching the provided label
	 * @param label Label to show on the button
	 * @param onSelect The callback to call when the button is selected
	 */
	protected findFooterButton(label: string): Button | undefined {
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
			button.element.parentElement.remove(); // The parent element of the button is the top level element we added to the footer button container.
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
					this._messageIcon!.classList.toggle(level, selectedLevel === level);
					this._messageElement!.classList.toggle(level, selectedLevel === level);
				});

				this._messageIcon!.title = severityText;
				this._messageSeverity!.innerText = severityText;
				this._messageSummary!.innerText = message!;
				this._messageSummary!.title = message!;
				this._messageDetail!.innerText = description;
			}
			this._messageDetail!.remove();
			this.messagesElementVisible = !!this._messageSummaryText;
			// Read out the description to screen readers so they don't have to
			// search around for the alert box to hear the extra information
			if (description) {
				alert(description);
			}
			this.updateExpandMessageState();
		}
	}

	protected set messagesElementVisible(visible: boolean) {
		if (visible) {
			if (this._useDefaultMessageBoxLocation) {
				DOM.prepend(this._modalContent!, this._messageElement!);
			}
		} else {
			// only do the removal when the messageElement has parent element.
			if (this._messageElement!.parentElement) {
				// Reset the focus if keyboard focus is currently in the message area.
				const resetFocus = DOM.isAncestor(document.activeElement, this._messageElement!);
				this._messageElement!.remove();
				if (resetFocus) {
					this.setInitialFocusedElement();
				}
			}
		}
	}

	/**
	 * Set spinner element to show or hide
	 */
	public set spinner(show: boolean) {
		if (this._modalOptions.hasSpinner) {
			if (show) {
				DOM.show(this._spinnerElement!);
				if (this._modalOptions.spinnerTitle) {
					alert(this._modalOptions.spinnerTitle);
				}
			} else {
				DOM.hide(this._spinnerElement!);
			}
		}
	}

	/**
	 * Return background color of header and footer
	 */
	protected get headerAndFooterBackground(): string | undefined {
		return this._dialogHeaderAndFooterBackground ? this._dialogHeaderAndFooterBackground.toString() : undefined;
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
		this._dialogInteriorBorder = styles.dialogInteriorBorder;
		this._dialogExteriorBorder = styles.dialogExteriorBorder;
		this._dialogShadowColor = styles.dialogShadowColor;
		this.applyStyles();
	}

	private applyStyles(): void {
		const foreground = this._dialogForeground ? this._dialogForeground.toString() : '';
		const border = this._dialogBorder ? this._dialogBorder.toString() : '';
		const headerAndFooterBackground = this._dialogHeaderAndFooterBackground ? this._dialogHeaderAndFooterBackground.toString() : '';
		const bodyBackground = this._dialogBodyBackground ? this._dialogBodyBackground.toString() : '';
		const footerBorderTopWidth = border ? '1px' : '';
		const footerBorderTopStyle = border ? 'solid' : '';

		if (this._closeButtonInHeader) {
			this._closeButtonInHeader.style.color = foreground;
		}
		if (this._modalDialog) {
			this._modalDialog.style.color = foreground;
			this._modalDialog.style.borderWidth = border ? '1px' : '';
			this._modalDialog.style.borderStyle = border ? 'solid' : '';
			this._modalDialog.style.borderColor = border;
		}

		if (this._modalHeaderSection) {
			this._modalHeaderSection.style.backgroundColor = headerAndFooterBackground;
			if (!(this._modalOptions.dialogStyle === 'callout')) {
				this._modalHeaderSection.style.borderBottomWidth = border ? '1px' : '';
				this._modalHeaderSection.style.borderBottomStyle = border ? 'solid' : '';
			}
			this._modalHeaderSection.style.borderBottomColor = border;
		}

		if (this._messageElement) {
			this._messageElement.style.backgroundColor = headerAndFooterBackground;
			this._messageElement.style.borderBottomWidth = border ? '1px' : '';
			this._messageElement.style.borderBottomStyle = border ? 'solid' : '';
			this._messageElement.style.borderBottomColor = border;
		}

		if (this._modalBodySection) {
			this._modalBodySection.style.backgroundColor = bodyBackground;
		}

		if (this._modalFooterSection) {
			this._modalFooterSection.style.backgroundColor = headerAndFooterBackground;
			this._modalFooterSection.style.borderTopWidth = footerBorderTopWidth;
			this._modalFooterSection.style.borderTopStyle = footerBorderTopStyle;
			if (!(this._modalOptions.dialogStyle === 'callout')) {
				this._modalFooterSection.style.borderTopColor = border;
			}
		}

		if (this._modalOptions.dialogStyle === 'callout') {
			const content: string[] = [];
			const exteriorBorder = this._dialogExteriorBorder ? this._dialogExteriorBorder.toString() : '';
			const exteriorBorderRgb: Color = Color.Format.CSS.parseHex(exteriorBorder);
			const shadow = this._dialogShadowColor ? this._dialogShadowColor.toString() : '';
			const shadowRgb: Color = Color.Format.CSS.parseHex(shadow);

			if (exteriorBorderRgb && shadowRgb) {
				content.push(`
				.modal.callout-dialog .modal-dialog {
					border-color: rgba(${exteriorBorderRgb.rgba.r}, ${exteriorBorderRgb.rgba.g}, ${exteriorBorderRgb.rgba.b},0.5);
					box-shadow: 0px 3.2px 7.2px rgba(${shadowRgb.rgba.r}, ${shadowRgb.rgba.g}, ${shadowRgb.rgba.b}, 0.132),
								0px 0.6px 1.8px rgba(${shadowRgb.rgba.r}, ${shadowRgb.rgba.g}, ${shadowRgb.rgba.b}, 0.108);
				}
				.hc-black .modal.callout-dialog .modal-dialog {
					border-color: rgba(${exteriorBorderRgb.rgba.r}, ${exteriorBorderRgb.rgba.g}, ${exteriorBorderRgb.rgba.b}, 1);
				}
				.modal.callout-dialog .modal-footer {
					border-top-color: ${this._dialogInteriorBorder};
				}
				.callout-arrow:before {
					background-color: ${this._dialogBodyBackground};
					border-color: transparent transparent rgba(${exteriorBorderRgb.rgba.r}, ${exteriorBorderRgb.rgba.g}, ${exteriorBorderRgb.rgba.b}, 0.5) rgba(${exteriorBorderRgb.rgba.r}, ${exteriorBorderRgb.rgba.g}, ${exteriorBorderRgb.rgba.b}, 0.5);
				}
				.hc-black .callout-arrow:before {
					border-color: transparent transparent rgba(${exteriorBorderRgb.rgba.r}, ${exteriorBorderRgb.rgba.g}, ${exteriorBorderRgb.rgba.b}, 1) rgba(${exteriorBorderRgb.rgba.r}, ${exteriorBorderRgb.rgba.g}, ${exteriorBorderRgb.rgba.b}, 1);
				}
				.callout-arrow.from-left:before {
					background-color: ${this._dialogBodyBackground};
					box-shadow: -4px 4px 4px rgba(${shadowRgb.rgba.r}, ${shadowRgb.rgba.g}, ${shadowRgb.rgba.b}, 0.05);
				}`);
			}

			const newStyles = content.join('\n');
			if (newStyles !== this._styleElement.innerHTML) {
				this._styleElement.innerHTML = newStyles;
			}
		}
	}

	public override dispose() {
		super.dispose();
		this._footerButtons = [];
	}
}
