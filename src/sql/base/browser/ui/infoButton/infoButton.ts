/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./infoButton';
import { Button as sqlButton } from 'sql/base/browser/ui/button/button';
import * as DOM from 'vs/base/browser/dom';
import { IButtonOptions } from 'vs/base/browser/ui/button/button';

export interface IInfoButtonOptions extends IButtonOptions {
	buttonMaxHeight: number,
	buttonMaxWidth: number,
	description: string,
	iconClass: string,
	iconHeight: number,
	iconWidth: number,
	title: string,
}

export class InfoButton extends sqlButton {
	private _container: HTMLElement;
	private _main: HTMLElement;
	private _iconContainer: HTMLElement;
	private _iconElement: HTMLElement;
	private _textContainer: HTMLElement;
	private _pTitle: HTMLElement;
	private _pDesc: HTMLElement;

	private _buttonMaxHeight?: number;
	private _buttonMaxWidth?: number;
	private _description?: string;
	private _iconClass?: string;
	private _iconHeight?: number;
	private _iconWidth?: number;
	private _title?: string;

	constructor(container: HTMLElement, options?: IInfoButtonOptions) {
		super(container, options);
		this._container = container;

		DOM.addClass(this._container, 'info-button-container');

		this._main = document.createElement('div');
		DOM.addClass(this._main, 'flexContainer');
		DOM.addClass(this._main, 'info-main');

		this._iconContainer = document.createElement('div');
		DOM.addClass(this._iconContainer, 'info-icon');
		this._iconContainer.style.alignItems = 'flex-start';

		this._iconElement = document.createElement('div');
		DOM.addClass(this._iconElement, 'icon');

		this._textContainer = document.createElement('div');
		DOM.addClass(this._textContainer, 'info-text');

		this._pTitle = document.createElement('p');
		DOM.addClass(this._pTitle, 'info-title');
		this._pTitle.setAttribute('aria-hidden', 'false');

		this._pDesc = document.createElement('p');
		DOM.addClass(this._pDesc, 'info-desc');
		this._pDesc.setAttribute('aria-hidden', 'false');

		this._textContainer.appendChild(this._pTitle);
		this._textContainer.appendChild(this._pDesc);

		this._iconContainer.appendChild(this._iconElement);

		this._main.appendChild(this._iconContainer);
		this._main.appendChild(this._textContainer);

		DOM.addClass(this.element, 'info-button');
		this.element.appendChild(this._main);
		this.element.style.background = 'none';

		this.infoButtonOptions = options;
	}

	public get title(): string {
		return this._title!;
	}
	public set title(value: string) {
		this._title! = value;
		this._pTitle.innerText = this.title;
	}

	public get description(): string {
		return this._description!;
	}
	public set description(value: string) {
		this._description! = value;
		this._pDesc.innerText = this.description;
	}

	public get buttonMaxHeight(): number {
		return this._buttonMaxHeight!;
	}
	public set buttonMaxHeight(value: number) {
		this._buttonMaxHeight! = value;
		this._main.style.maxHeight = `${this._buttonMaxHeight!}px`;
		this._iconContainer.style.height = `${this._buttonMaxHeight! - 20}px`;
		this._textContainer.style.height = `${this._buttonMaxHeight! - 20}px`;
	}

	public get buttonMaxWidth(): number {
		return this._buttonMaxWidth!;
	}
	public set buttonMaxWidth(value: number) {
		this._buttonMaxWidth! = value;
		this._main.style.width = `${this._buttonMaxWidth!}px`;
		this._textContainer.style.width = `${this._buttonMaxWidth! - this._iconWidth!}px`;
	}

	public get iconHeight(): number {
		return this._iconHeight!;
	}
	public set iconHeight(value: number) {
		this._iconHeight! = value;
		this._iconElement.style.height = `${this._iconHeight!}px`;
	}

	public get iconWidth(): number {
		return this._iconWidth!;
	}
	public set iconWidth(value: number) {
		this._iconWidth! = value;
		this._iconContainer.style.width = `${this._iconWidth!}px`;
		this._iconElement.style.width = `${this._iconWidth!}px`;
	}

	public get iconClass(): string {
		return this._iconClass!;
	}
	public set iconClass(value: string) {
		this._iconClass! = value;
		DOM.addClass(this._iconElement, this._iconClass!);
	}

	public set infoButtonOptions(options: IInfoButtonOptions | undefined) {
		if (!options) {
			return;
		}
		this.buttonMaxHeight = options.buttonMaxHeight;
		this.buttonMaxWidth = options.buttonMaxWidth;
		this.description = options.description;
		this.iconHeight = options.iconHeight;
		this.iconWidth = options.iconWidth;
		this.iconClass = options.iconClass;
		this.title = options.title;
	}
}
