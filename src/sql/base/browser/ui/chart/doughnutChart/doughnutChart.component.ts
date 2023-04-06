/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Component, Inject, forwardRef, ChangeDetectorRef } from '@angular/core';
import { ChartType, ChartOptions } from 'chart.js';
import { } from 'ng2-charts';
import { Disposable } from 'vs/base/common/lifecycle';

@Component({
	selector: 'doughnutChart-component',
	templateUrl: decodeURI(require.toUrl('./doughnutChart.component.html'))
})
export class DoughnutChart extends Disposable {

	private dougnutChartLabels: string[] = [];
	private doughnutChartData: number[] = [];
	private _colors: string[] = [];
	public doughnutChartColors: any[] = [];
	public readonly doughnutChartType: ChartType = 'doughnut';

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef
	) {
		super();
	}

	public set labels(val: string[]) {
		this.dougnutChartLabels = val;
		this._changeRef.detectChanges();
	}

	public get labels(): string[] {
		return this.dougnutChartLabels;
	}

	public set data(val: number[]) {
		this.doughnutChartData = val;
		this._changeRef.detectChanges();
	}

	public get data(): number[] {
		return this.doughnutChartData;
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

	public get colors(): string[] {
		return this._colors;
	}

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
