/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/selectBox';

import { SelectBox as vsSelectBox, ISelectBoxStyles as vsISelectBoxStyles, ISelectBoxOptions, ISelectOptionItem, ISelectData } from 'vs/base/browser/ui/selectBox/selectBox';
import { Color } from 'vs/base/common/color';
import { IContextViewProvider, AnchorAlignment } from 'vs/base/browser/ui/contextview/contextview';
import * as dom from 'vs/base/browser/dom';
import { IMessage, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import * as aria from 'vs/base/browser/ui/aria/aria';
import * as nls from 'vs/nls';
import { renderFormattedText, renderText, FormattedTextRenderOptions } from 'vs/base/browser/formattedTextRenderer';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { SelectBoxList } from 'vs/base/browser/ui/selectBox/selectBoxCustom';
import { Event, Emitter } from 'vs/base/common/event';

const $ = dom.$;


export interface SelectOptionItemSQL extends ISelectOptionItem {
	value: string; // THIS IS REQUIRED, this is the value that will actually be returned on SelectBox#values()
}

export interface ISelectBoxStyles extends vsISelectBoxStyles {
	disabledSelectBackground?: Color;
	disabledSelectForeground?: Color;
	inputValidationInfoBorder?: Color;
	inputValidationInfoBackground?: Color;
	inputinputValidationInfoForeground?: Color;
	inputValidationWarningBorder?: Color;
	inputValidationWarningBackground?: Color;
	inputValidationWarningForeground?: Color;
	inputValidationErrorBorder?: Color;
	inputValidationErrorBackground?: Color;
	inputValidationErrorForeground?: Color;
}

export class SelectBox extends vsSelectBox {
	private _optionsDictionary: Map<string, number>;
	private _dialogOptions: SelectOptionItemSQL[];
	private _selectedOption: string;
	private _selectBoxOptions?: ISelectBoxOptions;
	private enabledSelectBackground?: Color;
	private enabledSelectForeground?: Color;
	private enabledSelectBorder?: Color;
	private disabledSelectBackground?: Color;
	private disabledSelectForeground?: Color;
	private disabledSelectBorder?: Color;
	private contextViewProvider: IContextViewProvider;
	private message?: IMessage;
	private _onDidSelect: Emitter<ISelectData>;
	private _onDidFocus: Emitter<void>;

	private inputValidationInfoBorder?: Color;
	private inputValidationInfoBackground?: Color;
	private inputValidationInfoForeground?: Color;
	private inputValidationWarningBorder?: Color;
	private inputValidationWarningBackground?: Color;
	private inputValidationWarningForeground?: Color;
	private inputValidationErrorBorder?: Color;
	private inputValidationErrorBackground?: Color;
	private inputValidationErrorForeground?: Color;

	private element?: HTMLElement;

	constructor(options: SelectOptionItemSQL[] | string[], selectedOption: string, contextViewProvider: IContextViewProvider, container?: HTMLElement, selectBoxOptions?: ISelectBoxOptions) {
		let optionItems: SelectOptionItemSQL[] = SelectBox.createOptions(options);
		super(optionItems, 0, contextViewProvider, undefined, selectBoxOptions);

		this._onDidSelect = new Emitter<ISelectData>();
		this._onDidFocus = new Emitter<void>();
		this._optionsDictionary = new Map<string, number>();
		this.populateOptionsDictionary(optionItems);
		this._dialogOptions = optionItems;
		const option = this._optionsDictionary.get(selectedOption);
		if (option) {
			super.select(option);
		}

		this._selectedOption = selectedOption;
		this._register(super.onDidSelect(newSelect => {
			this.onSelect(newSelect);
			this._onDidSelect.fire(newSelect);
		}));

		this.enabledSelectBackground = this.selectBackground;
		this.enabledSelectForeground = this.selectForeground;
		this.enabledSelectBorder = this.selectBorder;
		this.disabledSelectBackground = Color.transparent;
		this.disabledSelectForeground = undefined;
		this.disabledSelectBorder = undefined;
		this.contextViewProvider = contextViewProvider;
		if (container) {
			this.element = dom.append(container, $('.monaco-selectbox.idle'));
		}

		this._selectBoxOptions = selectBoxOptions;
		let focusTracker = dom.trackFocus(this.selectElement);
		this._register(focusTracker);
		this._register(focusTracker.onDidBlur(() => this._hideMessage()));
		this._register(focusTracker.onDidFocus(() => {
			this._showMessage();
			this._onDidFocus.fire();
		}));
		// Stop propagation - we've handled the event already and letting it bubble up causes issues with parent
		// controls handling it (such as dialog pages)
		this.onkeydown(this.selectElement, (e: IKeyboardEvent) => {
			if (e.keyCode === KeyCode.Enter) {
				dom.EventHelper.stop(e, true);
			}
		});
		if (this.selectBoxDelegate instanceof SelectBoxList) {
			// SelectBoxList uses its own custom drop down list so we need to also stop propagation from that or it'll
			// also bubble up
			this.onkeydown(this.selectBoxDelegate.selectDropDownContainer, (e: IKeyboardEvent) => {
				if (e.keyCode === KeyCode.Enter || e.keyCode === KeyCode.Escape) {
					dom.EventHelper.stop(e, true);
				}
				if (e.keyCode === KeyCode.Tab) {
					// Set focus back to the input box so that it moves to the next item in the list correctly since
					// the context menu isn't in the same place in the DOM so will likely result in an unexpected element
					// getting the next focus
					this.focus();
				}
			});
		}
	}

	public override get onDidSelect(): Event<ISelectData> {
		// We override the onDidSelect event here because the base onDidSelect event isn't fired when
		// selecting an element via select - which means that we'll miss out on a selection made that way.
		// So we expose our own event that's fired either when the base onDidSelect is called or when we
		// manually select an item
		return this._onDidSelect.event;
	}

	public get onDidFocus(): Event<void> {
		return this._onDidFocus.event;
	}

	public onSelect(newInput: ISelectData) {
		const selected = this._dialogOptions[newInput.index];
		this._selectedOption = selected.value;
	}

	private static createOptions(options: SelectOptionItemSQL[] | string[] | ISelectOptionItem[]): SelectOptionItemSQL[] {
		let selectOptions: SelectOptionItemSQL[];
		if (Array.isArray(options) && typeof (options[0]) === 'string') {
			selectOptions = (options as string[]).map(o => {
				return { text: o, value: o } as SelectOptionItemSQL;
			});
		} else { // Handle both SelectOptionItemSql and ISelectOptionItem
			const temp = (options as SelectOptionItemSQL[]);
			selectOptions = temp.map(opt => {
				if (opt.value === undefined) {
					opt.value = opt.text;
				}
				return opt;
			});
		}

		return selectOptions;
	}

	public populateOptionsDictionary(options: SelectOptionItemSQL[]) {
		this._optionsDictionary.clear();
		for (let i = 0; i < options.length; i++) {
			this._optionsDictionary.set(options[i].value, i);
		}
		this._dialogOptions = options;
	}

	public override style(styles: ISelectBoxStyles): void {
		super.style(styles);
		this.enabledSelectBackground = this.selectBackground;
		this.enabledSelectForeground = this.selectForeground;
		this.enabledSelectBorder = this.selectBorder;
		this.disabledSelectBackground = styles.disabledSelectBackground;
		this.disabledSelectForeground = styles.disabledSelectForeground;
		this.inputValidationInfoBorder = styles.inputValidationInfoBorder;
		this.inputValidationInfoBackground = styles.inputValidationInfoBackground;
		this.inputValidationInfoForeground = styles.inputinputValidationInfoForeground;
		this.inputValidationWarningBorder = styles.inputValidationWarningBorder;
		this.inputValidationWarningBackground = styles.inputValidationWarningBackground;
		this.inputValidationWarningForeground = styles.inputValidationWarningForeground;
		this.inputValidationErrorBorder = styles.inputValidationErrorBorder;
		this.inputValidationErrorBackground = styles.inputValidationErrorBackground;
		this.inputValidationErrorForeground = styles.inputValidationErrorForeground;
		this.applyStyles();
	}

	public selectWithOptionName(optionName?: string): void {
		let option: number | undefined;
		if (optionName) {
			option = this._optionsDictionary.get(optionName);
		}
		if (option) {
			this.select(option);
		} else {
			this.select(0);
		}
	}

	public override select(index: number): void {
		super.select(index);
		let selectedOptionIndex = this._optionsDictionary.get(this._selectedOption);
		if (selectedOptionIndex === index) { // Not generating an event if the same value is selected.
			return;
		}
		if (this._dialogOptions !== undefined) {
			this._selectedOption = this._dialogOptions[index]?.value;
		}
		this._onDidSelect.fire({
			selected: this._selectedOption,
			index: index
		});
	}


	public override setOptions(options: string[] | SelectOptionItemSQL[] | ISelectOptionItem[], selected?: number): void {
		let selectOptions: SelectOptionItemSQL[] = SelectBox.createOptions(options);
		this.populateOptionsDictionary(selectOptions);
		super.setOptions(selectOptions, selected);
	}

	public get value(): string {
		return this._selectedOption;
	}

	public get label(): string | undefined {
		return this._dialogOptions?.find(s => s.value === this._selectedOption)?.text;
	}

	public get values(): string[] {
		return this._dialogOptions.map(s => s.value);
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

	public hasFocus(): boolean {
		return document.activeElement === this.selectElement;
	}

	public showMessage(message: IMessage): void {
		this.message = message;

		if (this.element) {
			this.element.classList.remove('idle');
			this.element.classList.remove('info');
			this.element.classList.remove('warning');
			this.element.classList.remove('error');
			this.element.classList.add(this.classForType(message.type));
		}

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

		if (this.hasFocus()) {
			this._showMessage();
		}
	}

	public _showMessage(): void {
		if (this.message && this.contextViewProvider && this.element) {
			const message = this.message;
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

					let spanElement: HTMLElement = (message.formatContent
						? renderFormattedText(message.content, renderOptions)
						: renderText(message.content, renderOptions)) as any;
					spanElement.classList.add(this.classForType(message.type));

					const styles = this.stylesForType(message.type);
					spanElement.style.backgroundColor = styles.background ? styles.background.toString() : '';
					spanElement.style.border = styles.border ? `1px solid ${styles.border}` : '';

					dom.append(div, spanElement);

					return null;
				},
				layout: layout
			});
		}
	}

	public hideMessage(): void {
		if (this.element) {
			this.element.classList.remove('info');
			this.element.classList.remove('warning');
			this.element.classList.remove('error');
			this.element.classList.add('idle');
		}

		this._hideMessage();
		this.applyStyles();

		this.message = undefined;
	}

	private _hideMessage(): void {
		if (this.message && this.contextViewProvider) {
			this.contextViewProvider.hideContextView();
		}
	}

	private classForType(type: MessageType | undefined): string {
		switch (type) {
			case MessageType.INFO: return 'info';
			case MessageType.WARNING: return 'warning';
			default: return 'error';
		}
	}

	private stylesForType(type: MessageType | undefined): { border: Color | undefined; background: Color | undefined; foreground: Color | undefined } {
		switch (type) {
			case MessageType.INFO: return { border: this.inputValidationInfoBorder, background: this.inputValidationInfoBackground, foreground: this.inputValidationInfoForeground };
			case MessageType.WARNING: return { border: this.inputValidationWarningBorder, background: this.inputValidationWarningBackground, foreground: this.inputValidationWarningForeground };
			default: return { border: this.inputValidationErrorBorder, background: this.inputValidationErrorBackground, foreground: this.inputValidationErrorForeground };
		}
	}

	public override render(container: HTMLElement): void {
		let selectOptions: ISelectBoxOptionsWithLabel = this._selectBoxOptions as ISelectBoxOptionsWithLabel;

		if (selectOptions && selectOptions.labelText && selectOptions.labelText !== undefined) {
			let outerContainer = document.createElement('div');
			let selectContainer = document.createElement('div');
			selectContainer.setAttribute('role', 'presentation');

			outerContainer.className = selectOptions.labelOnTop ? 'labelOnTopContainer' : 'labelOnLeftContainer';

			let labelText = document.createElement('div');
			labelText.className = 'action-item-label';
			labelText.innerHTML = selectOptions.labelText;

			container.appendChild(outerContainer);
			outerContainer.appendChild(labelText);
			outerContainer.appendChild(selectContainer);

			super.render(selectContainer);
			this.selectElement.classList.add('action-item-label');
			this.selectElement.id = selectOptions.id;
		}
		else {
			super.render(container);
		}
	}

	public get selectElem(): HTMLSelectElement {
		return this.selectElement;
	}
}

export interface ISelectBoxOptionsWithLabel extends ISelectBoxOptions {
	labelText?: string;
	labelOnTop?: boolean;
	id?: string;
}
