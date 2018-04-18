/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { SelectBox as vsSelectBox, ISelectBoxStyles as vsISelectBoxStyles } from 'vs/base/browser/ui/selectBox/selectBox';
import { Color } from 'vs/base/common/color';
import { IContextViewProvider, AnchorAlignment } from 'vs/base/browser/ui/contextview/contextview';
import * as dom from 'vs/base/browser/dom';
import { RenderOptions, renderFormattedText, renderText } from 'vs/base/browser/htmlContentRenderer';
import { IMessage, MessageType, defaultOpts } from 'vs/base/browser/ui/inputbox/inputBox';
import aria = require('vs/base/browser/ui/aria/aria');
import nls = require('vs/nls');

const $ = dom.$;

export interface ISelectBoxStyles extends vsISelectBoxStyles {
	disabledSelectBackground?: Color;
	disabledSelectForeground?: Color;
	inputValidationInfoBorder?: Color;
	inputValidationInfoBackground?: Color;
	inputValidationWarningBorder?: Color;
	inputValidationWarningBackground?: Color;
	inputValidationErrorBorder?: Color;
	inputValidationErrorBackground?: Color;
}

export class SelectBox extends vsSelectBox {
	private _optionsDictionary;
	private _dialogOptions: string[];
	private _selectedOption: string;
	private enabledSelectBackground: Color;
	private enabledSelectForeground: Color;
	private enabledSelectBorder: Color;
	private disabledSelectBackground: Color;
	private disabledSelectForeground: Color;
	private disabledSelectBorder: Color;
	private contextViewProvider: IContextViewProvider;
	private message: IMessage;
	private inputValidationInfoBorder: Color;
	private inputValidationInfoBackground: Color;
	private inputValidationWarningBorder: Color;
	private inputValidationWarningBackground: Color;
	private inputValidationErrorBorder: Color;
	private inputValidationErrorBackground: Color;
	private element: HTMLElement;

	constructor(options: string[], selectedOption: string, contextViewProvider: IContextViewProvider, container?: HTMLElement) {
		super(options, 0, contextViewProvider);
		this._optionsDictionary = new Array();
		for (var i = 0; i < options.length; i++) {
			this._optionsDictionary[options[i]] = i;
		}
		super.select(this._optionsDictionary[selectedOption]);
		this._selectedOption = selectedOption;
		this._dialogOptions = options;
		this._register(this.onDidSelect(newInput => {
			this._selectedOption = newInput.selected;
		}));

		this.enabledSelectBackground = this.selectBackground;
		this.enabledSelectForeground = this.selectForeground;
		this.enabledSelectBorder = this.selectBorder;
		this.disabledSelectBackground = Color.transparent;
		this.disabledSelectForeground = null;
		this.disabledSelectBorder = null;
		this.contextViewProvider = contextViewProvider;
		if (container) {
			this.element = dom.append(container, $('.monaco-selectbox.idle'));
		}
	}

	public style(styles: ISelectBoxStyles): void {
		super.style(styles);
		this.enabledSelectBackground = this.selectBackground;
		this.enabledSelectForeground = this.selectForeground;
		this.enabledSelectBorder = this.selectBorder;
		this.disabledSelectBackground = styles.disabledSelectBackground;
		this.disabledSelectForeground = styles.disabledSelectForeground;
		this.inputValidationInfoBorder = styles.inputValidationInfoBorder;
		this.inputValidationInfoBackground = styles.inputValidationInfoBackground;
		this.inputValidationWarningBorder = styles.inputValidationWarningBorder;
		this.inputValidationWarningBackground = styles.inputValidationWarningBackground;
		this.inputValidationErrorBorder = styles.inputValidationErrorBorder;
		this.inputValidationErrorBackground = styles.inputValidationErrorBackground;
	}

	public selectWithOptionName(optionName: string): void {
		if (this._optionsDictionary[optionName]) {
			this.select(this._optionsDictionary[optionName]);
		} else {
			this.select(0);
		}
	}

	public select(index: number): void {
		super.select(index);
		if (this._dialogOptions !== undefined) {
			this._selectedOption = this._dialogOptions[index];
		}
	}

	public setOptions(options: string[], selected?: number, disabled?: number): void {
		this._optionsDictionary = [];
		for (var i = 0; i < options.length; i++) {
			this._optionsDictionary[options[i]] = i;
		}
		this._dialogOptions = options;
		super.setOptions(options, selected, disabled);
	}

	public get value(): string {
		return this._selectedOption;
	}

	public disabled(): boolean {
		return this.selectElement.disabled;
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

	public showMessage(message: IMessage): void {
		this.message = message;

		dom.removeClass(this.element, 'idle');
		dom.removeClass(this.element, 'info');
		dom.removeClass(this.element, 'warning');
		dom.removeClass(this.element, 'error');
		dom.addClass(this.element, this.classForType(message.type));

		// ARIA Support
		let alertText: string;
		if (message.type === MessageType.ERROR) {
			alertText = nls.localize('alertErrorMessage', "Error: {0}", message.content);
		} else if (message.type === MessageType.WARNING) {
			alertText = nls.localize('alertWarningMessage', "Warning: {0}", message.content);
		} else {
			alertText = nls.localize('alertInfoMessage', "Info: {0}", message.content);
		}

		aria.alert(alertText);

		this._showMessage();
	}

	public _showMessage(): void {
		if (this.message && this.contextViewProvider && this.element) {
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
	}

	public hideMessage(): void {
		this.message = null;

		dom.removeClass(this.element, 'info');
		dom.removeClass(this.element, 'warning');
		dom.removeClass(this.element, 'error');
		dom.addClass(this.element, 'idle');

		this._hideMessage();
		this.applyStyles();
	}

	private _hideMessage(): void {
		if (this.contextViewProvider) {
			this.contextViewProvider.hideContextView();
		}
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