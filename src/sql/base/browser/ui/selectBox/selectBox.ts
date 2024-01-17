/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/selectBox';

import { SelectBox as vsSelectBox, ISelectBoxStyles as vsISelectBoxStyles, ISelectBoxOptions, ISelectOptionItem, ISelectData } from 'vs/base/browser/ui/selectBox/selectBox';
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
import { AdsWidget } from 'sql/base/browser/ui/adsWidget';

const $ = dom.$;


export interface SelectOptionItemSQL extends ISelectOptionItem {
	value: string; // THIS IS REQUIRED, this is the value that will actually be returned on SelectBox#values()
}

export interface ISelectBoxStyles extends vsISelectBoxStyles {
	inputValidationInfoBorder: string | undefined;
	inputValidationInfoBackground: string | undefined;
	inputValidationWarningBorder: string | undefined;
	inputValidationWarningBackground: string | undefined;
	inputValidationErrorBorder: string | undefined;
	inputValidationErrorBackground: string | undefined;
}

export class SelectBox extends vsSelectBox implements AdsWidget {
	private _optionsDictionary: Map<string, number>;
	private _dialogOptions: SelectOptionItemSQL[];
	private _selectedOption: string;
	private _selectBoxOptions?: ISelectBoxOptions;
	private contextViewProvider: IContextViewProvider;
	private message?: IMessage;
	private _onDidSelect: Emitter<ISelectData>;
	private _onDidFocus: Emitter<void>;

	private element?: HTMLElement;

	constructor(options: SelectOptionItemSQL[] | string[], selectedOption: string, private readonly _styles: ISelectBoxStyles, contextViewProvider: IContextViewProvider, container?: HTMLElement, selectBoxOptions?: ISelectBoxOptions, id?: string) {
		let optionItems: SelectOptionItemSQL[] = SelectBox.createOptions(options);
		super(optionItems, 0, contextViewProvider, _styles, selectBoxOptions);

		this._onDidSelect = this._register(new Emitter<ISelectData>());
		this._onDidFocus = this._register(new Emitter<void>());
		this._optionsDictionary = new Map<string, number>();
		this.populateOptionsDictionary(optionItems);
		this._dialogOptions = optionItems;
		const option = this._optionsDictionary.get(selectedOption);
		if (option !== undefined) {
			super.select(option);
		}

		this._selectedOption = selectedOption;
		this._register(super.onDidSelect(newSelect => {
			this.onSelect(newSelect);
			this._onDidSelect.fire(newSelect);
		}));

		this.contextViewProvider = contextViewProvider;
		if (container) {
			this.element = dom.append(container, $('.monaco-selectbox.idle'));
		}

		if (id !== undefined) {
			this.selectElement.id = id;
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

	public selectWithOptionName(optionName?: string, selectFirstByDefault: boolean = true, forceSelectionEvent: boolean = false): void {
		let option: number | undefined;
		if (optionName !== undefined) {
			option = this._optionsDictionary.get(optionName);
		}
		if (option !== undefined) {
			this.select(option, forceSelectionEvent);
		} else if (selectFirstByDefault) {
			this.select(0, forceSelectionEvent);
		}
	}

	public override select(index: number, forceSelectionEvent: boolean = false): void {
		super.select(index);
		let selectedOptionIndex = this._optionsDictionary.get(this._selectedOption);
		if (!forceSelectionEvent && selectedOptionIndex === index) { // Not generating an event if the same value is selected.
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
	}

	public disable(): void {
		this.selectElement.disabled = true;
	}

	public getAriaLabel(): string {
		return this.selectElem.ariaLabel;
	}

	public get id(): string {
		return this.selectElem.id;
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
					spanElement.style.backgroundColor = styles.background ? styles.background : '';
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
		//this.applyStyles();

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

	private stylesForType(type: MessageType | undefined): { border: string | undefined; background: string | undefined; } {
		switch (type) {
			case MessageType.INFO: return { border: this._styles.inputValidationInfoBorder, background: this._styles.inputValidationInfoBackground };
			case MessageType.WARNING: return { border: this._styles.inputValidationWarningBorder, background: this._styles.inputValidationWarningBackground };
			default: return { border: this._styles.inputValidationErrorBorder, background: this._styles.inputValidationErrorBackground };
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
