/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/infoBox';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { alert, status } from 'vs/base/browser/ui/aria/aria';
import { IThemable } from 'vs/base/common/styler';
import { Color } from 'vs/base/common/color';
import * as DOM from 'vs/base/browser/dom';
import { Event, Emitter } from 'vs/base/common/event';
import { Codicon } from 'vs/base/common/codicons';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';

export interface IInfoBoxStyles {
	informationBackground?: Color;
	warningBackground?: Color;
	errorBackground?: Color;
	successBackground?: Color;
}

export type InfoBoxStyle = 'information' | 'warning' | 'error' | 'success';

export interface InfoBoxOptions {
	text: string;
	style: InfoBoxStyle;
	announceText?: boolean;
	isClickable?: boolean;
	clickableButtonAriaLabel?: string;
}

export class InfoBox extends Disposable implements IThemable {
	private _imageElement: HTMLDivElement;
	private _textElement: HTMLDivElement;
	private _infoBoxElement: HTMLDivElement;
	private _clickableIndicator: HTMLDivElement;
	private _text = '';
	private _infoBoxStyle: InfoBoxStyle = 'information';
	private _styles: IInfoBoxStyles;
	private _announceText: boolean = false;
	private _isClickable: boolean = false;
	private _clickableButtonAriaLabel: string;

	private _clickListenersDisposableStore = new DisposableStore();
	private _onDidClick: Emitter<void> = this._register(new Emitter<void>());
	get onDidClick(): Event<void> { return this._onDidClick.event; }

	constructor(container: HTMLElement, options?: InfoBoxOptions) {
		super();
		this._infoBoxElement = document.createElement('div');
		this._imageElement = document.createElement('div');
		this._imageElement.setAttribute('role', 'image');
		this._textElement = document.createElement('div');
		this._textElement.classList.add('infobox-text');
		container.appendChild(this._infoBoxElement);
		this._infoBoxElement.appendChild(this._imageElement);
		this._infoBoxElement.appendChild(this._textElement);
		this._clickableIndicator = DOM.$('a');
		this._clickableIndicator.classList.add('infobox-clickable-arrow', ...Codicon.arrowRight.classNamesArray);
		this._infoBoxElement.appendChild(this._clickableIndicator);

		if (options) {
			this.infoBoxStyle = options.style;
			this.text = options.text;
			this._announceText = (options.announceText === true);
			this.isClickable = (options.isClickable === true);
			this.clickableButtonAriaLabel = options.clickableButtonAriaLabel;
		}
	}

	public style(styles: IInfoBoxStyles): void {
		this._styles = styles;
		this.updateStyle();
	}

	public get announceText(): boolean {
		return this._announceText;
	}

	public set announceText(v: boolean) {
		this._announceText = v;
	}

	public get infoBoxStyle(): InfoBoxStyle {
		return this._infoBoxStyle;
	}

	public set infoBoxStyle(style: InfoBoxStyle) {
		this._infoBoxStyle = style;
		this._infoBoxElement.classList.remove(...this._infoBoxElement.classList);
		this._imageElement.classList.remove(...this._imageElement.classList);
		this._imageElement.setAttribute('aria-label', style);
		this._infoBoxElement.classList.add('infobox-container', style);
		this._imageElement.classList.add('infobox-image', style);
		this.updateStyle();
	}

	public get text(): string {
		return this._text;
	}

	public set text(text: string) {
		if (this._text !== text) {
			this._text = text;
			this._textElement.innerText = text;
			if (this.announceText) {
				if (this.infoBoxStyle === 'warning' || this.infoBoxStyle === 'error') {
					alert(text);
				}
				else {
					status(text);
				}
			}
		}
	}

	public get isClickable(): boolean {
		return this._isClickable;
	}

	public set isClickable(v: boolean) {
		if (this._isClickable === v) {
			return;
		}
		this._isClickable = v;
		if (this._isClickable) {
			this._clickableIndicator.style.display = '';
			this._clickableIndicator.tabIndex = 0;
			this._infoBoxElement.style.cursor = 'pointer';
			this._infoBoxElement.setAttribute('role', 'button');
			this._textElement.style.maxWidth = 'calc(100% - 75px)';
			this.registerClickListeners();
		} else {
			this._clickableIndicator.style.display = 'none';
			this._clickableIndicator.tabIndex = -1;
			this._infoBoxElement.style.cursor = 'default';
			this._infoBoxElement.removeAttribute('role');
			this._textElement.style.maxWidth = '';
			this.unregisterClickListeners();
		}
	}

	private registerClickListeners() {
		this._clickListenersDisposableStore.add(DOM.addDisposableListener(this._infoBoxElement, DOM.EventType.CLICK, e => {
			if (this._isClickable) {
				this._onDidClick.fire();
			}
		}));

		this._clickListenersDisposableStore.add(DOM.addDisposableListener(this._infoBoxElement, DOM.EventType.KEY_PRESS, e => {
			const event = new StandardKeyboardEvent(e);
			if (this._isClickable && (event.equals(KeyCode.Enter) || !event.equals(KeyCode.Space))) {
				this._onDidClick.fire();
				DOM.EventHelper.stop(e);
				return;
			}
		}));
	}

	private unregisterClickListeners() {
		this._clickListenersDisposableStore.clear();
	}

	public get clickableButtonAriaLabel(): string {
		return this._clickableButtonAriaLabel;
	}

	public set clickableButtonAriaLabel(v: string) {
		this._clickableButtonAriaLabel = v;
		this._clickableIndicator.ariaLabel = this._clickableButtonAriaLabel;
		this._clickableIndicator.title = this._clickableButtonAriaLabel;
	}

	private updateStyle(): void {
		if (this._styles) {
			let backgroundColor: Color;
			switch (this.infoBoxStyle) {
				case 'error':
					backgroundColor = this._styles.errorBackground;
					break;
				case 'warning':
					backgroundColor = this._styles.warningBackground;
					break;
				case 'success':
					backgroundColor = this._styles.successBackground;
					break;
				default:
					backgroundColor = this._styles.informationBackground;
					break;
			}
			this._infoBoxElement.style.backgroundColor = backgroundColor.toString();
		}
	}
}
