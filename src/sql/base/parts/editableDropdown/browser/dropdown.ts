/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/dropdownList';
import { IInputBoxStyles, InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { DropdownDataSource, IDropdownListItem, DropdownListRenderer, SELECT_OPTION_ENTRY_TEMPLATE_ID } from 'sql/base/parts/editableDropdown/browser/dropdownList';
import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { IMessage, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { IListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { IListStyles, List } from 'vs/base/browser/ui/list/listWidget';
import { Color } from 'vs/base/common/color';
import { Emitter, Event } from 'vs/base/common/event';
import { KeyCode } from 'vs/base/common/keyCodes';
import { Disposable } from 'vs/base/common/lifecycle';
import { clamp } from 'vs/base/common/numbers';
import { mixin } from 'vs/base/common/objects';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import * as nls from 'vs/nls';


export interface IDropdownOptions extends IDropdownStyles {
	/**
	 * Whether or not a options in the list must be selected or a "new" option can be set
	 */
	strictSelection?: boolean;
	/**
	 * Maximum height of the dropdown, defaults to 500
	 */
	maxHeight?: number;
	/**
	 * Initial values for the dropdown, can be set afterwards
	 */
	values?: string[];
	/**
	 * Placeholder to use in the input
	 */
	placeholder?: string;
	/**
	 * Warning message to show when the input is not part of the supplied list, only used if strictSelection = false
	 */
	warningMessage?: string;
	/**
	 * Error Message to show if input is not part of the supplied list, only used if strictSelection = false
	 */
	errorMessage?: string;
	/**
	 * Value to use as aria-label for the input box
	 */
	ariaLabel?: string;
}

export interface IDropdownStyles {
	contextBackground?: Color;
	contextBorder?: Color;
}

const errorMessage = nls.localize('editableDropdown.errorValidate', "Must be an option from the list");

const defaults: IDropdownOptions = {
	strictSelection: true,
	maxHeight: 300,
	errorMessage: errorMessage
};

export class Dropdown extends Disposable implements IListVirtualDelegate<string> {
	private _el: HTMLElement;
	private _inputContainer: HTMLElement;
	private _selectListContainer: HTMLElement;
	private _input: InputBox;
	private _selectList: List<IDropdownListItem>;
	private _options: IDropdownOptions;
	private _dataSource = new DropdownDataSource();
	public fireOnTextChange?: boolean;
	private _previousValue: string;

	private _onBlur = this._register(new Emitter<void>());
	public onBlur: Event<void> = this._onBlur.event;

	private _onValueChange = this._register(new Emitter<string>());
	public onValueChange: Event<string> = this._onValueChange.event;

	private _onFocus = this._register(new Emitter<void>());
	public onFocus: Event<void> = this._onFocus.event;
	private readonly _widthControlElement: HTMLElement;

	constructor(
		container: HTMLElement,
		private readonly contextViewService: IContextViewProvider,
		opt?: IDropdownOptions
	) {
		super();
		this._options = opt || Object.create(null);
		mixin(this._options, defaults, false);
		this._widthControlElement = DOM.append(container, document.createElement('span'));
		this._widthControlElement.classList.add('monaco-dropdown-width-control-element');
		this._widthControlElement.setAttribute('aria-hidden', 'true');

		this._el = DOM.append(container, DOM.$('.monaco-dropdown'));
		this._el.style.width = '100%';

		this._inputContainer = DOM.append(this._el, DOM.$('.dropdown-input.select-container'));
		this._inputContainer.style.width = '100%';
		this._selectListContainer = DOM.$('div');

		this._input = new InputBox(this._inputContainer, contextViewService, {
			validationOptions: {
				// @SQLTODO
				// showMessage: false,
				validation: v => this._inputValidator(v)
			},
			placeholder: this._options.placeholder,
			ariaLabel: this._options.ariaLabel
		});

		// Clear title from input box element (defaults to placeholder value) since we don't want a tooltip for the selected value
		// in the text box - we already have tooltips for each item in the dropdown itself.
		this._input.inputElement.title = '';

		// add the padding to the element show the the text won't overlap with the dropdown arrow
		this._input.inputElement.style.paddingRight = '22px';

		this._inputContainer.setAttribute('role', 'combobox');

		this._register(DOM.addDisposableListener(this._input.inputElement, DOM.EventType.CLICK, () => {
			this._showList();
		}));

		const inputTracker = this._register(DOM.trackFocus(this._input.inputElement));
		inputTracker.onDidBlur(() => {
			if (!this._selectList.isDOMFocused()) {
				this._onBlur.fire();
			}
		});

		/*
			This event listener is intended to close the expanded drop down when the ADS shell window is resized
			to prevent the list from rendering incorrectly at the top left corner of the window.
		 */
		this._register(DOM.addDisposableListener(window, DOM.EventType.RESIZE, () => {
			if (this._isDropDownVisible) {
				this._hideList();
			}
		}));

		this._register(DOM.addStandardDisposableListener(this._input.inputElement, DOM.EventType.KEY_DOWN, (e: StandardKeyboardEvent) => {
			switch (e.keyCode) {
				case KeyCode.Enter:
					if (this._input.validate() === undefined) {
						this._onValueChange.fire(this._input.value);
					}
					e.stopPropagation();
					break;
				case KeyCode.Escape:
					if (this._isDropDownVisible) {
						this._input.validate();
						this._onBlur.fire();
						this._hideList();
						e.stopPropagation();
					}
					break;
				case KeyCode.Tab:
					this._input.validate();
					this._onBlur.fire();
					this._hideList();
					e.stopPropagation();
					break;
				case KeyCode.DownArrow:
					if (!this._isDropDownVisible) {
						this._showList();
					}
					setTimeout(() => {
						this._selectList.domFocus();
						this._selectList.focusFirst();
					}, 0);
					e.stopPropagation();
					e.preventDefault();
					break;
			}
		}));

		this._selectList = new List('EditableDropdown', this._selectListContainer, this, [new DropdownListRenderer()], {
			useShadows: false,
			verticalScrollMode: ScrollbarVisibility.Visible,
			keyboardSupport: true,
			mouseSupport: true,
			accessibilityProvider: {
				getAriaLabel: (element) => element.text,
				getWidgetAriaLabel: () => nls.localize('selectBox', "Select Box"),
				getRole: () => 'option',
				getWidgetRole: () => 'listbox'
			}
		});

		this.values = this._options.values;
		this._register(this._selectList.onDidBlur(() => {
			this._hideList();
		}));

		this._register(this._selectList.onKeyDown((e) => {
			const event = new StandardKeyboardEvent(e);
			let handled: boolean = false;
			switch (event.keyCode) {
				case KeyCode.Escape:
					this._hideList();
					setTimeout(() => {
						this._input.focus();
					}, 0);
					handled = true;
					break;
				case KeyCode.Enter:
				case KeyCode.Space:
					const focusedElements = this._selectList.getFocusedElements();
					if (focusedElements.length !== 0) {
						this._updateSelection(focusedElements[0].text);
						handled = true;
					}
					break;
				default:
					return;
			}
			if (handled) {
				e.preventDefault();
				e.stopPropagation();
			}
		}));
		this._register(this._selectList.onMouseClick((e) => {
			if (e.element) {
				this._updateSelection(e.element.text);
			}
		}));

		this._input.onDidChange(e => {
			if (this._dataSource.values.length > 0) {
				this._dataSource.filter = e;
				if (this._isDropDownVisible) {
					this._updateDropDownList();
				}
			}
			if (this.fireOnTextChange) {
				this.value = e;
			}
		});

		this.onBlur(() => {
			this._hideList();
			this._input.validate();
		});

		this._register(this._selectList);
		this._register(this._input);
	}

	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return SELECT_OPTION_ENTRY_TEMPLATE_ID;
	}

	private get _isDropDownVisible(): boolean {
		return this._selectListContainer.classList.contains('visible');
	}

	public setDropdownVisibility(visible: boolean): void {
		if (visible) {
			this._selectListContainer.classList.add('visible');
		} else {
			this._selectListContainer.classList.remove('visible');
		}
		this._selectListContainer.setAttribute('aria-hidden', `${!visible}`);
	}

	private _updateSelection(newValue: string): void {
		this.value = newValue;
		this._input.focus();
		this._hideList();
	}

	private _showList(): void {
		if (this._input.isEnabled()) {
			this._inputContainer.setAttribute('aria-expanded', 'true');
			this._onFocus.fire();
			this._dataSource.filter = undefined;
			this.contextViewService.showContextView({
				getAnchor: () => this._inputContainer,
				render: container => {
					this.setDropdownVisibility(true);
					DOM.append(container, this._selectListContainer);
					this._updateDropDownList();
					return {
						dispose: () => {
							this.setDropdownVisibility(false);
						}
					};
				}
			}, this._inputContainer);
		}
	}

	private _hideList(): void {
		this.contextViewService.hideContextView();
		this._inputContainer.setAttribute('aria-expanded', 'false');
	}

	private _updateDropDownList(): void {
		this._selectList.splice(0, this._selectList.length, this._dataSource.filteredValues.map(v => { return { text: v }; }));

		let width = this._inputContainer.clientWidth;

		// Find the longest option in the list and set our width to that (max 500px)
		const longestOption = this._dataSource.filteredValues.reduce((previous, current) => {
			return previous.length > current.length ? previous : current;
		}, '');
		this._widthControlElement.innerText = longestOption;

		const inputContainerWidth = DOM.getContentWidth(this._inputContainer);
		const longestOptionWidth = DOM.getTotalWidth(this._widthControlElement);
		width = clamp(longestOptionWidth, inputContainerWidth, 500);

		const height = Math.min(this._dataSource.filteredValues.length * this.getHeight(), this._options.maxHeight ?? 500);
		this._selectListContainer.style.width = `${width}px`;
		this._selectListContainer.style.height = `${height}px`;
		this._selectList.layout(height, width);
	}

	public set values(vals: string[] | undefined) {
		if (vals) {
			this._dataSource.filter = undefined;
			this._dataSource.values = vals;
			if (this._isDropDownVisible) {
				this._updateDropDownList();
			}
			this._input.validate();
		}
	}

	public get value(): string {
		return this._input.value;
	}

	public set value(val: string) {
		if (this._previousValue !== val) {
			this._input.value = val;
			this._previousValue = val;
			this._onValueChange.fire(val);
		}
	}

	public get inputElement(): HTMLInputElement {
		return this._input.inputElement;
	}

	public focus() {
		this._input.focus();
	}

	public blur() {
		this._input.blur();
		this._hideList();
	}

	style(style: IListStyles & IInputBoxStyles & IDropdownStyles) {
		this._selectList.style(style);
		this._input.style(style);
		this._selectListContainer.style.backgroundColor = style.contextBackground ? style.contextBackground.toString() : '';
		this._selectListContainer.style.outline = `1px solid ${style.contextBorder}`;
	}

	private _inputValidator(value: string): IMessage | null {
		if (!this._input.hasFocus() && this._input.isEnabled() && !this._selectList.isDOMFocused() && !this._dataSource.values.some(i => i === value)) {
			if (this._options.strictSelection && this._options.errorMessage) {
				return {
					content: this._options.errorMessage,
					type: MessageType.ERROR
				};
			} else if (this._options.warningMessage) {
				return {
					content: this._options.warningMessage,
					type: MessageType.WARNING
				};
			}
		}

		return null;
	}

	public set enabled(val: boolean) {
		this._input.setEnabled(val);
	}

	public get enabled(): boolean {
		return this._input.isEnabled();
	}

	public set ariaLabel(val: string) {
		this._input.setAriaLabel(val);
	}

	public get input(): InputBox {
		return this._input;
	}

	public get selectList(): List<IDropdownListItem> {
		return this._selectList;
	}
}
