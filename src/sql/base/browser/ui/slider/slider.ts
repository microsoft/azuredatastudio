/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from 'vs/base/common/event';
import { Widget } from 'vs/base/browser/ui/widget';

export interface ISliderOptions {
	/**
	 * The value selected on the slider. Default initial value is the minimum value.
	 */
	value?: number,
	/**
	 * The minimum value of the slider. Default value is 1.
	 */
	min?: number,
	/**
	 * The maximum value of the slider. Default value is 100.
	 */
	max?: number,
	/**
	 * The value between each "tick" of the slider. Default is 1.
	 */
	step?: number,
	/**
	 * Whether to show the tick marks on the slider. Default is false.
	 */
	showTicks?: boolean
	/**
	 * The width of the slider, not including the value box.
	 */
	width?: number | string;
	/**
	 * Whether the control is enabled or not.
	 */
	enabled?: boolean;
	/**
	 * Callback called whenever the user stops dragging the slider.
	 */
	onChange?: (val: number) => void;
	/**
	 * Callback called whenever the value of the slider changes while being dragged.
	 */
	onInput?: (val: number) => void;
	/**
	 * The aria label to apply to the element for screen readers.
	 */
	ariaLabel?: string;
}

/**
 * Counter to user for creating unique datalist IDs for the displayed ticks
 */
let TICKS_DATALIST_ID = 1;

export const DEFAULT_MIN = '1';
export const DEFAULT_MAX = '100';
export const DEFAULT_STEP = '1';

export class Slider extends Widget {
	private _el: HTMLInputElement;
	private _datalist: HTMLDataListElement | undefined = undefined;
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
		this.width = opts.width?.toString() || '';
		this.step = opts.step;
		this.min = opts.min;
		this.max = opts.max;
		this.value = opts.value;
		this._showTicks = opts.showTicks;

		this.updateTicksDisplay();

		const flexContainer = document.createElement('div');
		flexContainer.style.display = 'flex';
		flexContainer.style.flexFlow = 'row';

		const valueBox = document.createElement('input');
		valueBox.type = 'text';
		valueBox.disabled = true;
		valueBox.value = this.value.toString();
		valueBox.style.textAlign = 'center';
		valueBox.style.width = '40px';

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

		this.enabled = opts.enabled || true;

		if (opts.onChange) {
			this._register(this.onChange(opts.onChange));
		}

		if (opts.onInput) {
			this._register(this.onInput(opts.onInput));
		}

		flexContainer.append(this._el, valueBox);
		this._container.appendChild(flexContainer);
	}

	private updateTicksDisplay(): void {
		// In order to show the tick marks we require the step since that will determine how many marks to show
		if (this.showTicks && this.step) {
			// Create the datalist if we haven't already
			if (!this._datalist) {
				this._datalist = document.createElement('datalist');
				this._datalist.id = `slider-ticks-${TICKS_DATALIST_ID++}`;
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

	public set enabled(val: boolean) {
		this._el.disabled = !val;
	}

	public get enabled(): boolean {
		return !this._el.disabled;
	}

	public set min(val: number | undefined) {
		this._el.min = val?.toString() || DEFAULT_MIN;
	}

	public get min(): number {
		return Number(this._el.min);
	}

	public set max(val: number | undefined) {
		this._el.max = val?.toString() || DEFAULT_MAX;
	}

	public get max(): number {
		return Number(this._el.max);
	}

	public set value(val: number | undefined) {
		this._el.value = val?.toString() || this.min.toString();
	}

	public get value(): number {
		return Number(this._el.value);
	}

	public set step(val: number | undefined) {
		this._el.step = val?.toString() || DEFAULT_STEP;
	}

	public get step(): number {
		return Number(this._el.step);
	}

	public set width(val: string) {
		this._el.style.width = val;
	}

	public get width(): string {
		return this._el.style.width;
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
}
