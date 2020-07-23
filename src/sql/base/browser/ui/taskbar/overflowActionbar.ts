/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IAction, IActionViewItem } from 'vs/base/common/actions';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import {
	IActionBarOptions, ActionsOrientation,
	IActionOptions
} from 'vs/base/browser/ui/actionbar/actionbar';
import * as DOM from 'vs/base/browser/dom';
import * as types from 'vs/base/common/types';
import * as nls from 'vs/nls';
import { debounce } from 'vs/base/common/decorators';
import { ActionBar } from 'sql/base/browser/ui/taskbar/actionbar';

const defaultOptions: IActionBarOptions = {
	orientation: ActionsOrientation.HORIZONTAL,
	context: null
};

/**
 * Extends Actionbar so that it overflows when the window is resized to be smaller than the actionbar instead of wrapping
 */
export class OverflowActionBar extends ActionBar {
	// Elements
	private _overflow: HTMLElement;
	private _moreItemElement: HTMLElement;
	private _moreActionsElement: HTMLElement;
	private _previousWidth: number;

	constructor(container: HTMLElement, options: IActionBarOptions = defaultOptions) {
		super(container, options);

		this._register(DOM.addDisposableListener(window, DOM.EventType.RESIZE, e => {
			if (this._actionsList) {
				this.resizeToolbar();
			}
		}));

		// Needed so that toolbar gets resized properly with split views
		this._register(DOM.addDisposableListener(window, DOM.EventType.MOUSE_MOVE, e => {
			if (this._actionsList) {
				this.resizeToolbar();
			}
		}));

		this._overflow = document.createElement('ul');
		this._overflow.id = 'overflow';
		this._overflow.className = 'overflow';
		this._overflow.setAttribute('role', 'menu');
		this._domNode.appendChild(this._overflow);

		this._register(DOM.addDisposableListener(this._overflow, DOM.EventType.FOCUS_OUT, e => {
			if (this._overflow && !DOM.isAncestor(e.relatedTarget as HTMLElement, this._overflow) && e.relatedTarget !== this._moreActionsElement) {
				this.hideOverflowDisplay();
			}
		}));
		this._actionsList.style.flexWrap = 'nowrap';

		container.appendChild(this._domNode);
	}

	@debounce(300)
	private resizeToolbar() {
		let width = this._actionsList.offsetWidth;
		let fullWidth = this._actionsList.scrollWidth;

		// collapse actions that are beyond the width of the toolbar
		if (width < fullWidth) {
			// create '•••' more element if it doesn't exist yet
			if (!this._moreItemElement) {
				this.createMoreItemElement();
			}

			this._moreItemElement.style.display = 'block';
			while (width < fullWidth) {
				let index = this._actionsList.childNodes.length - 2; // remove the last toolbar action before the more actions '...'
				if (index > -1) {
					this.collapseItem();
					fullWidth = this._actionsList.scrollWidth;
				} else {
					break;
				}
			}
		} else if (this._overflow?.hasChildNodes() && width > this._previousWidth) { // uncollapse actions if there is space for it
			while (width === fullWidth && this._overflow.hasChildNodes()) {
				this.restoreItem();

				// if the action was too wide, collapse it again
				if (this._actionsList.scrollWidth > this._actionsList.offsetWidth) {
					// move placeholder in this._items
					this.collapseItem();
					break;
				} else if (!this._overflow.hasChildNodes()) {
					this._moreItemElement.style.display = 'none';
				}
			}
		}

		this._previousWidth = width;
	}

	public collapseItem(): void {
		let index = this._actionsList.childNodes.length - 2; // remove the last toolbar action before the more actions '...'
		let item = this._actionsList.removeChild(this._actionsList.childNodes[index]);
		this._overflow.insertBefore(item, this._overflow.firstChild);
		this._register(DOM.addDisposableListener(item, DOM.EventType.CLICK, (e => { this.hideOverflowDisplay(); })));

		// move placeholder in this._items if item isn't a separator
		if (!(<HTMLElement>item).classList.contains('taskbarSeparator')) {
			let placeHolderIndex = this._items.findIndex(i => i === undefined);
			let placeHolderItem = this._items.splice(placeHolderIndex, 1);
			this._items.splice(placeHolderIndex - 1, 0, placeHolderItem[0]);
		}

		// change role to menuItem when it's in the overflow
		if ((<HTMLElement>this._overflow.firstChild).className !== 'taskbarSeparator') {
			(<HTMLElement>this._overflow.firstChild.firstChild).setAttribute('role', 'menuItem');
		}
	}

