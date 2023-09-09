/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Component, Inject, forwardRef, ChangeDetectorRef } from '@angular/core';
import * as chartjs from 'chart.js';
import { mixin } from 'sql/base/common/objects';
import { Disposable } from 'vs/base/common/lifecycle';
import * as azdata from 'azdata';

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
	private _chartId: string;
	private _type: azdata.ChartType;
	private _configuration: chartjs.ChartData;

	public chart: chartjs.Chart;
	private canvas: HTMLCanvasElement;
	public element: string;

	/**
	 * Options in the form that Chart.js accepts (hence the `any` type)
	 */
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
	}

	ngAfterViewInit(): void {

	}

	/**
	 * Setter function for chart type
	 */
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

	/**
	 * Setter function for chart configuration
	 */
	public set configuration(val: TConfig) {
		this._configuration = this.convert(val);

		if ((<any>val).options) { // TODO: give TConfig a strongly-typed TOptions param
			this.options = (<any>val).options;
		} else {
			// setting this.options above calls drawChart(), so putting this behind an "else" prevents a redraw with the same data
			this.drawChart();
		}
	}

	public set chartId(val: string) {
		this._chartId = val;

		this.element = this._chartId;
		this._changeRef.detectChanges();
	}

	/**
	 * Setter function for chart options.
	 * Some options like responsiveness and maintainaspectratio are set by default and will be used even if no options are provided.
	 */
	public set options(val: azdata.ChartOptions) {
		if (val === undefined) {
			return;
		}

		// Free-form chart.js options get added first...
		this._options = mixin({}, mixin(this._options, val.freeformOptions));

		// ...then strongly-typed ComponentModel options get set (overriding free-form options)
		if (val !== undefined) {
			if (val.chartTitle) {
				if (typeof val.chartTitle === 'string') {
					this._options = mixin(this._options, {
						plugins: {
							title: {
								text: val.chartTitle,
								display: true
							}
						}
					});
				} else {
					this._options = mixin(this._options, {
						plugins: {
							title: {
								text: val.chartTitle.text,
								color: val.chartTitle.color,
								display: true
							}
						}
					});
				}
			} else {
				this._options = mixin(this._options, { plugins: { title: { display: false } } });
			}

			if (val.legendOptions) {
				this._options = mixin(this._options, {
					plugins: {
						legend: {
							title: {
								color: val.legendOptions.color ?? undefined,
								display: true
							}
						}
					}
				});
			} else {
				this._options = mixin(this._options, { plugins: { legend: { title: { display: false } } } });
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

	private convert(val: azdata.ChartConfiguration): chartjs.ChartData {
		const result: chartjs.ChartData = {
			datasets: []
		}

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

	/**
	 * Function to draw the chart.
	 * If the chart is already present, a call to this will simply update the chart with new configuration values(if any).
	 * Else a new chart will be created.
	 */
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
