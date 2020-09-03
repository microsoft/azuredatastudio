/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button as sqlButton } from 'sql/base/browser/ui/button/button';
import * as DOM from 'vs/base/browser/dom';
import { createIconCssClass, IUserFriendlyIcon } from 'sql/workbench/browser/modelComponents/iconUtils';
import { URI } from 'vs/base/common/uri';
import { IButtonOptions } from 'vs/base/browser/ui/button/button';

export interface IInfoButtonOptions extends IButtonOptions {
	description: string,
	iconClass: string,
	iconHeight: string | number,
	iconPath: IUserFriendlyIcon,
	iconWidth: string | number,
	textTitle: string
}

export class InfoButton extends sqlButton {
	private _infoElement: HTMLElement;
	private _infoOptions: IInfoButtonOptions;
	// private options: IInfoButtonOptions;

	// private _description: string;
	// private _iconClass: string;
	// private _iconHeight: string | number;
	// private _iconPath: IUserFriendlyIcon;
	// private _iconWidth: string | number;
	private _textTitle: string;

	constructor(container: HTMLElement, options?: IInfoButtonOptions) {
		super(container, options);
		this._infoOptions = options;

		// this._description = this._infoOptions.description;
		// this._iconPath = this._infoOptions.iconPath;
		// this._iconClass = createIconCssClass(this._infoOptions.iconPath);
		// this._iconHeight = this._infoOptions.iconHeight;
		// this._iconWidth = this._infoOptions.iconWidth;
		//this._textTitle = this._infoOptions.textTitle;

		this._infoElement = document.createElement('div');
		DOM.addClass(this._infoElement, 'wrapper');

		//this._infoElement.innerText = this.textTitle;

		this.element.appendChild(this._infoElement);
	}
	public get textTitle(): string {
		return this._textTitle;
	}
	public set textTitle(value: string) {
		this._textTitle = value;
		this._infoElement.innerText = this.textTitle;

		// Also change element
		// eg. this.button.innerText = title
	}
	// public setHeight(value: string) {
	// 	this.element.style.height = value;
	// }

	// public setWidth(value: string) {
	// 	this.element.style.width = value;
	// }
}
