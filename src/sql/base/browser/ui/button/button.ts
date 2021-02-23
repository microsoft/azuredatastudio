/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button as vsButton, IButtonOptions, IButtonStyles as vsIButtonStyles } from 'vs/base/browser/ui/button/button';
import { Color } from 'vs/base/common/color';

export interface IButtonStyles extends vsIButtonStyles {
}

export class Button extends vsButton {
	protected buttonFocusOutline?: Color;

	constructor(container: HTMLElement, options?: IButtonOptions) {
		super(container, options);
	}

	public set title(value: string) {
		this.element.title = value;
	}

	public set ariaLabel(value: string) {
		this.element.setAttribute('aria-label', value);
	}

	public setHeight(value: string) {
		this.element.style.height = value;
	}

	public setWidth(value: string) {
		this.element.style.width = value;
	}
}
