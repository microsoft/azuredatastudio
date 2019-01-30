/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!vs/base/browser/ui/actionbar/actionbar';

import { Promise } from 'vs/base/common/winjs.base';
import { Builder, $ } from 'sql/base/browser/builder';
import { IAction, IActionRunner, ActionRunner } from 'vs/base/common/actions';
import { EventEmitter } from 'sql/base/common/eventEmitter';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import {
	IActionBarOptions, ActionsOrientation, IActionItem,
	IActionOptions, ActionItem, BaseActionItem
} from 'vs/base/browser/ui/actionbar/actionbar';
import * as lifecycle from 'vs/base/common/lifecycle';
import * as DOM from 'vs/base/browser/dom';
import * as types from 'vs/base/common/types';

let defaultOptions: IActionBarOptions = {
	orientation: ActionsOrientation.HORIZONTAL,
	context: null
};

/**
 * Contains logic for displaying and handling callbacks for clickable icons. Based on
 * ActionBar vs/base/browser/ui/actionbar/actionbar. This class was needed because we
 * want the ability to display content other than Action icons in the QueryTaskbar.
 */
export class ActionBar extends ActionRunner implements IActionRunner {

	private _options: IActionBarOptions;
	private _actionRunner: IActionRunner;
	private _context: any;

	// Items
	private _items: IActionItem[];
	private _focusedItem: number;
	private _focusTracker: DOM.IFocusTracker;

	// Elements
	private _domNode: HTMLElement;
	private _actionsList: HTMLElement;

