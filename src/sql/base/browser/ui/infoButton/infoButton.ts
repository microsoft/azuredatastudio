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
	iconWidth: string | number,
	iconPath: IUserFriendlyIcon,
	textTitle: string
}

export class InfoButton extends sqlButton {
	private _main: HTMLElement;
	private _columnWrapper: HTMLElement;
	private _rowWrapper: HTMLElement;
	private _columnOneWrapper: HTMLElement;
	private _iconContainer: HTMLElement;
	private _columnTwoWrapper: HTMLElement;
	private _textContainer: HTMLElement;
	private _titleContainer: HTMLElement;
	private _pTitle: HTMLElement;
	private _descriptionContainer: HTMLElement;
	private _pDesc: HTMLElement;


	private _description?: string;
	private _iconClass?: string;
	private _iconHeight?: string | number;
	private _iconWidth?: string | number;
	private _iconPath?: IUserFriendlyIcon;
	private _textTitle?: string;

	constructor(container: HTMLElement, options?: IInfoButtonOptions) {
		super(container, options);

		{ // Creates the elements
			this._main = document.createElement('div');
			DOM.addClass(this._main, 'divContainer');
			this._main.style.cursor = 'pointer';
			this._main.style.height = '116px';
			this._main.style.width = '250px';

			this._columnWrapper = document.createElement('div');
			this._columnWrapper.style.padding = '10px';
			this._columnWrapper.style.borderRadius = '5px';
			this._columnWrapper.style.border = '1px solid';

			this._rowWrapper = document.createElement('div');
			DOM.addClass(this._rowWrapper, 'flexContainer');
			this._rowWrapper.style.flexDirection = 'row';
			this._rowWrapper.style.alignItems = 'flex-start';
			this._rowWrapper.style.height = '93px';
			this._rowWrapper.style.width = '250px';

			this._columnOneWrapper = document.createElement('div');
			this._columnOneWrapper.style.paddingTop = '10px';
			this._columnOneWrapper.style.paddingRight = '10px';

			this._iconContainer = document.createElement('div');
			DOM.addClass(this._iconContainer, 'icon');
			this._iconContainer.style.backgroundSize = '20px 20px';
			this._iconContainer.style.width = '20px';
			this._iconContainer.style.height = '20px';

			this._columnTwoWrapper = document.createElement('div');
			this._columnTwoWrapper.style.paddingTop = '5px';
			this._columnTwoWrapper.style.paddingRight = '10px';

			this._textContainer = document.createElement('div');
			DOM.addClass(this._textContainer, 'flexContainer');
			this._textContainer.style.flexDirection = 'column';
			this._textContainer.style.justifyContent = 'space-between';
			this._textContainer.style.height = '96px';
			this._textContainer.style.width = '200px';

			this._titleContainer = document.createElement('div');
			this._titleContainer.style.padding = '0px 0px 5px';
			this._titleContainer.style.width = '200px';
			this._titleContainer.style.margin = '0px';
			this._pTitle = document.createElement('p');
			this._pTitle.setAttribute('aria-hidden', 'false');
			this._pTitle.style.fontSize = '14px';
			this._pTitle.style.fontWeight = 'bold';
			this._pTitle.style.margin = '0px';

			this._descriptionContainer = document.createElement('div');
			this._descriptionContainer.style.padding = '0px 0px 5px';
			this._descriptionContainer.style.width = '200px';
			this._descriptionContainer.style.margin = '0px';
			this._pDesc = document.createElement('p');
			this._pDesc.setAttribute('aria-hidden', 'false');
			this._pDesc.style.fontSize = '13px';
			this._pDesc.style.margin = '0px';


			this._titleContainer.appendChild(this._pTitle);
			this._descriptionContainer.appendChild(this._pDesc);

			this._textContainer.append(this._titleContainer);
			this._textContainer.append(this._descriptionContainer);

			this._columnOneWrapper.append(this._iconContainer);
			this._columnTwoWrapper.appendChild(this._textContainer);

			this._rowWrapper.append(this._columnOneWrapper);
			this._rowWrapper.append(this._columnTwoWrapper);

			this._columnWrapper.append(this._rowWrapper);

			this._main.append(this._columnWrapper);
			this.element.appendChild(this._main);
		}
		this.infoButtonOptions = options;
	}

	public get textTitle(): string {
		return this._textTitle;
	}
	public set textTitle(value: string | undefined) {
		this._textTitle = value;
		this._pTitle.innerText = this.textTitle;
	}

	public get description(): string | undefined {
		return this._description;
	}
	public set description(value: string | undefined) {
		this._description = value;
		this._pDesc.innerText = this.description;
	}

	public get iconHeight(): string | number | undefined {
		return this._iconHeight;
	}
	public set iconHeight(value: string | number | undefined) {
		this._iconHeight = value;
	}

	public get iconWidth(): string | number | undefined {
		return this._iconWidth;
	}
	public set iconWidth(value: string | number | undefined) {
		this._iconHeight = value;
	}

	public get iconClass(): string | undefined {
		return this._iconClass;
	}
	public set iconClass(value: string | undefined) {
		this._iconClass = value;
	}

	public get iconPath(): IUserFriendlyIcon | undefined {
		return this._iconPath;
	}
	public set iconPath(value: IUserFriendlyIcon | undefined) {
		this._iconPath = value;
		DOM.addClass(this._iconContainer, this._iconPath.toString());
	}

	public set infoButtonOptions(options: IInfoButtonOptions | undefined) {
		if (!options) {
			return;
		}
		this.textTitle = options.textTitle;
		this.description = options.description;
		this.iconHeight = options.iconHeight;
		this.iconWidth = options.iconWidth;
		this.iconClass = options.iconClass;
		this.iconPath = options.iconPath;
	}
}
