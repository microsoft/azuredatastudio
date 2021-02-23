/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./infoButton';
import { Button as sqlButton } from 'sql/base/browser/ui/button/button';
import { IButtonOptions, IButtonStyles } from 'vs/base/browser/ui/button/button';

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

	private _styles: IButtonStyles;

	constructor(container: HTMLElement, options?: IInfoButtonOptions) {
		super(container, options);
		this._container = container;

		this._container.classList.add('info-button-container');

		this._main = document.createElement('div');
		this._main.classList.add('flexContainer');
		this._main.classList.add('info-main');

		this._iconContainer = document.createElement('div');
		this._iconContainer.classList.add('info-icon');
		this._iconContainer.style.alignItems = 'flex-start';

		this._iconElement = document.createElement('div');
		this._iconElement.classList.add('icon');

		this._textContainer = document.createElement('div');
		this._textContainer.classList.add('info-text');

		this._pTitle = document.createElement('p');
		this._pTitle.classList.add('info-title');
		this._pTitle.setAttribute('aria-hidden', 'false');

		this._pDesc = document.createElement('p');
		this._pDesc.classList.add('info-desc');
		this._pDesc.setAttribute('aria-hidden', 'false');

		this._textContainer.appendChild(this._pTitle);
		this._textContainer.appendChild(this._pDesc);

		this._iconContainer.appendChild(this._iconElement);

		this._main.appendChild(this._iconContainer);
		this._main.appendChild(this._textContainer);

		this.element.classList.add('info-button');
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
		this._iconElement.classList.add(this._iconClass!);
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

	style(styles: IButtonStyles): void {
		this._styles = styles;
		this.applyStyles();
	}

	applyStyles(): void {
		this.element.style.backgroundColor = this._styles?.buttonBackground?.toString();
		this.element.style.color = this._styles?.buttonForeground?.toString();
		this.element.style.borderColor = this._styles?.buttonBorder?.toString();
	}

	setHoverBackground(): void {
		this.element.style.backgroundColor = this._styles?.buttonHoverBackground?.toString();
	}
}
