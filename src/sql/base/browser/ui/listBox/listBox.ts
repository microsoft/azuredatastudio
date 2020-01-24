/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SelectBox, ISelectBoxStyles, ISelectOptionItem } from 'vs/base/browser/ui/selectBox/selectBox';
import { Color } from 'vs/base/common/color';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { IMessage, MessageType, defaultOpts } from 'vs/base/browser/ui/inputbox/inputBox';
import * as dom from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IContextViewProvider, AnchorAlignment } from 'vs/base/browser/ui/contextview/contextview';
import { Emitter } from 'vs/base/common/event';
import { renderFormattedText, renderText, FormattedTextRenderOptions } from 'vs/base/browser/formattedTextRenderer';

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
	private enabledSelectBackground?: Color;
	private enabledSelectForeground?: Color;
	private enabledSelectBorder?: Color;
	private disabledSelectBackground?: Color;
	private disabledSelectForeground?: Color;
	private disabledSelectBorder?: Color;

	private inputValidationInfoBorder?: Color;
	private inputValidationInfoBackground?: Color;
	private inputValidationWarningBorder?: Color;
	private inputValidationWarningBackground?: Color;
	private inputValidationErrorBorder?: Color;
	private inputValidationErrorBackground?: Color;

	private message?: IMessage;
	private contextViewProvider: IContextViewProvider;
	private isValid: boolean;

	private _onKeyDown = new Emitter<StandardKeyboardEvent>();
	public readonly onKeyDown = this._onKeyDown.event;

	constructor(
		private options: ISelectOptionItem[],
		contextViewProvider: IContextViewProvider) {

		super(options, 0, contextViewProvider);
		this.contextViewProvider = contextViewProvider;
		this.isValid = true;
		this.selectElement.multiple = true;
		this.selectElement.style.height = '80px';

		// Set width style for horizontal scrollbar
		this.selectElement.style.width = 'inherit';
		this.selectElement.style.minWidth = '100%';

		this._register(dom.addStandardDisposableListener(this.selectElement, dom.EventType.KEY_DOWN, (e: StandardKeyboardEvent) => this._onKeyDown.fire(e)));

		this._register(dom.addDisposableListener(this.selectElement, dom.EventType.CLICK, (e) => {
			this.contextViewProvider.hideContextView();
			let index = (<any>e.target).index;
			if (!isUndefinedOrNull(index)) {
				this.select(index);
			}
			this.selectElement.focus();
		}));

		this.enabledSelectBackground = this.selectBackground;
		this.enabledSelectForeground = this.selectForeground;
		this.enabledSelectBorder = this.selectBorder;
		this.disabledSelectBackground = Color.transparent;

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
		} else if (this.message) {
			const styles = this.stylesForType(this.message.type);
			this.selectElement.style.border = styles.border ? `1px solid ${styles.border}` : '';
		}
	}

	public get isContentValid(): boolean {
		return this.isValid;
	}

	public get selectedOptions(): string[] {
		let selected: string[] = [];
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
		let indexes: number[] = [];
		for (let i = 0; i < this.selectElement.selectedOptions.length; i++) {
			indexes.push(this.selectElement.selectedOptions[i].index);
		}
		indexes.sort((a, b) => b - a);

		for (let i = 0; i < indexes.length; i++) {
			this.selectElement.remove(indexes[i]);
			this.options.splice(indexes[i], 1);
		}
		super.setOptions(this.options);
	}

	public add(option: string): void {
		let optionObj = this.createOption(option);
		this.selectElement.add(optionObj);

		// make sure that base options are updated since that is used in selection not selectElement
		this.options.push(optionObj);
		super.setOptions(this.options);
	}

	public setOptions(options: ISelectOptionItem[], selected?: number): void {
		this.options = options;
		super.setOptions(options, selected);
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

				const renderOptions: FormattedTextRenderOptions = {
					inline: true,
					className: 'monaco-inputbox-message'
				};

				if (this.message) {
					let spanElement: HTMLElement = (this.message.formatContent
						? renderFormattedText(this.message.content, renderOptions)
						: renderText(this.message.content, renderOptions)) as any;
					dom.addClass(spanElement, this.classForType(this.message.type));

					const styles = this.stylesForType(this.message.type);
					spanElement.style.backgroundColor = styles.background ? styles.background.toString() : '';
					spanElement.style.border = styles.border ? `1px solid ${styles.border}` : '';

					dom.append(div, spanElement);
				}

				return { dispose: () => { } };
			},
			layout: layout
		});
	}

	private classForType(type?: MessageType): string {
		switch (type) {
			case MessageType.INFO: return 'info';
			case MessageType.WARNING: return 'warning';
			default: return 'error';
		}
	}

	private stylesForType(type?: MessageType): { border?: Color; background?: Color } {
		switch (type) {
			case MessageType.INFO: return { border: this.inputValidationInfoBorder, background: this.inputValidationInfoBackground };
			case MessageType.WARNING: return { border: this.inputValidationWarningBorder, background: this.inputValidationWarningBackground };
			default: return { border: this.inputValidationErrorBorder, background: this.inputValidationErrorBackground };
		}
	}
}
