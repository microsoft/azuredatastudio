/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/dropdownList';
import * as DOM from 'vs/base/browser/dom';
import { Dropdown, IDropdownOptions } from 'vs/base/browser/ui/dropdown/dropdown';
import { IDisposable } from 'vs/base/common/lifecycle';
import { Color } from 'vs/base/common/color';
import { IAction } from 'vs/base/common/actions';
import { EventType as GestureEventType } from 'vs/base/browser/touch';
import { List } from 'vs/base/browser/ui/list/listWidget';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';

import { Button, IButtonStyles } from 'sql/base/browser/ui/button/button';
import { onUnexpectedError } from 'vs/base/common/errors';

export interface IDropdownStyles {
	backgroundColor?: Color;
	foregroundColor?: Color;
	borderColor?: Color;
}

export class DropdownList extends Dropdown {

	protected backgroundColor?: Color;
	protected foregroundColor?: Color;
	protected borderColor?: Color;

	private button?: Button;

	constructor(
		container: HTMLElement,
		private _options: IDropdownOptions,
		private _contentContainer: HTMLElement,
		private _list: List<any>,
		action?: IAction,
	) {
		super(container, _options);
		if (action) {
			this.button = new Button(_contentContainer);
			this.button.label = action.label;
			this._register(DOM.addDisposableListener(this.button.element, DOM.EventType.CLICK, () => {
				action.run().catch(e => onUnexpectedError(e));
				this.hide();
			}));
			this._register(DOM.addDisposableListener(this.button.element, DOM.EventType.KEY_DOWN, (e: KeyboardEvent) => {
				let event = new StandardKeyboardEvent(e);
				if (event.equals(KeyCode.Enter)) {
					e.stopPropagation();
					action.run().catch(e => onUnexpectedError(e));
					this.hide();
				}
			}));
		}

		DOM.append(this.element, DOM.$('div.dropdown-icon'));

		[DOM.EventType.CLICK, DOM.EventType.MOUSE_DOWN, GestureEventType.Tap].forEach(event => {
			this._register(DOM.addDisposableListener(this.element, event, e => DOM.EventHelper.stop(e, true))); // prevent default click behaviour to trigger
		});

		[DOM.EventType.MOUSE_DOWN, GestureEventType.Tap].forEach(event => {
			this._register(DOM.addDisposableListener(this.element, event, e => setTimeout(() => this.show(), 100)));
		});

		this._register(DOM.addStandardDisposableListener(this.element, DOM.EventType.KEY_DOWN, (e: StandardKeyboardEvent) => {
			if (e.equals(KeyCode.Enter)) {
				e.stopPropagation();
				setTimeout(() => {
					this.show();
					this._list.getHTMLElement().focus();
				}, 100);
			}
		}));

		this._register(this._list.onDidChangeSelection(() => {
			// focus on the dropdown label then hide the dropdown list
			this.element.focus();
			this.hide();
		}));

		this.element.setAttribute('tabindex', '0');
	}

	/**
	 * Render the dropdown contents
	 */
	protected renderContents(container: HTMLElement): IDisposable {
		let div = DOM.append(container, this._contentContainer);
		div.style.width = DOM.getTotalWidth(this.element) + 'px';
		return { dispose: () => { } };
	}

	/**
	 * Render the selected label of the dropdown
	 */
	public renderLabel(): void {
		if (this._options.labelRenderer && this.label) {
			this._options.labelRenderer(this.label);
		}
	}

	protected onEvent(e: Event, activeElement: HTMLElement): void {
		// If there is an event outside dropdown label and dropdown list, hide the dropdown list
		if (!DOM.isAncestor(<HTMLElement>e.target, this.element) && !DOM.isAncestor(<HTMLElement>e.target, this._contentContainer)) {
			// focus on the dropdown label then hide the dropdown list
			this.element.focus();
			this.hide();
			// If there is an keyboard event inside the list and key code is escape, hide the dropdown list
		} else if (DOM.isAncestor(<HTMLElement>e.target, this._list.getHTMLElement()) && e instanceof KeyboardEvent) {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Escape)) {
				// focus on the dropdown label then hide the dropdown list
				this.element.focus();
				this.hide();
				e.stopPropagation();
			}
		}
	}

	public style(styles: IDropdownStyles & IButtonStyles): void {
		this.backgroundColor = styles.backgroundColor;
		this.foregroundColor = styles.foregroundColor;
		this.borderColor = styles.borderColor;
		this.applyStyles();
		if (this.button) {
			this.button.style(styles);
		}
	}

	protected applyStyles(): void {
		const background = this.backgroundColor ? this.backgroundColor.toString() : '';
		const foreground = this.foregroundColor ? this.foregroundColor.toString() : '';
		const border = this.borderColor ? this.borderColor.toString() : '';
		this.applyStylesOnElement(this._contentContainer, background, foreground, border);
		if (this.label) {
			this.applyStylesOnElement(this.element, background, foreground, border);
		}
	}

	private applyStylesOnElement(element: HTMLElement, background: string, foreground: string, border: string): void {
		if (element) {
			element.style.backgroundColor = background;
			element.style.color = foreground;

			element.style.borderWidth = border ? '1px' : '';
			element.style.borderStyle = border ? 'solid' : '';
			element.style.borderColor = border;
		}
	}
}
