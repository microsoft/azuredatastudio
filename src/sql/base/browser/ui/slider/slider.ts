/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from 'vs/base/common/event';
import { Widget } from 'vs/base/browser/ui/widget';

export interface ISliderOptions {
	label: string;
	min: number,
	max: number,
	value?: number,
	step?: number,
	enabled?: boolean;
	showTicks?: boolean;
	onChange?: (val: number) => void;
	ariaLabel?: string;
}

export interface ISliderStyles {

}

let TICKS_ID = 1;

export class Slider extends Widget {
	private _el: HTMLInputElement;
	private _datalist: HTMLDataListElement | undefined = undefined;
	private _label: HTMLSpanElement;
	private _showTicks: boolean = false;

	private _onChange = new Emitter<number>();
	/**
	 * Event that is fired every time the user stops dragging the slider.
	 * Value is the current value of the slider.
	 */
	public readonly onChange: Event<number> = this._onChange.event;

	private _onInput = new Emitter<number>();
	/**
	 * Event that is fires every time the value changes while the user is
	 * dragging the slider. Value is the current value of the slider.
	 */
	public readonly onInput: Event<number> = this._onInput.event;

	constructor(private _container: HTMLElement, opts: ISliderOptions) {
		super();

		this._el = document.createElement('input');
		this._el.type = 'range';
		this._el.step = opts.step?.toString() || '';
		this._el.min = opts.min.toString() || '';
		this._el.max = opts.max.toString() || '';
		this._el.value = opts.value?.toString() || '';
		this._showTicks = opts.showTicks;

		this.updateTicksDisplay();

		const flexContainer = document.createElement('div');
		flexContainer.style.flex = '1 1 auto';
		flexContainer.style.flexFlow = 'row';

		const valueBox = document.createElement('input');
		valueBox.type = 'text';
		valueBox.disabled = true;
		valueBox.value = this.value.toString();
		// TODO: Styles in CSS
		valueBox.style.width = '40px';
		valueBox.style.textAlign = 'center';

		if (opts.ariaLabel) {
			this.ariaLabel = opts.ariaLabel;
		}

		this.onchange(this._el, () => {
			this._onChange.fire(this.value);
		});

		this.oninput(this._el, () => {
			valueBox.value = this.value.toString();
			this._onInput.fire(this.value);
		});

		this._label = document.createElement('span');
		this._label.style.verticalAlign = 'middle';

		this.label = opts.label;
		this.enabled = opts.enabled || true;

		if (opts.onChange) {
			this.onChange(opts.onChange);
		}

		flexContainer.append(this._el, valueBox);
		this._container.appendChild(flexContainer);
		// this._container.appendChild(this._label);
	}

	private updateTicksDisplay(): void {
		// In order to show the tick marks we require the step since that will determine how many marks to show
		if (this.showTicks && this.step) {
			// Create the datalist if we haven't already
			if (!this._datalist) {
				this._datalist = document.createElement('datalist');
				this._datalist.id = `ticks-${TICKS_ID++}`;
				this._container.appendChild(this._datalist);
			}

			this._el.setAttribute('list', this._datalist.id);
			const numTicks = (this.max - this.min) / this.step;
			for (let i = 0; i <= numTicks; ++i) {
				const tickElement = document.createElement('option');
				tickElement.value = (this.min + (i * this.step)).toString();
				this._datalist.appendChild(tickElement);
			}
		} else {
			this._el.removeAttribute('list');
		}
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

	public set min(val: number) {
		this._el.min = val.toString();
	}

	public get min(): number {
		return Number(this._el.min);
	}

	public set max(val: number) {
		this._el.max = val.toString();
	}

	public get max(): number {
		return Number(this._el.max);
	}

	public set value(val: number) {
		this._el.value = val.toString();
	}

	public get value(): number {
		return Number(this._el.value);
	}

	public set step(val: number | undefined) {
		this._el.step = val.toString();
	}

	public get step(): number | undefined {
		return Number(this._el.step);
	}

	public set showTicks(val: boolean) {
		this._showTicks = val;
		this.updateTicksDisplay();
	}

	public get showTicks(): boolean {
		return this._showTicks;
	}

	public set ariaLabel(val: string | undefined) {
		this._el.setAttribute('aria-label', val || '');
	}

	public get ariaLabel(): string | undefined {
		return this._el.getAttribute('aria-label');
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

	public style(styles: ISliderStyles): void {
		this.updateStyle();
	}

	private updateStyle(): void {

	}
}