	public restoreItem(): void {
		let item = this._overflow.removeChild(this._overflow.firstChild);
		// change role back to button when it's in the toolbar
		if ((<HTMLElement>item).className !== 'taskbarSeparator') {
			(<HTMLElement>item.firstChild).setAttribute('role', 'button');
		}
		this._actionsList.insertBefore(item, this._actionsList.lastChild);

		// move placeholder in this._items if item isn't a separator
		if (!(<HTMLElement>item).classList.contains('taskbarSeparator')) {
			let placeHolderIndex = this._items.findIndex(i => i === undefined);
			let placeHolderItem = this._items.splice(placeHolderIndex, 1);
			this._items.splice(placeHolderIndex + 1, 0, placeHolderItem[0]);
		}
	}

	public createMoreItemElement(): void {
		this._moreItemElement = document.createElement('li');
		this._moreItemElement.className = 'action-item more';
		this._moreItemElement.setAttribute('role', 'presentation');
		this._moreActionsElement = document.createElement('a');
		this._moreActionsElement.className = 'moreActionsElement action-label codicon toggle-more';
		this._moreActionsElement.setAttribute('role', 'button');
		this._moreActionsElement.title = nls.localize('toggleMore', "Toggle More");
		this._moreActionsElement.tabIndex = 0;
		this._moreActionsElement.setAttribute('aria-haspopup', 'true');
		this._register(DOM.addDisposableListener(this._moreActionsElement, DOM.EventType.CLICK, (e => {
			this.moreElementOnClick(e);
		})));
		this._register(DOM.addDisposableListener(this._moreActionsElement, DOM.EventType.KEY_UP, (ev => {
			let event = new StandardKeyboardEvent(ev);
			if (event.keyCode === KeyCode.Enter || event.keyCode === KeyCode.Space) {
				this.moreElementOnClick(event);
			}
		})));

		this._register(DOM.addDisposableListener(this._overflow, DOM.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			let event = new StandardKeyboardEvent(e);

			// Close overflow if Escape is pressed
			if (event.equals(KeyCode.Escape)) {
				this.hideOverflowDisplay();
				this._moreActionsElement.focus();
			} else if (event.equals(KeyCode.UpArrow)) {
				// up arrow on first element in overflow should move focus to the bottom of the overflow
				if (this._focusedItem === this._actionsList.childElementCount) {
					this._focusedItem = this._actionsList.childElementCount + this._overflow.childElementCount - 2;
					this.updateFocus();
				} else {
					this.focusPrevious();
				}
			} else if (event.equals(KeyCode.DownArrow)) {
				// down arrow on last element should move focus to the first element of the overflow
				if (this._focusedItem === this._actionsList.childNodes.length + this._overflow.childNodes.length - 2) {
					this._focusedItem = this._actionsList.childElementCount;
					this.updateFocus();
				} else {
					this.focusNext();
				}
			} else if (event.equals(KeyMod.Shift | KeyCode.Tab)) {
				this.hideOverflowDisplay();
				this._focusedItem = this._actionsList.childElementCount - 1;
				this.updateFocus();
			} else if (event.equals(KeyCode.Tab)) {
				this.hideOverflowDisplay();
			}
			DOM.EventHelper.stop(event, true);
		}));

