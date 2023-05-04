/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Component, Inject, forwardRef, ChangeDetectorRef } from '@angular/core';
import { ChartOptions } from 'chart.js';
import { } from 'ng2-charts';
import { Disposable } from 'vs/base/common/lifecycle';
import { ChartType } from 'azdata';

@Component({
	selector: 'chart-component',
	templateUrl: decodeURI(require.toUrl('./chart.component.html'))
})
export class Chart<T extends ChartType> extends Disposable {

	public chartDataset: any[] = [
		{
			data: [],
			label: ''
		}
	];
	public chartLabels: string[] = [];
	public chartColors: any[] = [];
	//Need to provide some default chart type to avoid rendering error
	public chartType: ChartType = 'line';
	public _data: number[] = [];
	public _colors: string | string[] = [];
	public _label: string = '';

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef
	) {
		super();
	}

	public set type(val: ChartType) {
		this.chartType = val;
		this._changeRef.detectChanges();
	}

	public set data(val: any) {
		if (this.chartType === 'doughnut' || this.chartType === 'pie' || this.chartType === 'polarArea') {
			this._data = val.dataset;
			this.chartLabels = val.labels;

			if (val.colors) {
				this._colors = val.colors;
				this.chartColors = [
					{
						backgroundColor: this._colors
					}
				];
			}
		}

		else if (this.chartType === 'bar' || this.chartType === 'horizontalBar') {
			this._data = val.dataset;
			this._label = val.datasetLabel;

			this.chartLabels = val.labels;

			if (val.colors) {
				this._colors = val.colors;
				this.chartColors = [
					{
						backgroundColor: this._colors
					}
				];
				this._changeRef.detectChanges();
			}
		}

		else if (this.chartType === 'line' || this.chartType === 'radar') {
			this._data = val.dataset;
			this._label = val.datasetLabel;

			if (val.backgroundColor) {
				this._colors = val.backgroundColor;
				this.chartColors = [
					{
						backgroundColor: this._colors
					}
				];
			}
		}
		this._changeRef.detectChanges();
		this.chartDataset = [{
			data: this._data,
			label: this._label
		}];
	}

	public chartOptions: ChartOptions = {
		responsive: true,
		maintainAspectRatio: false
	};

	public chartClicked(e: any): void {
		//
	}

	public chartHovered(e: any): void {
		//
	}
}
