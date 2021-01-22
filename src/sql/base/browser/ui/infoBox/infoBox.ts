/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/infoBox';
import { Disposable } from 'vs/base/common/lifecycle';
import { alert, status } from 'vs/base/browser/ui/aria/aria';
import { IThemable } from 'vs/base/common/styler';
import { Color } from 'vs/base/common/color';

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
}

export class InfoBox extends Disposable implements IThemable {
	private _imageElement: HTMLDivElement;
	private _textElement: HTMLDivElement;
	private _infoBoxElement: HTMLDivElement;
	private _text = '';
	private _infoBoxStyle: InfoBoxStyle = 'information';
	private _styles: IInfoBoxStyles;
	private _announceText: boolean = false;

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
		if (options) {
			this.infoBoxStyle = options.style;
			this.text = options.text;
			this._announceText = (options.announceText === true);
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
