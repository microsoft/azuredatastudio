/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/dropdownList';

import { ToggleDropdownAction } from './actions';

import { IContextViewProvider, ContextView } from 'vs/base/browser/ui/contextview/contextview';
import { mixin } from 'vs/base/common/objects';
import { Builder, $ } from 'vs/base/browser/builder';
import { InputBox, IInputBoxStyles } from 'sql/base/browser/ui/inputBox/inputBox';
import { IMessage, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { List, IListStyles } from 'vs/base/browser/ui/list/listWidget';
import * as DOM from 'vs/base/browser/dom';
import { IDelegate, IRenderer } from 'vs/base/browser/ui/list/list';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Disposable } from 'vs/base/common/lifecycle';
import { Color } from 'vs/base/common/color';
import * as nls from 'vs/nls';
import Event, { Emitter } from 'vs/base/common/event';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';

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
}

export interface IDropdownStyles {
	contextBackground?: Color;
	contextBorder?: Color;
}

const errorMessage = nls.localize('editableDropdown.errorValidate', "Must be an option from the list");

const defaults: IDropdownOptions = {
	strictSelection: true,
	maxHeight: 300,
	errorMessage: errorMessage,
	contextBorder: Color.fromHex('#696969')
};

interface ListResource {
	label: string;
}

interface TableTemplate {
	label: HTMLElement;
}

class Delegate implements IDelegate<ListResource> {
	getHeight = (): number => 22;

	getTemplateId(element: ListResource): string {
		return 'string';
	}
}

class Renderer implements IRenderer<ListResource, TableTemplate> {
	static TEMPLATE_ID = 'string';
	get templateId(): string { return Renderer.TEMPLATE_ID; }

	renderTemplate(container: HTMLElement): TableTemplate {
		const row = $('div.list-row').style('height', '22px').style('padding-left', '5px').getHTMLElement();
		DOM.append(container, row);
		const label = $('span.label').style('margin', 'auto').getHTMLElement();
		DOM.append(row, label);

		return { label };
	}

	renderElement(resource: ListResource, index: number, template: TableTemplate): void {
		template.label.innerText = resource.label;
	}

	disposeTemplate(template: TableTemplate): void {
		// noop
	}
}

export class Dropdown extends Disposable {
	private $el: Builder;
	private $input: Builder;
	private $list: Builder;
	private _input: InputBox;
	private _list: List<ListResource>;
	private _values: string[];
	private _options: IDropdownOptions;
	private _toggleAction: ToggleDropdownAction;
	// we have to create our own contextview since otherwise inputbox will override ours
	private _contextView: ContextView;

	private _onBlur = this._register(new Emitter<void>());
	public onBlur: Event<void> = this._onBlur.event;

	private _onValueChange = this._register(new Emitter<string>());
	public onValueChange: Event<string> = this._onValueChange.event;

	private _onFocus = this._register(new Emitter<void>());
	public onFocus: Event<void> = this._onFocus.event;

