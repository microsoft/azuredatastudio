/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import 'vs/css!./media/dropdownList';
import * as DOM from 'vs/base/browser/dom';
import { Dropdown, IDropdownOptions } from 'vs/base/browser/ui/dropdown/dropdown';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IDisposable } from 'vs/base/common/lifecycle';
import { Color } from 'vs/base/common/color';
import { IAction } from 'vs/base/common/actions';
import { EventType as GestureEventType } from 'vs/base/browser/touch';
import { List } from 'vs/base/browser/ui/list/listWidget';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { Builder } from 'sql/base/browser/builder';

import { Button } from 'sql/base/browser/ui/button/button';
import { attachButtonStyler } from 'sql/platform/theme/common/styler';

export interface IDropdownStyles {
	backgroundColor?: Color;
	foregroundColor?: Color;
	borderColor?: Color;
}

export class DropdownList extends Dropdown {

	protected backgroundColor: Color;
	protected foregroundColor: Color;
	protected borderColor: Color;

	constructor(
		container: HTMLElement,
		private _options: IDropdownOptions,
		private _contentContainer: HTMLElement,
		private _list: List<any>,
		private _themeService: IThemeService,
		private _action?: IAction,
	) {
		super(container, _options);
		if (_action) {
			let button = new Button(_contentContainer);
			button.label = _action.label;
			this.toDispose.push(DOM.addDisposableListener(button.element, DOM.EventType.CLICK, () => {
				this._action.run();
				this.hide();
			}));
			this.toDispose.push(DOM.addDisposableListener(button.element, DOM.EventType.KEY_DOWN, (e: KeyboardEvent) => {
				let event = new StandardKeyboardEvent(e);
				if (event.equals(KeyCode.Enter)) {
					e.stopPropagation();
					this._action.run();
					this.hide();
				}
			}));
			attachButtonStyler(button, this._themeService);
		}

		DOM.append(this.element, DOM.$('div.dropdown-icon'));

		this.toDispose.push(new Builder(this.element).on([DOM.EventType.CLICK, DOM.EventType.MOUSE_DOWN, GestureEventType.Tap], (e: Event) => {
			DOM.EventHelper.stop(e, true); // prevent default click behaviour to trigger
		}).on([DOM.EventType.MOUSE_DOWN, GestureEventType.Tap], (e: Event) => {
			// We want to show the context menu on dropdown so that as a user you can press and hold the
			// mouse button, make a choice of action in the menu and release the mouse to trigger that
			// action.
			// Due to some weird bugs though, we delay showing the menu to unwind event stack
			// (see https://github.com/Microsoft/vscode/issues/27648)
			setTimeout(() => this.show(), 100);
		}).on([DOM.EventType.KEY_DOWN], (e: KeyboardEvent) => {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter)) {
				e.stopPropagation();
				setTimeout(() => {
					this.show();
					this._list.getHTMLElement().focus();
				}, 100);
			}
		}));

		this.toDispose.push(this._list.onSelectionChange(() => {
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
		return null;
	}

	/**
	 * Render the selected label of the dropdown
	 */
	public renderLabel(): void {
		if (this._options.labelRenderer) {
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

	public style(styles: IDropdownStyles): void {
		this.backgroundColor = styles.backgroundColor;
		this.foregroundColor = styles.foregroundColor;
		this.borderColor = styles.borderColor;
		this.applyStyles();
	}

	protected applyStyles(): void {
		const background = this.backgroundColor ? this.backgroundColor.toString() : null;
		const foreground = this.foregroundColor ? this.foregroundColor.toString() : null;
		const border = this.borderColor ? this.borderColor.toString() : null;
		this.applyStylesOnElement(this._contentContainer, background, foreground, border);
		if (this.label) {
			this.applyStylesOnElement(this.element, background, foreground, border);
		}
	}

	private applyStylesOnElement(element: HTMLElement, background: string, foreground: string, border: string): void {
		if (element) {
			element.style.backgroundColor = background;
			element.style.color = foreground;

			element.style.borderWidth = border ? '1px' : null;
			element.style.borderStyle = border ? 'solid' : null;
			element.style.borderColor = border;
		}
	}
}