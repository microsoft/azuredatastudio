/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/dropdownList';
import * as DOM from 'vs/base/browser/dom';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IAction } from 'vs/base/common/actions';
import { EventType as GestureEventType } from 'vs/base/browser/touch';
import { List } from 'vs/base/browser/ui/list/listWidget';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';

import { Button } from 'sql/base/browser/ui/button/button';
import { BaseDropdown, IBaseDropdownOptions } from 'vs/base/browser/ui/dropdown/dropdown';
import { IAnchor, IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { IButtonStyles } from 'vs/base/browser/ui/button/button';

export interface IDropdownStyles {
	backgroundColor?: string;
	foregroundColor?: string;
	borderColor?: string;
}

export interface IDropdownOptions extends IBaseDropdownOptions {
	contextViewProvider: IContextViewProvider;
	buttonStyles: IButtonStyles;
	dropdownStyles: IDropdownStyles;
}

export class Dropdown extends BaseDropdown {
	private contextViewProvider: IContextViewProvider;

	constructor(container: HTMLElement, options: IDropdownOptions) {
		super(container, options);

		this.contextViewProvider = options.contextViewProvider;
	}

	override show(): void {
		super.show();

		this.element.classList.add('active');

		this.contextViewProvider.showContextView({
			getAnchor: () => this.getAnchor(),

			render: (container) => {
				return this.renderContents(container);
			},

			onDOMEvent: (e, activeElement) => {
				this.onEvent(e, activeElement);
			},

			onHide: () => this.onHide()
		});
	}

	protected getAnchor(): HTMLElement | IAnchor {
		return this.element;
	}

	protected onHide(): void {
		this.element.classList.remove('active');
	}

	override hide(): void {
		super.hide();

		if (this.contextViewProvider) {
			this.contextViewProvider.hideContextView();
		}
	}

	protected renderContents(container: HTMLElement): IDisposable | null {
		return null;
	}
}

export class DropdownList extends Dropdown {
	protected borderWidth = 1;

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
			this.button = new Button(_contentContainer, this._options.buttonStyles);
			this.button.label = action.label;
			this._register(DOM.addDisposableListener(this.button.element, DOM.EventType.CLICK, () => {
				action.run();
				this.hide();
			}));
			this._register(DOM.addDisposableListener(this.button.element, DOM.EventType.KEY_DOWN, (e: KeyboardEvent) => {
				let event = new StandardKeyboardEvent(e);
				if (event.equals(KeyCode.Enter)) {
					e.stopPropagation();
					action.run();
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
		this.applyStylesOnElement(this._contentContainer, _options.dropdownStyles.backgroundColor, _options.dropdownStyles.foregroundColor, _options.dropdownStyles.borderColor);
		if (this.label) {
			this.applyStylesOnElement(this.element, _options.dropdownStyles.backgroundColor, _options.dropdownStyles.foregroundColor, _options.dropdownStyles.borderColor);
		}
	}

	/**
	 * Render the dropdown contents
	 */
	protected override renderContents(container: HTMLElement): IDisposable | null {
		let div = DOM.append(container, this._contentContainer);
		div.style.width = (DOM.getTotalWidth(this.element) - this.borderWidth * 2) + 'px'; // Subtract border width
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

	protected override onEvent(e: Event, activeElement: HTMLElement): void {
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

	private applyStylesOnElement(element: HTMLElement, background: string, foreground: string, border: string): void {
		if (element) {
			element.style.backgroundColor = background;
			element.style.color = foreground;

			this.borderWidth = border ? 1 : 0;
			element.style.borderWidth = border ? this.borderWidth + 'px' : '';
			element.style.borderStyle = border ? 'solid' : '';
			element.style.borderColor = border;
		}
	}
}
