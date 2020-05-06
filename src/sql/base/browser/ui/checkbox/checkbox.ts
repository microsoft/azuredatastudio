/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/checkbox';

import { Color } from 'vs/base/common/color';
import { Event, Emitter } from 'vs/base/common/event';
import { KeyCode } from 'vs/base/common/keyCodes';
import { Widget } from 'vs/base/browser/ui/widget';

export interface ICheckboxOptions {
	label: string;
	enabled?: boolean;
	checked?: boolean;
	onChange?: (val: boolean) => void;
	ariaLabel?: string;
}

export interface ICheckboxStyles {
	disabledCheckboxForeground?: Color;
}

export class Checkbox extends Widget {
	private _el: HTMLInputElement;
	private _label: HTMLSpanElement;
	private disabledCheckboxForeground?: Color;

	private _onChange = new Emitter<boolean>();
	public readonly onChange: Event<boolean> = this._onChange.event;

	constructor(container: HTMLElement, opts: ICheckboxOptions) {
		super();

		this._el = document.createElement('input');
		this._el.type = 'checkbox';
		this._el.style.verticalAlign = 'middle';

		if (opts.ariaLabel) {
			this.ariaLabel = opts.ariaLabel;
		}

		this.onchange(this._el, e => {
			this._onChange.fire(this.checked);
		});

		this.onkeydown(this._el, e => {
			if (e.equals(KeyCode.Enter)) {
				this.checked = !this.checked;
				e.stopPropagation();
			}
		});

		this._label = document.createElement('span');
		this._label.style.verticalAlign = 'middle';

		this.label = opts.label;
		this.enabled = opts.enabled || true;
		this.checked = opts.checked || false;

		if (opts.onChange) {
			this.onChange(opts.onChange);
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
		this.updateStyle();
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

	public style(styles: ICheckboxStyles): void {
		this.disabledCheckboxForeground = styles.disabledCheckboxForeground;
		this.updateStyle();
	}

	private updateStyle(): void {
		this._label.style.color = !this.enabled && this.disabledCheckboxForeground ? this.disabledCheckboxForeground.toString() : 'inherit';
	}
}