	constructor(container: HTMLElement | Builder, options: IActionBarOptions = defaultOptions) {
		super();
		this._options = options;
		this._context = options.context;
		this._toDispose = [];
		this._actionRunner = this._options.actionRunner;

		if (!this._actionRunner) {
			this._actionRunner = new ActionRunner();
			this._toDispose.push(this._actionRunner);
		}

		//this._toDispose.push(this.addEmitter(this._actionRunner));

		this._items = [];
		this._focusedItem = undefined;

		this._domNode = document.createElement('div');
		this._domNode.className = 'monaco-action-bar';

		if (options.animated !== false) {
			DOM.addClass(this._domNode, 'animated');
		}

		let isVertical = this._options.orientation === ActionsOrientation.VERTICAL;
		if (isVertical) {
			this._domNode.className += ' vertical';
		}

		$(this._domNode).on(DOM.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			let event = new StandardKeyboardEvent(e);
			let eventHandled = true;

			if (event.equals(isVertical ? KeyCode.UpArrow : KeyCode.LeftArrow)) {
				this.focusPrevious();
			} else if (event.equals(isVertical ? KeyCode.DownArrow : KeyCode.RightArrow)) {
				this.focusNext();
			} else if (event.equals(KeyCode.Escape)) {
				this.cancel();
			} else if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
				// Nothing, just staying out of the else branch
			} else {
				eventHandled = false;
			}

			if (eventHandled) {
				event.preventDefault();
				event.stopPropagation();
			}
		});

		// Prevent native context menu on actions
		$(this._domNode).on(DOM.EventType.CONTEXT_MENU, (e: Event) => {
			e.preventDefault();
			e.stopPropagation();
		});

		$(this._domNode).on(DOM.EventType.KEY_UP, (e: KeyboardEvent) => {
			let event = new StandardKeyboardEvent(e);

			// Run action on Enter/Space
			if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
				this.doTrigger(event);
				event.preventDefault();
				event.stopPropagation();
			}

			// Recompute focused item
			else if (event.equals(KeyCode.Tab) || event.equals(KeyMod.Shift | KeyCode.Tab)) {
				this.updateFocusedItem();
			}
		});

		this._focusTracker = DOM.trackFocus(this._domNode);
		this._focusTracker.onDidBlur(() => {
			if (document.activeElement === this._domNode || !DOM.isAncestor(document.activeElement, this._domNode)) {

				// @SQLTODO
				//this.emit(DOM.EventType.BLUR, {});
				this._focusedItem = undefined;
			}
		});

		this._focusTracker.onDidFocus(() => this.updateFocusedItem());

		this._actionsList = document.createElement('ul');
		this._actionsList.className = 'actions-container';
		this._actionsList.setAttribute('role', 'toolbar');
		if (this._options.ariaLabel) {
			this._actionsList.setAttribute('aria-label', this._options.ariaLabel);
		}

		this._domNode.appendChild(this._actionsList);

		((container instanceof Builder) ? container.getHTMLElement() : container).appendChild(this._domNode);
	}

	public setAriaLabel(label: string): void {
		if (label) {
			this._actionsList.setAttribute('aria-label', label);
		} else {
			this._actionsList.removeAttribute('aria-label');
		}
	}

	private updateFocusedItem(): void {
		let actionIndex = 0;
		for (let i = 0; i < this._actionsList.children.length; i++) {
			let elem = this._actionsList.children[i];

			if (DOM.isAncestor(document.activeElement, elem)) {
				this._focusedItem = actionIndex;
				break;
			}

			if (elem.classList.contains('action-item')) {
				actionIndex++;
			}
		}
	}

	public get context(): any {
		return this._context;
	}

	public set context(context: any) {
		this._context = context;
		this._items.forEach(i => i.setActionContext(context));
	}

	public get actionRunner(): IActionRunner {
		return this._actionRunner;
	}

	public set actionRunner(actionRunner: IActionRunner) {
		if (actionRunner) {
			this._actionRunner = actionRunner;
			this._items.forEach(item => item.actionRunner = actionRunner);
		}
	}

	public getContainer(): Builder {
		return $(this._domNode);
	}

	/**
	 * Push an HTML Element onto the action bar UI in the position specified by options.
	 * Pushes to the last position if no options are provided.
	 */
	public pushElement(element: HTMLElement, options: IActionOptions = {}): void {
		let index = types.isNumber(options.index) ? options.index : null;

		if (index === null || index < 0 || index >= this._actionsList.children.length) {
			this._actionsList.appendChild(element);
		} else {
			this._actionsList.insertBefore(element, this._actionsList.children[index++]);
		}
	}

	/**
	 * Push an action onto the action bar UI in the position specified by options.
	 * Pushes to the last position if no options are provided.
	 */
	public pushAction(arg: IAction | IAction[], options: IActionOptions = {}): void {

		const actions: IAction[] = !Array.isArray(arg) ? [arg] : arg;

		let index = types.isNumber(options.index) ? options.index : null;

		actions.forEach((action: IAction) => {
			const actionItemElement = document.createElement('li');
			actionItemElement.className = 'action-item';
			actionItemElement.setAttribute('role', 'presentation');

			let item: IActionItem = null;

			if (this._options.actionItemProvider) {
				item = this._options.actionItemProvider(action);
			}

			if (!item) {
				item = new ActionItem(this.context, action, options);
			}

			item.actionRunner = this._actionRunner;
			item.setActionContext(this.context);
			//this.addEmitter(item);
			item.render(actionItemElement);

			if (index === null || index < 0 || index >= this._actionsList.children.length) {
				this._actionsList.appendChild(actionItemElement);
			} else {
				this._actionsList.insertBefore(actionItemElement, this._actionsList.children[index++]);
			}

			this._items.push(item);
		});
	}

	public pull(index: number): void {
		if (index >= 0 && index < this._items.length) {
			this._items.splice(index, 1);
			this._actionsList.removeChild(this._actionsList.childNodes[index]);
		}
	}

	public clear(): void {
		// Do not dispose action items if they were provided from outside
		this._items = this._options.actionItemProvider ? [] : lifecycle.dispose(this._items);
		$(this._actionsList).empty();
	}

	public length(): number {
		return this._items.length;
	}

	public isEmpty(): boolean {
		return this._items.length === 0;
	}

	public focus(selectFirst?: boolean): void {
		if (selectFirst && typeof this._focusedItem === 'undefined') {
			this._focusedItem = 0;
		}

		this.updateFocus();
	}

	private focusNext(): void {
		if (typeof this._focusedItem === 'undefined') {
			this._focusedItem = this._items.length - 1;
		}

		let startIndex = this._focusedItem;
		let item: IActionItem;

		do {
			this._focusedItem = (this._focusedItem + 1) % this._items.length;
			item = this._items[this._focusedItem];
		} while (this._focusedItem !== startIndex && !item.isEnabled());

		if (this._focusedItem === startIndex && !item.isEnabled()) {
			this._focusedItem = undefined;
		}

		this.updateFocus();
	}

	private focusPrevious(): void {
		if (typeof this._focusedItem === 'undefined') {
			this._focusedItem = 0;
		}

		let startIndex = this._focusedItem;
		let item: IActionItem;

		do {
			this._focusedItem = this._focusedItem - 1;

			if (this._focusedItem < 0) {
				this._focusedItem = this._items.length - 1;
			}

			item = this._items[this._focusedItem];
		} while (this._focusedItem !== startIndex && !item.isEnabled());

		if (this._focusedItem === startIndex && !item.isEnabled()) {
			this._focusedItem = undefined;
		}

		this.updateFocus();
	}

	private updateFocus(): void {
		if (typeof this._focusedItem === 'undefined') {
			this._domNode.focus();
			return;
		}

		for (let i = 0; i < this._items.length; i++) {
			let item = this._items[i];

			let actionItem = <any>item;

			if (i === this._focusedItem) {
				if (types.isFunction(actionItem.focus)) {
					actionItem.focus();
				}
			} else {
				if (types.isFunction(actionItem.blur)) {
					actionItem.blur();
				}
			}
		}
	}

	private doTrigger(event: StandardKeyboardEvent): void {
		if (typeof this._focusedItem === 'undefined') {
			return; //nothing to focus
		}

		// trigger action
		let actionItem = this._items[this._focusedItem];
		if (actionItem instanceof BaseActionItem) {
			const context = (actionItem._context === null || actionItem._context === undefined) ? event : actionItem._context;
			this.run(actionItem._action, context);
		}
	}

	private cancel(): void {
		if (document.activeElement instanceof HTMLElement) {
			(<HTMLElement>document.activeElement).blur(); // remove focus from focussed action
		}

		//this.emit('cancel');
	}

	public run(action: IAction, context?: any): Promise {
		return this._actionRunner.run(action, context);
	}

	public dispose(): void {
		if (this._items !== null) {
			lifecycle.dispose(this._items);
		}
		this._items = null;

		if (this._focusTracker) {
			this._focusTracker.dispose();
			this._focusTracker = null;
		}

		this._toDispose = lifecycle.dispose(this._toDispose);

		this.getContainer().destroy();

		super.dispose();
	}
}
