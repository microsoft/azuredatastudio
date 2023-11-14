/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/checkbox';
import { Event, Emitter } from 'vs/base/common/event';
import { Widget } from 'vs/base/browser/ui/widget';
import { generateUuid } from 'vs/base/common/uuid';

export interface ICheckboxOptions extends Partial<ICheckboxStyles> {
	label: string;
	enabled?: boolean;
	checked?: boolean;
	onChange?: (val: boolean) => void;
	ariaLabel?: string;
	ariaDescription?: string;
}

export interface ICheckboxStyles {
	disabledCheckboxForeground?: string;
}

export class Checkbox extends Widget {
	private _el: HTMLInputElement;
	private _label: HTMLSpanElement;

	private _onChange = this._register(new Emitter<boolean>());
	public readonly onChange: Event<boolean> = this._onChange.event;

	private _onFocus = this._register(new Emitter<void>());
	public readonly onFocus: Event<void> = this._onFocus.event;

	constructor(container: HTMLElement, private readonly _options: ICheckboxOptions) {
		super();
		const id = generateUuid();
		this._el = document.createElement('input');
		this._el.type = 'checkbox';
		this._el.style.verticalAlign = 'middle';
		this._el.id = id;

		if (_options.ariaLabel) {
			this.ariaLabel = _options.ariaLabel;
		}

		if (_options.ariaDescription) {
			this._el.setAttribute('aria-description', _options.ariaDescription);
		}

		this.onchange(this._el, e => {
			this._onChange.fire(this.checked);
		});

		this.onfocus(this._el, () => {
			this._onFocus.fire();
		});

		this._label = document.createElement('label');
		this._label.style.verticalAlign = 'middle';
		this._label.setAttribute('for', id);

		this.label = _options.label;
		this.enabled = _options.enabled ?? true;
		this.checked = _options.checked ?? false;

		if (_options.onChange) {
			this.onChange(_options.onChange);
		}

		container.appendChild(this._el);
		container.appendChild(this._label);
	}

	public set label(val: string) {
		this._label.innerText = val;
		// Default the aria label to the label if one wasn't specifically set by the user
		if (!this.ariaLabel) {
			this.ariaLabel = val;
		}
	}

	public set enabled(val: boolean) {
		this._el.disabled = !val;
		this._label.style.color = !this.enabled && this._options.disabledCheckboxForeground ? this._options.disabledCheckboxForeground : 'inherit';
	}

	public get enabled(): boolean {
		return !this._el.disabled;
	}

	public set checked(val: boolean) {
		this._el.checked = val;
	}

	public get checked(): boolean {
		return this._el.checked;
	}

	public set ariaLabel(val: string | null) {
		this._el.setAttribute('aria-label', val || '');
	}

	public get ariaLabel(): string | null {
		return this._el.getAttribute('aria-label');
	}

	public set required(val: boolean) {
		this._el.required = val;
	}

	public get required(): boolean {
		return this._el.required;
	}

	public focus(): void {
		this._el.focus();
	}

	public disable(): void {
		this.enabled = false;
	}

	public enable(): void {
		this.enabled = true;
	}

	public setHeight(value: string) {
		this._el.style.height = value;
	}

	public setWidth(value: string) {
		this._el.style.width = value;
	}
}
