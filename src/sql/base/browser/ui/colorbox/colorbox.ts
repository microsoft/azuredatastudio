/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/colorbox';

import { Color } from 'vs/base/common/color';
import { Event, Emitter } from 'vs/base/common/event';
import { Widget } from 'vs/base/browser/ui/widget';
import * as DOM from 'vs/base/browser/dom';

export interface ColorboxOptions {
	name: string;
	class?: string[];
	label: string;
	colorName: string;
}

export interface ColorboxStyle {
	backgroundColor?: Color;
}

export class Colorbox extends Widget {
	readonly domNode: HTMLInputElement;
	private labelNode: HTMLLabelElement;
	private backgroundColor?: Color;

	private _onSelect = new Emitter<void>();
	public readonly onSelect: Event<void> = this._onSelect.event;

	private _checked: boolean;

	constructor(container: HTMLElement, opts: ColorboxOptions) {
		super();
		const colorboxContainer = DOM.$('.colorbox-container');
		this.domNode = DOM.$('input');
		this.domNode.type = 'radio';
		this.domNode.name = opts.name;
		this.domNode.id = opts.colorName;
		this._checked = false;

		this.domNode.classList.add('colorbox');
		if (opts.class) {
			this.domNode.classList.add(...opts.class);
		}
		this.domNode.setAttribute('aria-label', opts.label);
		this.labelNode = DOM.$('label.colorbox-label');
		this.labelNode.setAttribute('for', opts.colorName);
		this.labelNode.innerText = opts.colorName;

		colorboxContainer.appendChild(this.domNode);
		colorboxContainer.appendChild(this.labelNode);

		container.appendChild(colorboxContainer);

		this.onfocus(this.domNode, () => {
			this._onSelect.fire();
		});

	}

	public style(styles: ColorboxStyle): void {
		if (styles.backgroundColor) {
			this.backgroundColor = styles.backgroundColor;
		}
		this.updateStyle();
	}

	private updateStyle(): void {
		this.domNode.style.background = this.backgroundColor ? this.backgroundColor.toString() : this.domNode.style.background;
	}

	public get checked(): boolean {
		return this._checked;
	}

	public set checked(checked: boolean) {
		this._checked = checked;
		if (this._checked) {
			this.domNode.classList.add('checked');
		} else {
			this.domNode.classList.remove('checked');
		}
	}

	public focus() {
		this.domNode.focus();
	}
}
