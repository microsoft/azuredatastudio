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
	iconClass: string,
	iconHeight: string | number,
	iconPath: IUserFriendlyIcon,
	iconWidth: string | number,
	textTitle: string
}

export class InfoButton extends sqlButton {
	private _infoElement: HTMLElement;

	private _description?: string;
	// private _iconClass: string;
	// private _iconHeight: string | number;
	// private _iconPath: IUserFriendlyIcon;
	// private _iconWidth: string | number;
	private _textTitle?: string;

	constructor(container: HTMLElement, options?: IInfoButtonOptions) {
		super(container, options);

		{ // Creates the elements
			this._infoElement = document.createElement('div');
			DOM.addClass(this._infoElement, 'wrapper');
			this.element.appendChild(this._infoElement);
		}
		this.infoButtonOptions = options;
	}

	public get textTitle(): string {
		return this._textTitle;
	}

	public set textTitle(value: string | undefined) {
		this._textTitle = value;
		this._infoElement.innerText = this.textTitle;
	}

	public get description(): string | undefined {
		return this._description;
	}

	public set description(value: string | undefined) {
		this._description = value;
	}

	public set infoButtonOptions(options: IInfoButtonOptions | undefined) {
		if (!options) {
			return;
		}
		this.textTitle = options.textTitle; // Will call line 46
		this.description = options.description; // will call line 51
	}

	// public setHeight(value: string) {
	// 	this.element.style.height = value;
	// }

	// public setWidth(value: string) {
	// 	this.element.style.width = value;
	// }
}
