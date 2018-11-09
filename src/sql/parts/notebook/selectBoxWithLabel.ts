/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { ISelectBoxOptions } from 'vs/base/browser/ui/selectBox/selectBox';

import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';

export class SelectBoxWithLabel extends SelectBox {
	private _label: string;

	constructor(label: string,
		options: string[], selectedOption: string,
		contextViewProvider: IContextViewProvider, container?: HTMLElement, selectBoxOptions?: ISelectBoxOptions) {
		super(options, selectedOption, contextViewProvider, container, selectBoxOptions);

		this._label = label;
	}
	public render(container: HTMLElement): void {
		let labelOnTop = false;
		let outerDiv = document.createElement('div');
		let selectDiv = document.createElement('div');
		outerDiv.className = labelOnTop ? 'labelOnTopContainer' : 'labelOnLeftContainer';
		outerDiv.classList.add('action-item-label');

		container.appendChild(outerDiv);
		let labelText = document.createElement('div');
		labelText.innerHTML = this._label;
		labelText.className = 'notebook-info-label';
		outerDiv.appendChild(labelText);
		outerDiv.appendChild(selectDiv);
		super.render(selectDiv);
		selectDiv.getElementsByTagName('select')[0].classList.add('action-item-label');
	}

}