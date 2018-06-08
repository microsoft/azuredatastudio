/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { SelectBox, ISelectBoxStyles } from 'vs/base/browser/ui/selectBox/selectBox';
import { Color } from 'vs/base/common/color';
import { IMessage, MessageType, defaultOpts } from 'vs/base/browser/ui/inputbox/inputBox';
import * as dom from 'vs/base/browser/dom';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IContextViewProvider, AnchorAlignment } from 'vs/base/browser/ui/contextview/contextview';
import { RenderOptions, renderFormattedText, renderText } from 'vs/base/browser/htmlContentRenderer';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';

const $ = dom.$;

export interface IListBoxStyles {
	selectBackground?: Color;
	selectForeground?: Color;
	selectBorder?: Color;
	inputValidationInfoBorder?: Color;
	inputValidationInfoBackground?: Color;
	inputValidationWarningBorder?: Color;
	inputValidationWarningBackground?: Color;
	inputValidationErrorBorder?: Color;
	inputValidationErrorBackground?: Color;
}

/*
*  Extends SelectBox to allow multiple selection and adding/remove items dynamically
*/
export class ListBox extends SelectBox {
	private enabledSelectBackground: Color;
	private enabledSelectForeground: Color;
	private enabledSelectBorder: Color;
	private disabledSelectBackground: Color;
	private disabledSelectForeground: Color;
	private disabledSelectBorder: Color;

	private inputValidationInfoBorder: Color;
	private inputValidationInfoBackground: Color;
	private inputValidationWarningBorder: Color;
	private inputValidationWarningBackground: Color;
	private inputValidationErrorBorder: Color;
	private inputValidationErrorBackground: Color;

	private message: IMessage;
	private contextViewProvider: IContextViewProvider;
	private isValid: boolean;

	constructor(
		options: string[],
		selectedOption: string,
		contextViewProvider: IContextViewProvider,
		private _clipboardService: IClipboardService) {

		super(options, 0, contextViewProvider);
		this.contextViewProvider = contextViewProvider;
		this.isValid = true;
		this.selectElement.multiple = true;
		this.selectElement.style['height'] = '80px';

		// Set width style for horizontal scrollbar
		this.selectElement.style['width'] = 'inherit';
		this.selectElement.style['min-width'] = '100%';

		this._register(dom.addStandardDisposableListener(this.selectElement, dom.EventType.KEY_DOWN, e => this.onKeyDown(e)));

		this.enabledSelectBackground = this.selectBackground;
		this.enabledSelectForeground = this.selectForeground;
		this.enabledSelectBorder = this.selectBorder;
		this.disabledSelectBackground = Color.transparent;
		this.disabledSelectForeground = null;
		this.disabledSelectBorder = null;

		this.inputValidationInfoBorder = defaultOpts.inputValidationInfoBorder;
		this.inputValidationInfoBackground = defaultOpts.inputValidationInfoBackground;
		this.inputValidationWarningBorder = defaultOpts.inputValidationWarningBorder;
		this.inputValidationWarningBackground = defaultOpts.inputValidationWarningBackground;
		this.inputValidationErrorBorder = defaultOpts.inputValidationErrorBorder;
		this.inputValidationErrorBackground = defaultOpts.inputValidationErrorBackground;

		this.onblur(this.selectElement, () => this.onBlur());
		this.onfocus(this.selectElement, () => this.onFocus());
	}

	public style(styles: IListBoxStyles): void {
		let superStyle: ISelectBoxStyles = {
			selectBackground: styles.selectBackground,
			selectForeground: styles.selectForeground,
			selectBorder: styles.selectBorder
		};
		super.style(superStyle);
		this.enabledSelectBackground = this.selectBackground;
		this.enabledSelectForeground = this.selectForeground;
		this.enabledSelectBorder = this.selectBorder;

		this.inputValidationInfoBackground = styles.inputValidationInfoBackground;
		this.inputValidationInfoBorder = styles.inputValidationInfoBorder;
		this.inputValidationWarningBackground = styles.inputValidationWarningBackground;
		this.inputValidationWarningBorder = styles.inputValidationWarningBorder;
		this.inputValidationErrorBackground = styles.inputValidationErrorBackground;
		this.inputValidationErrorBorder = styles.inputValidationErrorBorder;
	}

