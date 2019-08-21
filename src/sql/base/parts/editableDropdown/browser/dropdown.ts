/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/dropdownList';

import { ToggleDropdownAction } from './actions';
import { DropdownDataSource, DropdownFilter, DropdownModel, DropdownRenderer, DropdownController } from './dropdownTree';

import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { mixin } from 'vs/base/common/objects';
import { InputBox, IInputBoxStyles } from 'sql/base/browser/ui/inputBox/inputBox';
import { IMessage, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { IListStyles } from 'vs/base/browser/ui/list/listWidget';
import * as DOM from 'vs/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';
import { Color } from 'vs/base/common/color';
import * as nls from 'vs/nls';
import { Event, Emitter } from 'vs/base/common/event';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { ITree } from 'vs/base/parts/tree/browser/tree';

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

export class Dropdown extends Disposable {
	private _el: HTMLElement;
	private _inputContainer: HTMLElement;
	private _treeContainer: HTMLElement;
	private _input: InputBox;
	private _tree: ITree;
	private _options: IDropdownOptions;
	private _toggleAction: ToggleDropdownAction;
	private _dataSource = new DropdownDataSource();
	private _filter = new DropdownFilter();
	private _renderer = new DropdownRenderer();
	private _controller = new DropdownController();
	public fireOnTextChange: boolean;

	private _onBlur = this._register(new Emitter<void>());
	public onBlur: Event<void> = this._onBlur.event;

	private _onValueChange = this._register(new Emitter<string>());
	public onValueChange: Event<string> = this._onValueChange.event;

	private _onFocus = this._register(new Emitter<void>());
	public onFocus: Event<void> = this._onFocus.event;

	constructor(
		container: HTMLElement,
		private readonly contextViewService: IContextViewProvider,
		opt?: IDropdownOptions
	) {
		super();
		this._options = opt || Object.create(null);
		mixin(this._options, defaults, false);
		this._el = DOM.append(container, DOM.$('.monaco-dropdown'));
		this._el.style.width = '100%';

		this._inputContainer = DOM.append(this._el, DOM.$('.dropdown-input'));
		this._inputContainer.style.width = '100%';
		this._treeContainer = DOM.$('.dropdown-tree');

		this._toggleAction = new ToggleDropdownAction(() => {
			this._showList();
			this._tree.domFocus();
			this._tree.focusFirst();
		}, this._options.actionLabel);

		this._input = new InputBox(this._inputContainer, contextViewService, {
			validationOptions: {
				// @SQLTODO
				// showMessage: false,
				validation: v => this._inputValidator(v)
			},
			placeholder: this._options.placeholder,
			actions: [this._toggleAction],
			ariaLabel: this._options.ariaLabel
		});

		// Clear title from input box element (defaults to placeholder value) since we don't want a tooltip for the selected value
		// in the text box - we already have tooltips for each item in the dropdown itself.
		this._input.inputElement.title = '';

		this._register(DOM.addDisposableListener(this._input.inputElement, DOM.EventType.CLICK, () => {
			this._showList();
		}));

		const inputTracker = this._register(DOM.trackFocus(this._input.inputElement));
		inputTracker.onDidBlur(() => {
			if (!this._tree.isDOMFocused()) {
				this._onBlur.fire();
			}
		});

		this._register(DOM.addStandardDisposableListener(this._input.inputElement, DOM.EventType.KEY_DOWN, (e: StandardKeyboardEvent) => {
			switch (e.keyCode) {
				case KeyCode.Enter:
					if (this._input.validate()) {
						this._onValueChange.fire(this._input.value);
					}
					e.stopPropagation();
					break;
				case KeyCode.Escape:
					if (this._treeContainer.parentElement) {
						this._input.validate();
						this._onBlur.fire();
						this.contextViewService.hideContextView();
						e.stopPropagation();
					}
					break;
				case KeyCode.Tab:
					this._input.validate();
					this._onBlur.fire();
					this.contextViewService.hideContextView();
					e.stopPropagation();
					break;
				case KeyCode.DownArrow:
					if (!this._treeContainer.parentElement) {
						this._showList();
					}
					this._tree.domFocus();
					this._tree.focusFirst();
					e.stopPropagation();
					e.preventDefault();
					break;
			}
		}));

		this._tree = new Tree(this._treeContainer, {
			dataSource: this._dataSource,
			filter: this._filter,
			renderer: this._renderer,
			controller: this._controller
		}, { paddingOnRow: false, indentPixels: 0, twistiePixels: 0 });

		const treeTracker = this._register(DOM.trackFocus(this._tree.getHTMLElement()));

		treeTracker.onDidBlur(() => {
			if (!this._input.hasFocus()) {
				this._onBlur.fire();
			}
		});

		this.values = this._options.values;

		this._controller.onSelectionChange(e => {
			this.value = e.value;
			this._onValueChange.fire(e.value);
			this._input.focus();
			this.contextViewService.hideContextView();
		});

		this._controller.onDropdownEscape(() => {
			this._input.focus();
			this.contextViewService.hideContextView();
		});

		this._input.onDidChange(e => {
			if (this._dataSource.options) {
				this._filter.filterString = e;
				this._layoutTree();
			}
			if (this.fireOnTextChange) {
				this.value = e;
				this._onValueChange.fire(e);
			}
		});

		this.onBlur(() => {
			this.contextViewService.hideContextView();
			this._input.validate();
		});

		this._register(this._tree);
		this._register(this._input);
	}

	private _showList(): void {
		if (this._input.isEnabled) {
			this._onFocus.fire();
			this._filter.filterString = '';
			this.contextViewService.showContextView({
				getAnchor: () => this._inputContainer,
				render: container => {
					DOM.append(container, this._treeContainer);
					this._layoutTree();
					return {
						dispose: () => {
							// when we dispose we want to remove treecontainer so that it doesn't have a parent
							// we often use the presense of a parent to detect if the tree is being shown
							this._treeContainer.remove();
						}
					};
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
			let height = filteredLength * this._renderer.getHeight() > this._options.maxHeight! ? this._options.maxHeight! : filteredLength * this._renderer.getHeight();
			this._treeContainer.style.height = height + 'px';
			this._treeContainer.style.width = DOM.getContentWidth(this._inputContainer) - 2 + 'px';
			this._tree.layout(parseInt(this._treeContainer.style.height));
			this._tree.refresh();
		}
	}

	public set values(vals: string[] | undefined) {
		if (vals) {
			this._filter.filterString = '';
			this._dataSource.options = vals.map(i => { return { value: i }; });
			let height = this._dataSource.options.length * 22 > this._options.maxHeight! ? this._options.maxHeight! : this._dataSource.options.length * 22;
			this._treeContainer.style.height = height + 'px';
			this._treeContainer.style.width = DOM.getContentWidth(this._inputContainer) - 2 + 'px';
			this._tree.layout(parseInt(this._treeContainer.style.height));
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
		this.contextViewService.hideContextView();
	}

	style(style: IListStyles & IInputBoxStyles & IDropdownStyles) {
		this._tree.style(style);
		this._input.style(style);
		this._treeContainer.style.backgroundColor = style.contextBackground ? style.contextBackground.toString() : null;
		this._treeContainer.style.outline = `1px solid ${style.contextBorder || this._options.contextBorder}`;
	}

	private _inputValidator(value: string): IMessage | null {
		if (!this._input.hasFocus() && !this._tree.isDOMFocused() && this._dataSource.options && !this._dataSource.options.find(i => i.value === value)) {
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
		this._toggleAction.enabled = val;
	}

	public get enabled(): boolean {
		return this._input.isEnabled();
	}

	public set ariaLabel(val: string) {
		this._input.setAriaLabel(val);
	}
}
