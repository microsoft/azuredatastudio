/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Component, Input, Inject, ChangeDetectorRef, forwardRef, OnDestroy, ElementRef, AfterViewInit, ViewChild } from '@angular/core';

import * as azdata from 'azdata';
import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { Chart } from 'sql/base/browser/ui/chart/chart.component';
import { ILogService } from 'vs/platform/log/common/log';

@Component({
	selector: 'modelview-chart',
	templateUrl: decodeURI(require.toUrl('./chart.component.html'))
})

export default class ChartComponent<TChartType extends azdata.ChartType, TData extends azdata.ChartData<TChartType>, TOptions extends azdata.ChartOptions<TChartType>> extends ComponentBase<azdata.ChartComponentProperties<TChartType, TData, TOptions>> implements IComponent, OnDestroy, AfterViewInit {

	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	@ViewChild(Chart) private _chart: Chart<TChartType, TData, TOptions>;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		this.baseInit();
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
	}

	public override setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);

		// chartType must be set before data because it's necessary for the draw function that triggers when setting data

		if (this.chartType) {
			this._chart.type = this.chartType;
		}

		if (this.data) {
			this._chart.data = this.data;
		}

		if (this.options) {
			this._chart.options = this.options;
		}

		if (this.height) {
			this._chart.height = this.height;
		}

		if (this.width) {
			this._chart.width = this.width;
		}
	}

	public get chartType(): TChartType {
		return this.getProperties().chartType;
	}

	public get data(): TData {
		return this.getProperties().data;
	}

	public get options(): TOptions | undefined {
		return this.getProperties().options;
	}

	public setLayout(layout: any): void {
		this.layout();
	}
}
