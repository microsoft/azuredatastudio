/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button as vsButton, IButtonOptions, IButtonStyles as vsIButtonStyles } from 'vs/base/browser/ui/button/button';
import * as DOM from 'vs/base/browser/dom';
import { Color } from 'vs/base/common/color';

export interface IButtonStyles extends vsIButtonStyles {
	buttonFocusOutline?: Color;
}

export class Button extends vsButton {
	private buttonFocusOutline?: Color;

	constructor(container: HTMLElement, options?: IButtonOptions) {
		super(container, options);

		this._register(DOM.addDisposableListener(this.element, DOM.EventType.FOCUS, () => {
			this.element.style.outlineColor = this.buttonFocusOutline ? this.buttonFocusOutline.toString() : '';
			this.element.style.outlineWidth = '1px';
		}));

		this._register(DOM.addDisposableListener(this.element, DOM.EventType.MOUSE_DOWN, e => {
			if (!DOM.hasClass(this.element, 'disabled') && e.button === 0) {
				DOM.addClass(this.element, 'active');
			}
		}));

		this._register(DOM.addDisposableListener(this.element, DOM.EventType.MOUSE_UP, e => {
			DOM.EventHelper.stop(e);
			DOM.removeClass(this.element, 'active');
		}));
	}

	public style(styles: IButtonStyles): void {
		super.style(styles);
		this.buttonFocusOutline = styles.buttonFocusOutline;
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