		this._moreItemElement.appendChild(this._moreActionsElement);
		this._actionsList.appendChild(this._moreItemElement);
		this._items.push(undefined); // add place holder for more item element
	}

	public moreElementOnClick(event: MouseEvent | StandardKeyboardEvent): void {
		this._overflow.style.display = this._overflow.style.display === 'block' ? 'none' : 'block';
		if (this._overflow.style.display === 'block') {
			// set focus to the first element in the overflow
			// separators aren't focusable so we don't want to include them when calculating the focused item index
			this._focusedItem = this._actionsList.childElementCount - this.getActionListSeparatorCount();
			this.updateFocus();
		}
		DOM.EventHelper.stop(event, true);
	}

	private getActionListSeparatorCount(): number {
		return Array.from(this._actionsList.children).filter(c => c.className.includes('taskbarSeparator')).length;
	}

	private hideOverflowDisplay(): void {
		this._overflow.style.display = 'none';
		this._focusedItem = this._actionsList.childElementCount - 1;
	}

	protected updateFocusedItem(): void {
		let actionIndex = 0;
		for (let i = 0; i < this._actionsList.children.length; i++) {
			let elem = this._actionsList.children[i];

			if (DOM.isAncestor(document.activeElement, elem)) {
				this._focusedItem = actionIndex;
				break;
			}

			if (elem.classList.contains('action-item') && i !== this._actionsList.children.length - 1) {
				actionIndex++;
			}
		}

		// move focus to overflow items if there are any
		if (this._overflow) {
			for (let i = 0; i < this._overflow.children.length; i++) {
				let elem = this._overflow.children[i];

				if (DOM.isAncestor(document.activeElement, elem)) {
					this._focusedItem = actionIndex;
					break;
				}

				if (elem.classList.contains('action-item')) {
					actionIndex++;
				}
			}
		}
	}

	/**
	 * Push an HTML Element onto the action bar UI in the position specified by options.
	 * Pushes to the last position if no options are provided.
	 */
	public pushElement(element: HTMLElement, options: IActionOptions = {}): void {
		super.pushElement(element, options);
		this.resizeToolbar();
	}

	/**
	 * Push an action onto the action bar UI in the position specified by options.
	 * Pushes to the last position if no options are provided.
	 */
	public pushAction(arg: IAction | IAction[], options: IActionOptions = {}): void {
		super.pushAction(arg, options);
		this.resizeToolbar();
	}

	protected focusNext(): void {
		if (typeof this._focusedItem === 'undefined') {
			this._focusedItem = this._items.length - 1;
		}

		let startIndex = this._focusedItem;
		let item: IActionViewItem;

		do {
			this._focusedItem = (this._focusedItem + 1) % this._items.length;
			item = this._items[this._focusedItem];
		} while (this._focusedItem !== startIndex && item && !item.isEnabled());

		if (this._focusedItem === startIndex && item && !item.isEnabled()) {
			this._focusedItem = undefined;
		}

		this.updateFocus();
	}

	protected focusPrevious(): void {
		if (typeof this._focusedItem === 'undefined') {
			this._focusedItem = 0;
		}

		let startIndex = this._focusedItem;
		let item: IActionViewItem;

		do {
			this._focusedItem = this._focusedItem - 1;

			if (this._focusedItem < 0) {
				this._focusedItem = this._items.length - 1;
			}

			item = this._items[this._focusedItem];
		} while (this._focusedItem !== startIndex && item && !item.isEnabled());

		if (this._focusedItem === startIndex && item && !item.isEnabled()) {
			this._focusedItem = undefined;
		}

		this.updateFocus();
	}

	protected updateFocus(): void {
		if (typeof this._focusedItem === 'undefined') {
			this._domNode.focus();
			return;
		}

		for (let i = 0; i < this._items.length; i++) {
			let item = this._items[i];

			let actionItem = <any>item;

			if (i === this._focusedItem) {
				// placeholder for location of moreActionsElement
				if (!actionItem) {
					this._moreActionsElement.focus();
				}
				else if (types.isFunction(actionItem.focus)) {
					actionItem.focus();
				}
			} else {
				if (actionItem && types.isFunction(actionItem.blur)) {
					actionItem.blur();
				}
			}
		}
	}

	protected cancel(): void {
		super.cancel();

		if (this._overflow) {
			this.hideOverflowDisplay();
		}
	}

	public run(action: IAction, context?: any): Promise<any> {
		this.hideOverflowDisplay();
		return this._actionRunner.run(action, context);
	}

	public get actionsList(): HTMLElement {
		return this._actionsList;
	}

	public get items(): IActionViewItem[] {
		return this._items;
	}

	public get overflow(): HTMLElement {
		return this._overflow;
	}

	public get focusedItem(): number {
		return this._focusedItem;
	}
}
