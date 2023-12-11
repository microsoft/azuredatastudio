/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Component, Inject, forwardRef, ChangeDetectorRef } from '@angular/core';
import * as chartjs from 'chart.js';
import { mixin } from 'sql/base/common/objects';
import { Disposable } from 'vs/base/common/lifecycle';
import * as azdata from 'azdata';
import { generateUuid } from 'vs/base/common/uuid';

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
export class Chart<TChartType extends azdata.ChartType, TData extends azdata.ChartData<TChartType>, TOptions extends azdata.ChartOptions<TChartType>> extends Disposable {
	private _type: TChartType;
	private _data: chartjs.ChartData;

	private chart: chartjs.Chart;
	private canvas: HTMLCanvasElement;
	private chartCanvasId: string;

	/**
	 * Options in the form that Chart.js accepts
	 */
	private _options: chartjs.ChartOptions = {
		events: ['click', 'keyup'],
		responsive: true,
		maintainAspectRatio: false
	};

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef
	) {
		chartjs.Chart.register(...chartjs.registerables);
		super();

		this.chartCanvasId = 'chart' + generateUuid();
	}

	ngAfterViewInit(): void {

	}

	/**
	 * Setter function for chart type
	 */
	public set type(val: TChartType) {
		this._type = val;

		if (val === 'horizontalBar') {
			// In Chart.js, horizontal bar charts are just bar charts with a different indexAxis set.
			// The indexAxis gets set here, and the Chart.js type gets mapped at conversion time.
			this._options = mixin({}, mixin(this._options, { indexAxis: 'y' }));
		}

		this._changeRef.detectChanges();
	}

	/**
	 * Setter function for chart data
	 */
	public set data(val: TData) {
		this._data = this.convertData(val);

		this.drawChart();
	}

	/**
	 * Setter function for chart options.
	 * Some options like responsiveness and maintainaspectratio are set by default and will be used even if no options are provided.
	 */
	public set options(val: TOptions) {
		if (val === undefined) {
			return;
		}

		// mix in initial options
		this._options = mixin({}, mixin(this._options, val));

		// ...then set title and legend properties
		if (val !== undefined) {
			if (val.chartTitle) { // undefined results in hiding title
				if (typeof val.chartTitle === 'string') {
					this._options = mixin(this._options, {
						plugins: {
							title: {
								text: val.chartTitle,
								display: true
							}
						}
					});
				}
			} else {
				this._options = mixin(this._options, { plugins: { title: { display: false } } });
			}

			if (val.legendVisible !== false) { // undefined defaults to true
				this._options = mixin(this._options, { plugins: { legend: { display: true } } });
			} else {
				this._options = mixin(this._options, { plugins: { legend: { display: false } } });
			}
		}

		this.drawChart();
	}

	public set height(val: string | number) {
		if (val && this.chart) {
			(this.chart.canvas.parentNode as any).style.height = val;
		}
	}

	public set width(val: string | number) {
		if (val && this.chart) {
			(this.chart.canvas.parentNode as any).style.width = val;
		}
	}

	/**
	 * Function to draw the chart.
	 * If the chart is already present, a call to this will simply update the chart with new data values (if any).
	 * Else a new chart will be created.
	 */
	public drawChart() {
		let canvas = document.getElementById(this.chartCanvasId) as HTMLCanvasElement;
		this.canvas = canvas;

		if (this.chart) {
			this.chart.data = this._data;
			this.chart.update();
		} else {
			this.chart = new chartjs.Chart(this.canvas.getContext("2d"), {
				type: this.convertChartType(),
				plugins: [plugin],
				data: this._data,
				options: this._options
			});
		}
	}

	private convertData(val: azdata.ChartData<TChartType>): chartjs.ChartData {
		const result: chartjs.ChartData = {
			datasets: []
		}

		switch (this._type) {
			case 'bar':
			case 'horizontalBar': // should've been replaced with 'bar' by this point, but inlcuded case here for safety
			case 'line':
				{
					if (this.isBarOrLineChartData(val)) {
						for (let set of val.datasets) {
							result.datasets.push({
								data: set.data.map(entry => typeof entry === 'number' ? entry : entry.x),
								backgroundColor: set.backgroundColor,
								borderColor: set.borderColor,
								label: set.dataLabel
							});
						}

						result.labels = val.labels;
					}

					break;
				}
			case 'pie':
			case 'doughnut':
				{
					if (this.isPieOrDoughnutChartData(val)) {
						result.datasets.push({
							data: val.dataset.map(entry => typeof entry.value === 'number' ? entry.value : entry.value.x),
							backgroundColor: val.dataset.map(entry => entry.backgroundColor),
							borderColor: val.dataset.map(entry => entry.borderColor)
						});

						result.labels = val.dataset.map(val => val.dataLabel);
					}

					break;
				}
			case 'scatter':
				{
					if (this.isScatterplotData(val)) {
						for (let set of val.datasets) {
							result.datasets.push({
								data: set.data.map(entry => [entry.x, entry.y]),
								backgroundColor: set.backgroundColor,
								borderColor: set.borderColor,
								label: set.dataLabel
							});
						}
					}

					break;
				}
			case 'bubble':
				{
					if (this.isBubbleChartData(val)) {
						for (let set of val.datasets) {
							result.datasets.push({
								data: set.data.map(entry => ({ x: entry.x, y: entry.y, r: entry.r })),
								backgroundColor: set.backgroundColor,
								borderColor: set.borderColor,
								label: set.dataLabel
							});
						}
					}

					break;
				}
			case 'polarArea':
				{
					if (this.isPolarAreaChartData(val)) {
						result.datasets.push({
							data: val.dataset.map(entry => typeof entry.value === 'number' ? entry.value : entry.value.x),
							backgroundColor: val.dataset.map(entry => entry.backgroundColor),
							borderColor: val.dataset.map(entry => entry.borderColor)
						});

						result.labels = val.dataset.map(val => val.dataLabel);
					}

					break;
				}
			case 'radar':
				{
					if (this.isRadarChartData(val)) {
						for (let set of val.datasets) {
							result.datasets.push({
								data: set.data.map(entry => typeof entry === 'number' ? entry : entry.x),
								backgroundColor: set.backgroundColor,
								borderColor: set.borderColor,
								label: set.dataLabel
							});
						}

						result.labels = val.labels;
					}

					break;
				}
			default:
				throw new Error(`Unsupported chart type: '${this._type}'`);
		}

		return result;
	}

	private convertChartType(): chartjs.ChartType {
		switch (this._type) {
			case 'horizontalBar': // our 'horizontalBar' is just Chart.js's 'bar' with the indexAxis option set
				return 'bar';
			default: // everything else matches up
				return this._type;
		}
	}

	//#region Type predicates

	private isBarOrLineChartData(data: unknown): data is BarOrLineChartData {
		return (data as BarOrLineChartData).datasets !== undefined
			&& (data as BarOrLineChartData).labels !== undefined;
	}

	private isPieOrDoughnutChartData(data: unknown): data is PieOrDoughnutChartData {
		return (data as PieOrDoughnutChartData).dataset !== undefined;
	}

	private isScatterplotData(data: unknown): data is azdata.ScatterplotData {
		return (data as azdata.ScatterplotData).datasets !== undefined;
	}

	private isBubbleChartData(data: unknown): data is azdata.BubbleChartData {
		return (data as azdata.BubbleChartData).datasets !== undefined;
	}

	private isPolarAreaChartData(data: unknown): data is azdata.PolarAreaChartData {
		return (data as azdata.PolarAreaChartData).dataset !== undefined;
	}

	private isRadarChartData(data: unknown): data is azdata.RadarChartData {
		return (data as azdata.RadarChartData).datasets !== undefined
			&& (data as azdata.RadarChartData).labels !== undefined;
	}

	//endregion
}

//#region Data compatibility groups

type BarOrLineChartData = azdata.BarChartData | azdata.HorizontalBarChartData | azdata.LineChartData;
type PieOrDoughnutChartData = azdata.PieChartData | azdata.DoughnutChartData;

//#endregion

//#region Events

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
		bubbles: true
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

//#endregion
