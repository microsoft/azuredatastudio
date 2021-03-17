/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { onUnexpectedError } from 'vs/base/common/errors';
import { ILogService } from 'vs/platform/log/common/log';
import { Slider } from 'sql/base/browser/ui/slider/slider';
import { convertSize } from 'sql/base/browser/dom';

@Component({
	selector: 'modelview-slider',
	template: `
			<div #slider [ngStyle]="CSSStyles"></div>
	`
})
export default class SliderComponent extends ComponentBase<azdata.SliderComponentProperties> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _slider: Slider;

	@ViewChild('slider', { read: ElementRef }) private _sliderContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService
	) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		this._slider = this._register(new Slider(this._sliderContainer.nativeElement, {
			width: convertSize(this.width),
			min: this.min,
			max: this.max,
			value: this.value,
			step: this.step,
			showTicks: this.showTicks
		}));
		this._register(this._slider.onChange(async e => {
			this.value = this._slider.value;
			await this.validate();
			this.fireEvent({
				eventType: ComponentEventType.onDidChange,
				args: e
			});
		}));
		this._register(this._slider.onInput(e => {
			this.fireEvent({
				eventType: ComponentEventType.onInput,
				args: e
			});
		}));
		this.baseInit();
	}

	private get sliderElement(): Slider {
		return this._slider;
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public setLayout(layout: any): void {
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this.setSliderProperties(this.sliderElement);
		this.validate().catch(onUnexpectedError);
	}

	private setSliderProperties(slider: Slider): void {
		slider.min = this.min;
		slider.max = this.max;
		slider.step = this.step;
		slider.value = this.value;
		slider.showTicks = this.showTicks;
		slider.ariaLabel = this.ariaLabel;
		slider.enabled = this.enabled;
		slider.width = convertSize(this.width);
	}

	// CSS-bound properties

	public get value(): number | undefined {
		return this.getPropertyOrDefault<number>((props) => props.value, undefined);
	}

	public set value(newValue: number | undefined) {
		this.setPropertyFromUI<number>((props, value) => props.value = value, newValue);
	}

	public get min(): number | undefined {
		return this.getPropertyOrDefault<number>((props) => props.min, undefined);
	}

	public set min(newValue: number | undefined) {
		this.setPropertyFromUI<number>((props, value) => props.min = value, newValue);
	}

	public get max(): number | undefined {
		return this.getPropertyOrDefault<number>((props) => props.max, undefined);
	}

	public set max(newValue: number | undefined) {
		this.setPropertyFromUI<number>((props, value) => props.max = value, newValue);
	}

	public get step(): number | undefined {
		return this.getPropertyOrDefault<number | undefined>((props) => props.step, undefined);
	}

	public set step(newValue: number | undefined) {
		this.setPropertyFromUI<number | undefined>((props, value) => props.step = value, newValue);
	}

	public get showTicks(): boolean | undefined {
		return this.getPropertyOrDefault<boolean | undefined>((props) => props.showTicks, undefined);
	}

	public set showTicks(newValue: boolean | undefined) {
		this.setPropertyFromUI<boolean | undefined>((props, value) => props.showTicks = value, newValue);
	}

	public focus(): void {
		this.sliderElement.focus();
	}

	public get inputBoxCSSStyles(): azdata.CssStyles {
		return this.mergeCss(super.CSSStyles, {
			'width': this.getWidth()
		});
	}
}
