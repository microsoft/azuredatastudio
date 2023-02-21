/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/colorbox';

import { Color } from 'vs/base/common/color';
import { Event, Emitter } from 'vs/base/common/event';
import { Widget } from 'vs/base/browser/ui/widget';
import * as DOM from 'vs/base/browser/dom';
import { generateUuid } from 'vs/base/common/uuid';

export interface ColorboxOptions {
	name: string;
	class?: string[];
	label: string;
}

export interface ColorboxStyle {
	backgroundColor?: Color;
}

export class Colorbox extends Widget {
	readonly radioButton: HTMLInputElement;
	readonly colorElement: HTMLDivElement;
	private labelNode: HTMLLabelElement;
	private backgroundColor?: Color;

	private _onSelect = new Emitter<void>();
	public readonly onSelect: Event<void> = this._onSelect.event;

	constructor(container: HTMLElement, opts: ColorboxOptions) {
		super();
		const colorboxContainer = DOM.$('.colorbox-container');
		this.colorElement = DOM.$('.color-element');
		const radiobuttonContainer = DOM.$('.color-selector-container');
		this.radioButton = DOM.$('input');
		this.radioButton.type = 'radio';
		this.radioButton.name = opts.name;
		this.radioButton.id = generateUuid();

		this.radioButton.classList.add('colorbox-radio');
		if (opts.class) {
			this.radioButton.classList.add(...opts.class);
		}
		this.radioButton.setAttribute('aria-label', opts.label);
		this.labelNode = DOM.$('label.colorbox-label');
		this.labelNode.setAttribute('for', this.radioButton.id);
		this.labelNode.innerText = opts.label;

		radiobuttonContainer.appendChild(this.radioButton);
		radiobuttonContainer.appendChild(this.labelNode);
		colorboxContainer.appendChild(this.colorElement);
		colorboxContainer.appendChild(radiobuttonContainer);
		container.appendChild(colorboxContainer);

		this.onfocus(this.radioButton, () => {
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
		this.colorElement.style.background = this.backgroundColor ? this.backgroundColor.toString() : this.radioButton.style.background;
	}

	public get checked(): boolean {
		return this.radioButton.checked;
	}

	public set checked(checked: boolean) {
		this.radioButton.checked = checked;
	}

	public focus() {
		this.radioButton.focus();
	}
}
