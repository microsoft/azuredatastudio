/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button as sqlButton } from 'sql/base/browser/ui/button/button';
import * as DOM from 'vs/base/browser/dom';
import { IButtonOptions } from 'vs/base/browser/ui/button/button';
import { URI } from 'vs/base/common/uri';

type IUserFriendlyIcon = string | URI | { light: string | URI; dark: string | URI };

export interface IInfoButtonOptions extends IButtonOptions {
	description: string,
	buttonMaxHeight: number,
	iconClass: string,
	iconHeight: number,
	iconWidth: number,
	iconPath: IUserFriendlyIcon,
	textTitle: string,
	buttonMaxWidth: number,
}

export class InfoButton extends sqlButton {
	private _container: HTMLElement;
	private _main: HTMLElement;
	private _iconContainer: HTMLElement;
	private _iconElement: HTMLElement;
	private _textContainer: HTMLElement;
	private _pTitle: HTMLElement;
	private _pDesc: HTMLElement;

	private _description: string;
	private _buttonMaxHeight: number;
	private _iconClass: string;
	private _iconHeight: number;
	private _iconWidth: number;
	private _iconPath: IUserFriendlyIcon;
	private _textTitle: string;
	private _buttonMaxWidth: number;

	constructor(container: HTMLElement, options?: IInfoButtonOptions) {
		super(container, options);
		this._container = container;

		{ // Creates the elements
			this._container.style.display = 'flex';
			this._container.style.justifyContent = 'space-around';

			this._main = document.createElement('div');
			DOM.addClass(this._main, 'flexContainer');
			this._main.style.cursor = 'pointer';
			this._main.style.backgroundColor = '#FFFFFF';
			this._main.style.borderRadius = '4px';
			this._main.style.boxShadow = '0px 1px 4px rgba(0, 0, 0, 0.14)';
			this._main.style.padding = '10px';

			this._iconContainer = document.createElement('div');
			this._iconContainer.style.alignItems = 'flex-start';
			this._iconContainer.style.display = 'flex';
			this._iconContainer.style.flexFlow = 'column';
			this._iconContainer.style.paddingRight = '10px';

			this._iconElement = document.createElement('div');
			DOM.addClass(this._iconElement, 'icon');

			this._textContainer = document.createElement('div');
			this._textContainer.style.color = '#006ab1';
			this._textContainer.style.display = 'flex';
			this._textContainer.style.flexFlow = 'column';
			this._textContainer.style.justifyContent = 'space-between';
			this._textContainer.style.padding = '0 0 0 10px';
			this._textContainer.style.margin = '0px';

			this._pTitle = document.createElement('p');
			this._pTitle.setAttribute('aria-hidden', 'false');
			this._pTitle.style.fontSize = '14px';
			this._pTitle.style.fontWeight = 'bold';
			this._pTitle.style.lineHeight = '20px';
			this._pTitle.style.margin = '0px';

			this._pDesc = document.createElement('p');
			this._pDesc.setAttribute('aria-hidden', 'false');
			this._pDesc.style.fontSize = '12px';
			this._pDesc.style.lineHeight = '16px';
			this._pDesc.style.margin = '0px';

			this._textContainer.appendChild(this._pTitle);
			this._textContainer.appendChild(this._pDesc);

			this._iconContainer.appendChild(this._iconElement);

			this._main.appendChild(this._iconContainer);
			this._main.appendChild(this._textContainer);
			this.element.appendChild(this._main);
			this.element.style.background = 'none';
			this.element.style.display = 'inline-block';
		}
		this.infoButtonOptions = options;
	}

	public get textTitle(): string {
		return this._textTitle;
	}
	public set textTitle(value: string) {
		this._textTitle = value;
		this._pTitle.innerText = this.textTitle;
	}

	public get description(): string {
		return this._description;
	}
	public set description(value: string) {
		this._description = value;
		this._pDesc.innerText = this.description;
	}

	public get buttonMaxHeight(): number {
		return this._buttonMaxHeight;
	}
	public set buttonMaxHeight(value: number) {
		this._buttonMaxHeight = value;
		this._main.style.maxHeight = this._buttonMaxHeight.toString() + 'px';
		this._iconContainer.style.height = (this._buttonMaxHeight - 20).toString() + 'px';
		this._textContainer.style.height = (this._buttonMaxHeight - 20).toString() + 'px';
	}

	public get buttonMaxWidth(): number {
		return this._buttonMaxWidth;
	}
	public set buttonMaxWidth(value: number) {
		this._buttonMaxWidth = value;
		this._main.style.width = this._buttonMaxWidth.toString() + 'px';
		this._textContainer.style.width = (this._buttonMaxWidth - this._iconWidth).toString() + 'px';
	}

	public get iconHeight(): number {
		return this._iconHeight;
	}
	public set iconHeight(value: number) {
		this._iconHeight = value;
		this._iconElement.style.height = this._iconHeight.toString() + 'px';
	}

	public get iconWidth(): number {
		return this._iconWidth;
	}
	public set iconWidth(value: number) {
		this._iconWidth = value;
		this._iconContainer.style.width = this._iconWidth.toString() + 'px';
		this._iconElement.style.width = this._iconWidth.toString() + 'px';
	}

	public get iconClass(): string {
		return this._iconClass;
	}
	public set iconClass(value: string) {
		this._iconClass = value;
	}

	public get iconPath(): IUserFriendlyIcon {
		return this._iconPath;
	}
	public set iconPath(value: IUserFriendlyIcon) {
		this._iconPath = value;
		DOM.addClass(this._iconElement, this._iconPath.toString());
	}

	public set infoButtonOptions(options: IInfoButtonOptions) {
		if (!options) {
			return;
		}
		this.buttonMaxHeight = options.buttonMaxHeight;
		this.buttonMaxWidth = options.buttonMaxWidth;
		this.description = options.description;
		this.iconHeight = options.iconHeight;
		this.iconWidth = options.iconWidth;
		this.iconClass = options.iconClass;
		this.iconPath = options.iconPath;
		this.textTitle = options.textTitle;
	}
}
