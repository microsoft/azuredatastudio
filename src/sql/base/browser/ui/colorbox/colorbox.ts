/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/colorbox';
import { Event, Emitter } from 'vs/base/common/event';
import { Widget } from 'vs/base/browser/ui/widget';
import * as DOM from 'vs/base/browser/dom';
import { generateUuid } from 'vs/base/common/uuid';

export interface ColorboxOptions {
	name: string;
	class?: string[];
	color: string;
}

export class Colorbox extends Widget {
	readonly radioButton: HTMLInputElement;
	readonly colorElement: HTMLDivElement;
	private labelNode: HTMLLabelElement;

	private _onSelect = this._register(new Emitter<void>());
	public readonly onSelect: Event<void> = this._onSelect.event;

	constructor(container: HTMLElement, opts: ColorboxOptions) {
		super();
		const colorboxContainer = DOM.$('.colorbox-container');
		this.colorElement = DOM.$('.color-element');
		const radiobuttonContainer = DOM.$('.color-selector-container');
		this.colorElement.style.background = opts.color;
		this.radioButton = DOM.$('input');
		this.radioButton.type = 'radio';
		this.radioButton.name = opts.name;
		this.radioButton.id = generateUuid();

		this.radioButton.classList.add('colorbox-radio');
		if (opts.class) {
			this.radioButton.classList.add(...opts.class);
		}
		this.radioButton.setAttribute('aria-label', opts.color);
		this.labelNode = DOM.$('label.colorbox-label');
		this.labelNode.setAttribute('for', this.radioButton.id);
		this.labelNode.innerText = opts.color;

		radiobuttonContainer.appendChild(this.radioButton);
		radiobuttonContainer.appendChild(this.labelNode);
		colorboxContainer.appendChild(this.colorElement);
		colorboxContainer.appendChild(radiobuttonContainer);
		container.appendChild(colorboxContainer);

		this.onfocus(this.radioButton, () => {
			this._onSelect.fire();
		});

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
