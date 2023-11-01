/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/infoBox';
import * as azdata from 'azdata';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { alert, status } from 'vs/base/browser/ui/aria/aria';
import * as DOM from 'vs/base/browser/dom';
import { Event, Emitter } from 'vs/base/common/event';
import { Codicon } from 'vs/base/common/codicons';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { ILogService } from 'vs/platform/log/common/log';
import { ThemeIcon } from 'vs/base/common/themables';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Link } from 'vs/platform/opener/browser/link';

export interface IInfoBoxStyles {
	informationBackground: string | undefined;
	warningBackground: string | undefined;
	errorBackground: string | undefined;
	successBackground: string | undefined;
}

export type InfoBoxStyle = 'information' | 'warning' | 'error' | 'success';

export interface InfoBoxOptions {
	text: string;
	links?: azdata.LinkArea[];
	style: InfoBoxStyle;
	announceText?: boolean;
	isClickable?: boolean;
	clickableButtonAriaLabel?: string;
}

export class InfoBox extends Disposable {
	private _imageElement: HTMLDivElement;
	private _textElement: HTMLDivElement;
	private _infoBoxElement: HTMLDivElement;
	private _clickableIndicator: HTMLDivElement;
	private _text = '';
	private _links: azdata.LinkArea[] = [];
	private _infoBoxStyle: InfoBoxStyle = 'information';
	private _announceText: boolean = false;
	private _isClickable: boolean = false;
	private _clickableButtonAriaLabel: string;

	private _clickListenersDisposableStore = new DisposableStore();
	private _onDidClick: Emitter<void> = this._register(new Emitter<void>());
	get onDidClick(): Event<void> { return this._onDidClick.event; }

	private _linkListenersDisposableStore = new DisposableStore();
	private _onLinkClick: Emitter<azdata.InfoBoxLinkClickEventArgs> = this._register(new Emitter<azdata.InfoBoxLinkClickEventArgs>());
	get onLinkClick(): Event<azdata.InfoBoxLinkClickEventArgs> { return this._onLinkClick.event; }

	constructor(
		container: HTMLElement,
		private readonly _styles: IInfoBoxStyles,
		options: InfoBoxOptions | undefined,
		@IOpenerService private _openerService: IOpenerService,
		@ILogService private _logService: ILogService,
		@IInstantiationService private instantiationService: IInstantiationService,
	) {
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
		this._clickableIndicator.classList.add('infobox-clickable-arrow', ...ThemeIcon.asClassNameArray(Codicon.arrowRight));
		this._infoBoxElement.appendChild(this._clickableIndicator);

		if (options) {
			this.infoBoxStyle = options.style;
			this.links = options.links;
			this.text = options.text;
			this._announceText = (options.announceText === true);
			this.isClickable = (options.isClickable === true);
			this.clickableButtonAriaLabel = options.clickableButtonAriaLabel;
		}
		this.updateClickableState();
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

	public get links(): azdata.LinkArea[] {
		return this._links;
	}

	public set links(v: azdata.LinkArea[]) {
		this._links = v ?? [];
		this.createTextWithHyperlinks();
	}

	public get text(): string {
		return this._text;
	}

	public set text(text: string) {
		if (this._text !== text) {
			this._text = text;
			this.createTextWithHyperlinks();
		}
	}

	public createTextWithHyperlinks() {
		let text = this._text;
		DOM.clearNode(this._textElement);
		this._linkListenersDisposableStore.clear();

		for (let i = 0; i < this._links.length; i++) {
			const placeholderIndex = text.indexOf(`{${i}}`);
			if (placeholderIndex < 0) {
				this._logService.warn(`Could not find placeholder text {${i}} in text '${text}'. Link: ${JSON.stringify(this._links[i])}`);
				// Just continue on so we at least show the rest of the text if just one was missed or something
				continue;
			}

			// First insert any text from the start of the current string fragment up to the placeholder
			let curText = text.slice(0, placeholderIndex);
			if (curText) {
				const span = DOM.$('span');
				span.innerText = text.slice(0, placeholderIndex);
				this._textElement.appendChild(span);
			}

			// Now insert the link element
			const link = this._links[i];

			/**
			 * If the url is empty, electron displays the link as visited.
			 * TODO: Investigate why it happens and fix the issue iin electron/vsbase.
			 */
			const linkElement = this._register(this.instantiationService.createInstance(Link,
				this._textElement, {
				label: link.text,
				href: link.url === '' ? ' ' : link.url
			}, undefined)).el;

			if (link.accessibilityInformation) {
				linkElement.setAttribute('aria-label', link.accessibilityInformation.label);
				if (link.accessibilityInformation.role) {
					linkElement.setAttribute('role', link.accessibilityInformation.role);
				}
			}
			this._linkListenersDisposableStore.add(DOM.addDisposableListener(linkElement, DOM.EventType.CLICK, e => {
				this._onLinkClick.fire({
					index: i,
					link: link
				});
				if (link.url) {
					this.openLink(link.url);
				}
				e.stopPropagation();
			}));

			this._linkListenersDisposableStore.add(DOM.addDisposableListener(linkElement, DOM.EventType.KEY_PRESS, e => {
				const event = new StandardKeyboardEvent(e);
				if (this._isClickable && (event.equals(KeyCode.Enter) || !event.equals(KeyCode.Space))) {
					this._onLinkClick.fire({
						index: i,
						link: link
					});
					if (link.url) {
						this.openLink(link.url);
					}
					e.stopPropagation();
				}
			}));
			this._textElement.appendChild(linkElement);
			text = text.slice(placeholderIndex + 3);
		}

		if (text) {
			const span = DOM.$('span');
			span.innerText = text;
			this._textElement.appendChild(span);
		}

		if (this.announceText) {
			if (this.infoBoxStyle === 'warning' || this.infoBoxStyle === 'error') {
				alert(text);
			}
			else {
				status(text);
			}
		}
	}

	private openLink(href: string): void {
		this._openerService.open(href);
	}

	public get isClickable(): boolean {
		return this._isClickable;
	}

	public set isClickable(v: boolean) {
		if (this._isClickable === v) {
			return;
		}
		this._isClickable = v;
		this.updateClickableState();
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
		let backgroundColor: string | undefined;
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
		this._infoBoxElement.style.backgroundColor = backgroundColor;
	}

	private updateClickableState(): void {
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
}
