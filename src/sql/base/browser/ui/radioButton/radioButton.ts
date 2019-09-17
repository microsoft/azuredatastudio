/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from 'vs/base/common/event';
import { Widget } from 'vs/base/browser/ui/widget';
import { withNullAsUndefined } from 'vs/base/common/types';

export interface IRadioButtonOptions {
	label: string;
	enabled?: boolean;
	checked?: boolean;
}

export class RadioButton extends Widget {

	private inputElement: HTMLInputElement;
	private _onClicked = new Emitter<void>();
	public readonly onClicked: Event<void> = this._onClicked.event;
	private _label: HTMLSpanElement;

	constructor(container: HTMLElement, opts: IRadioButtonOptions) {
		super();
		this.inputElement = document.createElement('input');
		this.inputElement.type = 'radio';
		this.inputElement.style.verticalAlign = 'middle';
		this.inputElement.style.margin = '3px';

		this._label = document.createElement('span');
		this._label.style.verticalAlign = 'middle';

		this.label = opts.label;
		this.enabled = opts.enabled || true;
		this.checked = opts.checked || false;
		this.onclick(this.inputElement, () => this._onClicked.fire());

		container.appendChild(this.inputElement);
		container.appendChild(this._label);
	}

	public set name(value: string | undefined) {
		if (value) {
			this.inputElement.setAttribute('name', value);
		}
	}

	public get name(): string | undefined {
		return withNullAsUndefined(this.inputElement.getAttribute('name'));
	}

	public set value(value: string | undefined) {
		if (value) {
			this.inputElement.setAttribute('value', value);
		}
	}

	public get value(): string | undefined {
		return withNullAsUndefined(this.inputElement.getAttribute('value'));
	}

	public set checked(val: boolean) {
		this.inputElement.checked = val;
	}

	public get checked(): boolean {
		return this.inputElement.checked;
	}

	public set enabled(val: boolean) {
		this.inputElement.disabled = !val;
	}

	public get enabled(): boolean {
		return !this.inputElement.disabled;
	}

	public isEnabled(): boolean {
		return !this.inputElement.hasAttribute('disabled');
	}

	public set label(val: string) {
		this._label.innerText = val;
		this.inputElement.setAttribute('aria-label', val);
	}

	public focus(): void {
		this.inputElement.focus();
	}

	public blur(): void {
		this.inputElement.blur();
	}
}
