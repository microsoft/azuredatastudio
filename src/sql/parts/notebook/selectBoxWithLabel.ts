/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { ISelectBoxOptions } from 'vs/base/browser/ui/selectBox/selectBox';

import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';

export class SelectBoxWithLabel extends SelectBox {
	private _label: string;
	private _outterContainer: HTMLElement;
	private _innerContainer: HTMLElement;

	constructor(label: string,
		options: string[], selectedOption: string,
		contextViewProvider: IContextViewProvider, container?: HTMLElement, selectBoxOptions?: ISelectBoxOptions) {
			let outterContainer: HTMLElement;
			let dropdownContainer: HTMLElement;

			if (!container) {
				outterContainer = document.createElement('div');
			}
			else {
				outterContainer = container;
			}

			outterContainer.className = 'notebook-info-label';
			dropdownContainer = document.createElement('div');
			dropdownContainer.className = 'notebook-toolbar-dropdown';

			super(options, selectedOption, contextViewProvider, dropdownContainer, selectBoxOptions);

			this._outterContainer = outterContainer;
			this._innerContainer = dropdownContainer;
			this._label = label;
	}
	public render(container?: HTMLElement): void {
		let labelText = document.createElement('div');
		labelText.innerHTML = this._label;

		this._outterContainer.appendChild(labelText);
		this._outterContainer.appendChild(this._innerContainer);
		super.render(this._innerContainer);
	}
}