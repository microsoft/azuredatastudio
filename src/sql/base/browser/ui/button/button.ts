/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { Button as vsButton, IButtonOptions, IButtonStyles as vsIButtonStyles } from 'vs/base/browser/ui/button/button';
import * as DOM from 'vs/base/browser/dom';
import { Color } from 'vs/base/common/color';
import { Builder } from 'sql/base/browser/builder';

export interface IButtonStyles extends vsIButtonStyles {
	buttonFocusOutline?: Color;
}

export class Button extends vsButton {
	private buttonFocusOutline: Color;
	private $el: Builder;

	constructor(container: any, options?: IButtonOptions) {
		super(container, options);
		this.buttonFocusOutline = null;
		this.$el = new Builder(this.element);

		this.$el.on(DOM.EventType.FOCUS, (e) => {
			this.$el.style('outline-color', this.buttonFocusOutline ? this.buttonFocusOutline.toString() : null);
			this.$el.style('outline-width', '1px');
		});

		this.$el.on(DOM.EventType.MOUSE_DOWN, (e) => {
			const mouseEvent = e as MouseEvent;
			if (!this.$el.hasClass('disabled') && mouseEvent.button === 0) {
				this.$el.addClass('active');
			}
		});

		this.$el.on([DOM.EventType.MOUSE_UP], (e) => {
			DOM.EventHelper.stop(e);
			this.$el.removeClass('active');
		});
	}

	public style(styles: IButtonStyles): void {
		super.style(styles);
		this.buttonFocusOutline = styles.buttonFocusOutline;
	}

	public set title(value: string) {
		this.$el.title(value);
	}

	public setHeight(value: string) {
		this.$el.style('height', value);
	}

	public setWidth(value: string) {
		this.$el.style('width', value);
	}
}