	public setValidation(isValid: boolean, message?: IMessage): void {
		this.isValid = isValid;
		this.message = message;

		if (this.isValid) {
			this.selectElement.style.border = `1px solid ${this.selectBorder}`;
		} else {
			const styles = this.stylesForType(this.message.type);
			this.selectElement.style.border = styles.border ? `1px solid ${styles.border}` : null;
		}
	}

	public get isContentValid(): boolean {
		return this.isValid;
	}

	public get selectedOptions(): string[] {
		let selected = [];
		for (let i = 0; i < this.selectElement.selectedOptions.length; i++) {
			selected.push(this.selectElement.selectedOptions[i].innerHTML);
		}
		return selected;
	}

	public get count(): number {
		return this.selectElement.options.length;
	}

	// Remove selected options
	public remove(): void {
		let indexes = [];
		for (let i = 0; i < this.selectElement.selectedOptions.length; i++) {
			indexes.push(this.selectElement.selectedOptions[i].index);
		}
		indexes.sort((a, b) => b - a);

		for (let i = 0; i < indexes.length; i++) {
			this.selectElement.remove(indexes[i]);
		}
	}

	public add(option: string): void {
		this.selectElement.add(this.createOption(option));
	}

	// Allow copy to clipboard
	public onKeyDown(event: IKeyboardEvent): void {
		if (this.selectedOptions.length > 0) {
			let key = event.keyCode;
			let ctrlOrCmd = event.ctrlKey || event.metaKey;

			if (ctrlOrCmd && key === KeyCode.KEY_C) {
				let textToCopy = this.selectedOptions[0];
				for (let i = 1; i < this.selectedOptions.length; i++) {
					textToCopy = textToCopy + ', ' + this.selectedOptions[i];
				}

				// Copy to clipboard
				this._clipboardService.writeText(textToCopy);

				event.stopPropagation();
			}
		}
	}

	public enable(): void {
		this.selectElement.disabled = false;
		this.selectBackground = this.enabledSelectBackground;
		this.selectForeground = this.enabledSelectForeground;
		this.selectBorder = this.enabledSelectBorder;
		this.applyStyles();
	}

	public disable(): void {
		this.selectElement.disabled = true;
		this.selectBackground = this.disabledSelectBackground;
		this.selectForeground = this.disabledSelectForeground;
		this.selectBorder = this.disabledSelectBorder;
		this.applyStyles();
	}

	public onBlur(): void {
		if (!this.isValid) {
			this.contextViewProvider.hideContextView();
		}
	}

	public onFocus(): void {
		if (!this.isValid) {
			this.showMessage();
		}
	}

	public focus(): void {
		this.selectElement.focus();
	}

	public showMessage(): void {
		let div: HTMLElement;
		let layout = () => div.style.width = dom.getTotalWidth(this.selectElement) + 'px';

		this.contextViewProvider.showContextView({
			getAnchor: () => this.selectElement,
			anchorAlignment: AnchorAlignment.RIGHT,
			render: (container: HTMLElement) => {
				div = dom.append(container, $('.monaco-inputbox-container'));
				layout();

				const renderOptions: RenderOptions = {
					inline: true,
					className: 'monaco-inputbox-message'
				};

				let spanElement: HTMLElement = (this.message.formatContent
					? renderFormattedText(this.message.content, renderOptions)
					: renderText(this.message.content, renderOptions)) as any;
				dom.addClass(spanElement, this.classForType(this.message.type));

				const styles = this.stylesForType(this.message.type);
				spanElement.style.backgroundColor = styles.background ? styles.background.toString() : null;
				spanElement.style.border = styles.border ? `1px solid ${styles.border}` : null;

				dom.append(div, spanElement);

				return null;
			},
			layout: layout
		});
	}

	private classForType(type: MessageType): string {
		switch (type) {
			case MessageType.INFO: return 'info';
			case MessageType.WARNING: return 'warning';
			default: return 'error';
		}
	}

	private stylesForType(type: MessageType): { border: Color; background: Color } {
		switch (type) {
			case MessageType.INFO: return { border: this.inputValidationInfoBorder, background: this.inputValidationInfoBackground };
			case MessageType.WARNING: return { border: this.inputValidationWarningBorder, background: this.inputValidationWarningBackground };
			default: return { border: this.inputValidationErrorBorder, background: this.inputValidationErrorBackground };
		}
	}
}