/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/dropdownList';

import { ToggleDropdownAction } from './actions';
import { DropdownDataSource, DropdownFilter, DropdownModel, DropdownRenderer, DropdownController } from './dropdownTree';

import { IContextViewProvider, ContextView } from 'vs/base/browser/ui/contextview/contextview';
import { mixin } from 'vs/base/common/objects';
import { Builder, $ } from 'sql/base/browser/builder';
import { InputBox, IInputBoxStyles } from 'sql/base/browser/ui/inputBox/inputBox';
import { IMessage, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { IListStyles } from 'vs/base/browser/ui/list/listWidget';
import * as DOM from 'vs/base/browser/dom';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Disposable } from 'vs/base/common/lifecycle';
import { Color } from 'vs/base/common/color';
import * as nls from 'vs/nls';
import { Event, Emitter } from 'vs/base/common/event';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';

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
	/**
	 * Label for the dropdown action
	 */
	actionLabel: string;
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
	contextBorder: Color.fromHex('#696969'),
	actionLabel: nls.localize('dropdownAction.toggle', "Toggle dropdown")
};

interface ListResource {
	label: string;
}

interface TableTemplate {
	label: HTMLElement;
}

export class Dropdown extends Disposable {
	private $el: Builder;
	private $input: Builder;
	private $treeContainer: Builder;
	private _input: InputBox;
	private _tree: Tree;
	private _options: IDropdownOptions;
	private _toggleAction: ToggleDropdownAction;
	// we have to create our own contextview since otherwise inputbox will override ours
	private _contextView: ContextView;
	private _dataSource = new DropdownDataSource();
	private _filter = new DropdownFilter();
	private _renderer = new DropdownRenderer();
	private _controller = new DropdownController();

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
		this.$el = $('.monaco-dropdown').style('width', '100%').appendTo(container);

		this.$input = $('.dropdown-input').style('width', '100%').appendTo(this.$el);
		this.$treeContainer = $('.dropdown-tree');

		this._toggleAction = new ToggleDropdownAction(() => {
			this._showList();
			this._tree.domFocus();
			this._tree.focusFirst();
		}, opt.actionLabel);

		this._input = new InputBox(this.$input.getHTMLElement(), contextViewService, {
			validationOptions: {
				// @SQLTODO
				//showMessage: false,
				validation: v => this._inputValidator(v)
			},
			placeholder: this._options.placeholder,
			actions: [this._toggleAction],
			ariaLabel: this._options.ariaLabel
		});

		this._register(DOM.addDisposableListener(this._input.inputElement, DOM.EventType.CLICK, () => {
			this._showList();
		}));

		this._register(DOM.addDisposableListener(this._input.inputElement, DOM.EventType.BLUR, () => {
			if (!this._tree.isDOMFocused()) {
				this._onBlur.fire();
			}
		}));

		this._register(DOM.addStandardDisposableListener(this._input.inputElement, DOM.EventType.KEY_DOWN, (e: StandardKeyboardEvent) => {
			switch (e.keyCode) {
				case KeyCode.Enter:
					if (this._contextView.isVisible()) {
						if (this._input.validate()) {
							this._onValueChange.fire(this._input.value);
						}
					} else {
						this._showList();
					}
					e.stopPropagation();
					break;
				case KeyCode.Escape:
					if (this.$treeContainer.getHTMLElement().parentElement) {
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
					if (!this.$treeContainer.getHTMLElement().parentElement) {
						this._showList();
					}
					this._tree.domFocus();
					this._tree.focusFirst();
					e.stopPropagation();
					e.preventDefault();
					break;
			}
		}));

		this._tree = new Tree(this.$treeContainer.getHTMLElement(), {
			dataSource: this._dataSource,
			filter: this._filter,
			renderer: this._renderer,
			controller: this._controller
		}, { paddingOnRow: false, indentPixels: 0, twistiePixels: 0 });

		this.values = this._options.values;

		this._controller.onSelectionChange(e => {
			this.value = e.value;
			this._onValueChange.fire(e.value);
			this._input.focus();
			this._contextView.hide();
		});

		this._controller.onDropdownEscape(() => {
			this._input.focus();
			this._contextView.hide();
		});

		this._input.onDidChange(e => {
			if (this._dataSource.options) {
				this._filter.filterString = e;
				this._layoutTree();
			}
		});

		this._register(this._contextView);
		this._register(this.$el);
		this._register(this.$input);
		this._register(this.$treeContainer);
		this._register(this._tree);
		this._register(this._input);
		this._register(this._contextView);
	}

	private _showList(): void {
		if (this._input.isEnabled) {
			this._onFocus.fire();
			this._filter.filterString = '';
			this._contextView.show({
				getAnchor: () => this.$input.getHTMLElement(),
				render: container => {
					this.$treeContainer.appendTo(container);
					this._layoutTree();
					return { dispose: () => { } };
				},
				onDOMEvent: e => {
					if (!DOM.isAncestor(e.srcElement, this.$el.getHTMLElement()) && !DOM.isAncestor(e.srcElement, this.$treeContainer.getHTMLElement())) {
						this._input.validate();
						this._onBlur.fire();
						this._contextView.hide();
					}
				}
			});
		}
	}

	private _layoutTree(): void {
		if (this._dataSource && this._dataSource.options && this._dataSource.options.length > 0) {
			let filteredLength = this._dataSource.options.reduce((p, i) => {
				if (this._filter.isVisible(undefined, i)) {
					return p + 1;
				} else {
					return p;
				}
			}, 0);
			let height = filteredLength * this._renderer.getHeight(undefined, undefined) > this._options.maxHeight ? this._options.maxHeight : filteredLength * this._renderer.getHeight(undefined, undefined);
			this.$treeContainer.style('height', height + 'px').style('width', DOM.getContentWidth(this.$input.getHTMLElement()) - 2 + 'px');
			this._tree.layout(parseInt(this.$treeContainer.style('height')));
			this._tree.refresh();
		}
	}

	public set values(vals: string[]) {
		if (vals) {
			this._filter.filterString = '';
			this._dataSource.options = vals.map(i => { return { value: i }; });
			let height = this._dataSource.options.length * 22 > this._options.maxHeight ? this._options.maxHeight : this._dataSource.options.length * 22;
			this.$treeContainer.style('height', height + 'px').style('width', DOM.getContentWidth(this.$input.getHTMLElement()) - 2 + 'px');
			this._tree.layout(parseInt(this.$treeContainer.style('height')));
			this._tree.setInput(new DropdownModel());
			this._input.validate();
		}
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
		this._tree.style(style);
		this._input.style(style);
		this.$treeContainer.style('background-color', style.contextBackground.toString());
		this.$treeContainer.style('outline', `1px solid ${style.contextBorder || this._options.contextBorder}`);
	}

	private _inputValidator(value: string): IMessage {
		if (this._dataSource.options && !this._dataSource.options.find(i => i.value === value)) {
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
