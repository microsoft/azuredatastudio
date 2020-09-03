/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button as sqlButton } from 'sql/base/browser/ui/button/button';
import * as DOM from 'vs/base/browser/dom';
import { createIconCssClass, IUserFriendlyIcon } from 'sql/workbench/browser/modelComponents/iconUtils';
import { URI } from 'vs/base/common/uri';

export interface IInfoButtonOptions {
	readonly description?: string,
	readonly iconClass: string,
	readonly iconHeight: string | number,
	readonly iconPath: IUserFriendlyIcon,
	readonly iconWidth: string | number,
	readonly title?: string
}

export class InfoButton extends sqlButton {
	private _infoElement: HTMLElement;
	private options: IInfoButtonOptions;

	private _description: string;
	private _iconClass: string;
	private _iconHeight: string | number;
	private _iconPath: IUserFriendlyIcon;
	private _iconWidth: string | number;
	private _title: string;

	constructor(container: HTMLElement, options?: IInfoButtonOptions) {
		super(container, options);

		this._description = this.options.description;
		this._iconPath = this.options.iconPath;
		this._iconClass = createIconCssClass(this.options.iconPath);
		this._iconHeight = this.options.iconHeight;
		this._iconWidth = this.options.iconWidth;
		this._title = this.options.title;

		this._infoElement = document.createElement('div');
		DOM.addClass(this._infoElement, 'wrapper');

		this._infoElement.innerText = this.title + ' ' + this._description;

		this.element.appendChild(this._infoElement);
	}

	// public set title(value: string) {
	// 	this.element.title = value;
	// 	this._title = value;
	// }

	// public set ariaLabel(value: string) {
	// 	this.element.setAttribute('aria-label', value);
	// }

	// public setHeight(value: string) {
	// 	this.element.style.height = value;
	// }

	// public setWidth(value: string) {
	// 	this.element.style.width = value;
	// }
}
