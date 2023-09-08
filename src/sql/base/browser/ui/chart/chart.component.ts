/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Component, Inject, forwardRef, ChangeDetectorRef } from '@angular/core';
import * as chartjs from 'chart.js';
import { mixin } from 'sql/base/common/objects';
import { Disposable } from 'vs/base/common/lifecycle';
//import { BubbleChartPoint, ChartOptions, ScatterChartPoint } from 'azdata';
import * as azdata from 'azdata';

// nned to rename to match a common chart dataset
export interface BarDataSet {
	label: string;
	data: number[];
	backgroundColor?: string[];
	borderColor?: string[];
}

@Component({
	selector: 'chart-component',
	templateUrl: decodeURI(require.toUrl('./chart.component.html'))
})
export class Chart<TConfig extends azdata.ChartConfiguration> extends Disposable {
	private _type: azdata.ChartType;
	//private _labels: string[];
	public chart: chartjs.Chart;
	private chartTitle: string;

	private _configuration: chartjs.ChartData;
	private canvas: HTMLCanvasElement;
	public element: string;

	private _options: any = {
		events: ['click', 'keyup'],
		responsive: true,
		maintainAspectRatio: false
	};

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef
	) {
		chartjs.Chart.register(...chartjs.registerables);
		super();

		//this.canvas = document.createElement('canvas');
	}

	ngAfterViewInit(): void {

	}

	public set type(val: any) {
		if (val === 'horizontalBar') {
			this._type = 'bar';
			this._options = mixin({}, mixin(this._options, { indexAxis: 'y' }));
		}
		else {
			this._type = val;
		}
		this._changeRef.detectChanges();
	}

	public set configuration(val: TConfig) {
		this.chartTitle = val.chartTitle;
		this._configuration = this.convert(val);

		if ((<any>val).options) { // TODO: give TConfig a strongly-typed TOptions param
			this.options = (<any>val).options;
		} else {
			// setting this.options above calls drawChart(), so putting this behind an "else" prevents a redraw with the same data
			this.drawChart();
		}
	}

	public set options(val: any) {
		if (val) {
			this._options = mixin({}, mixin(this._options, val));
		}
		this.drawChart();
	}

	private convert(val: azdata.ChartConfiguration): chartjs.ChartData {
		const result: chartjs.ChartData = {
			datasets: []
		}

		this.element = this.chartTitle;
		this._changeRef.detectChanges();

		switch (this._type) {
			case 'bar':
			case 'horizontalBar': // should've been replaced with 'bar' by this point, but inlcuded case here for safety
			case 'line':
				{
					const config = <azdata.BarChartConfiguration>val;
					for (let set of config.datasets) {
						result.datasets.push({
							data: set.data.map(entry => typeof entry === 'number' ? entry : entry.x),
							backgroundColor: set.backgroundColor,
							borderColor: set.borderColor,
							label: set.dataLabel
						});
					}

					result.labels = config.labels;
					break;
				}
			case 'pie':
			case 'doughnut':
				{
					const config = <azdata.PieChartConfiguration>val;

					result.datasets.push({
						data: config.dataset.map(entry => typeof entry.value === 'number' ? entry.value : entry.value.x),
						backgroundColor: config.dataset.map(entry => entry.backgroundColor),
						borderColor: config.dataset.map(entry => entry.borderColor)
					});

					result.labels = config.dataset.map(val => val.dataLabel);
					break;
				}
			case 'scatter':
				{
					const config = <azdata.ScatterplotConfiguration>val;

					for (let set of config.datasets) {
						result.datasets.push({
							data: set.data.map(entry => [entry.x, entry.y]),
							backgroundColor: set.backgroundColor,
							borderColor: set.borderColor,
							label: set.dataLabel
						});
					}

					break;
				}
			case 'bubble':
				{
					const config = <azdata.BubbleChartConfiguration>val;

					for (let set of config.datasets) {
						result.datasets.push({
							data: set.data.map(entry => ({ x: entry.x, y: entry.y, r: entry.r })),
							backgroundColor: set.backgroundColor,
							borderColor: set.borderColor,
							label: set.dataLabel
						});
					}

					break;
				}
			case 'polarArea':
				{
					const config = <azdata.PolarAreaChartConfiguration>val;

					result.datasets.push({
						data: config.dataset.map(entry => typeof entry.value === 'number' ? entry.value : entry.value.x),
						backgroundColor: config.dataset.map(entry => entry.backgroundColor),
						borderColor: config.dataset.map(entry => entry.borderColor)
					});

					result.labels = config.dataset.map(val => val.dataLabel);
					break;
				}
			case 'radar':
				{
					const config = <azdata.RadarChartConfiguration>val;

					for (let set of config.datasets) {
						result.datasets.push({
							data: set.data.map(entry => typeof entry === 'number' ? entry : entry.x),
							backgroundColor: set.backgroundColor,
							borderColor: set.borderColor,
							label: set.dataLabel
						});
					}

					result.labels = config.labels;
					break;
				}
			default:
				throw new Error(`Unsupported chart type: '${this._type}'`);
		}

		return result;
	}

	public drawChart() {
		let canvas = document.getElementById(this.element) as HTMLCanvasElement;
		this.canvas = canvas;

		if (this.chart) {
			this.chart.data = this._configuration;
			this.chart.update();
		} else {
			this.chart = new chartjs.Chart(this.canvas.getContext("2d"), {
				type: <any>this._type.toString(),
				plugins: [plugin],
				data: this._configuration,
				options: this._options
			});
		}
	}
}

const setActiveElements = function (chart, index) {
	chart.setActiveElements([
		{
			datasetIndex: 0,
			index,
		}
	]);
	chart.update();
};

const currentActiveElement = function (elements) {
	if (elements.length) {
		return elements[0].index;
	}
	return -1;
};

const dispatchClick = function (chart, point) {
	const node = chart.canvas;
	const rect = node.getBoundingClientRect();
	const event = new MouseEvent('click', {
		clientX: rect.left + point.x,
		clientY: rect.top + point.y,
		cancelable: true,
		bubbles: true,
		//view: window
	});
	node.dispatchEvent(event);
}

const plugin = {
	id: 'keyup',
	defaults: {
		events: ['keyup']
	},
	beforeEvent(chart, args, options) {
		const event = args.event;
		const code = event.native.code;
		const activeElements = chart.getActiveElements();
		const tooltip = chart.tooltip;
		if (code === 'ArrowRight') {
			const pos = currentActiveElement(activeElements) + 1;
			const index = pos === chart.data.datasets[0].data.length ? 0 : pos;
			setActiveElements(chart, index);
			setActiveElements(tooltip, index);
		} else if (code === 'ArrowLeft') {
			const pos = currentActiveElement(activeElements) - 1;
			const index = pos < 0 ? chart.data.datasets[0].data.length - 1 : pos;
			setActiveElements(chart, index);
			setActiveElements(tooltip, index);
		} else if (code === 'Enter' && activeElements.length) {
			const el = activeElements[0];
			const meta = chart.getDatasetMeta(el.datasetIndex);
			const data = meta.data[el.index];
			dispatchClick(chart, data);
		}
		return false;
	}
};