	constructor(
		container: HTMLElement,
		contextViewService: IContextViewProvider,
		private _themeService: IThemeService,
		opt?: IDropdownOptions
	) {
		super();
		this._contextView = new ContextView(document.body);
		this._options = mixin(opt, defaults, false) as IDropdownOptions;
		this._values = this._options.values;
		this.$el = $('.dropdown').style('width', '100%').appendTo(container);

		this.$input = $('.dropdown-input').style('width', '100%').appendTo(this.$el);
		this.$list = $('.dropdown-list');

		this._toggleAction = new ToggleDropdownAction(() => this._showList());

		this._input = new InputBox(this.$input.getHTMLElement(), contextViewService, {
			validationOptions: {
				showMessage: false,
				validation: v => this._inputValidator(v)
			},
			placeholder: this._options.placeholder,
			actions: [this._toggleAction]
		});

		this._register(DOM.addDisposableListener(this._input.inputElement, DOM.EventType.FOCUS, () => {
			this._showList();
		}));

		this._register(DOM.addDisposableListener(this._input.inputElement, DOM.EventType.BLUR, () => {
			if (!this._list.isDOMFocused) {
				this._onBlur.fire();
			}
		}));

		this._register(DOM.addStandardDisposableListener(this._input.inputElement, DOM.EventType.KEY_UP, (e: StandardKeyboardEvent) => {
			switch (e.keyCode) {
				case KeyCode.Enter:
					if (this._input.validate()) {
						this._onValueChange.fire(this._input.value);
					}
					e.stopPropagation();
					break;
				case KeyCode.Escape:
					if (this.$list.getHTMLElement().parentElement) {
						this._input.validate();
						this._onBlur.fire();
						this._contextView.hide();
						e.stopPropagation();
					}
					break;
				case KeyCode.Tab:
					this._input.validate();
					this._onBlur.fire();
					this._contextView.hide();
					e.stopPropagation();
					break;
				case KeyCode.DownArrow:
					if (!this.$list.getHTMLElement().parentElement) {
						this._showList();
					}
					this._list.getHTMLElement().focus();
					e.stopPropagation();
					break;
			}
		}));

		this._list = new List(this.$list.getHTMLElement(), new Delegate(), [new Renderer()]);
		if (this._values) {
			this._list.splice(0, this._list.length, this._values.map(i => { return { label: i }; }));
			let height = this._list.length * 22 > this._options.maxHeight ? this._options.maxHeight : this._list.length * 22;
			this.$list.style('height', height + 'px').style('width', DOM.getContentWidth(this.$input.getHTMLElement()) + 'px');
		}

		this._list.onSelectionChange(e => {
			if (e.elements.length === 1) {
				this.value = e.elements[0].label;
				this._onValueChange.fire(e.elements[0].label);
				this._contextView.hide();
			}
		});

		this._input.onDidChange(e => {
			if (this._values) {
				this._list.splice(0, this._list.length, this._values.filter(i => i.includes(e)).map(i => { return { label: i }; }));
				let height = this._list.length * 22 > this._options.maxHeight ? this._options.maxHeight : this._list.length * 22;
				this.$list.style('height', height + 'px').style('width', DOM.getContentWidth(this.$input.getHTMLElement()) + 'px');
				this._list.layout(parseInt(this.$list.style('height')));
			}
		});

		this._register(this._contextView);
		this._register(this.$el);
		this._register(this.$input);
		this._register(this.$list);
		this._register(this._list);
		this._register(this._input);
		this._register(this._contextView);
	}

	private _showList(): void {
		if (this._input.isEnabled) {
			this._onFocus.fire();
			this._contextView.show({
				getAnchor: () => this.$input.getHTMLElement(),
				render: container => {
					this.$list.appendTo(container);
					this._list.layout(parseInt(this.$list.style('height')));
					return { dispose: () => { } };
				},
				onDOMEvent: (e, activeElement) => {
					if (!DOM.isAncestor(activeElement, this.$el.getHTMLElement())) {
						this._input.validate();
						this._onBlur.fire();
						this._contextView.hide();
					}
				}
			});
		}
	}

	public set values(vals: string[]) {
		this._values = vals;
		this._list.splice(0, this._list.length, this._values.map(i => { return { label: i }; }));
		let height = this._list.length * 22 > this._options.maxHeight ? this._options.maxHeight : this._list.length * 22;
		this.$list.style('height', height + 'px').style('width', DOM.getContentWidth(this.$input.getHTMLElement()) + 'px');
		this._list.layout(parseInt(this.$list.style('height')));
		this._input.validate();
	}

	public get value(): string {
		return this._input.value;
	}

	public set value(val: string) {
		this._input.value = val;
	}

	public focus() {
		this._input.focus();
	}

	public blur() {
		this._input.blur();
		this._contextView.hide();
	}

	style(style: IListStyles & IInputBoxStyles & IDropdownStyles) {
		this._list.style(style);
		this._input.style(style);
		this.$list.style('background-color', style.contextBackground.toString());
		this.$list.style('outline', `1px solid ${style.contextBorder || this._options.contextBorder}`);
	}

	private _inputValidator(value: string): IMessage {
		if (this._values && !this._values.includes(value)) {
			if (this._options.strictSelection) {
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

		return undefined;
	}

	public set enabled(val: boolean) {
		this._input.setEnabled(val);
		this._toggleAction.enabled = val;
	}

	public get enabled(): boolean {
		return this._input.isEnabled();
	}
}
