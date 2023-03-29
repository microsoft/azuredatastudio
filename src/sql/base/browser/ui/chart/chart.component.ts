/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Component, Inject, forwardRef, ChangeDetectorRef } from '@angular/core';
import { ChartType, ChartOptions } from 'chart.js';
import { } from 'ng2-charts';
import { Disposable } from 'vs/base/common/lifecycle';

@Component({
	selector: 'chart-component',
	templateUrl: decodeURI(require.toUrl('./chart.component.html'))
})
export class Chart extends Disposable {

	private _labels: string[] = [];
	private _data: number[] = [];
	private _colors: string[] = [];
	public doughnutChartColors: any[] = [];

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef
	) {
		super();
	}

	public set labels(val: string[]) {
		this._labels = val;
		this._changeRef.detectChanges();
	}

	public get labels(): string[] {
		return this._labels;
	}

	public set data(val: number[]) {
		this._data = val;
		this._changeRef.detectChanges();
	}

	public get data(): number[] {
		return this._data;
	}

	public get colors(): string[] {
		return this._colors;
	}

	public set colors(val: string[]) {
		this._colors = val;
		this.doughnutChartColors = [
			{
				backgroundColor: this._colors
			}
		];
		this._changeRef.detectChanges();
	}

	doughnutChartType: ChartType = 'doughnut';

	public doughnutChartOptions: ChartOptions = {
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
