/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as chartjs from 'chart.js';

import { mixin } from 'sql/base/common/objects';
import { localize } from 'vs/nls';
import * as colors from 'vs/platform/theme/common/colorRegistry';
import { editorLineNumbers } from 'vs/editor/common/view/editorColorRegistry';
import { IThemeService, IColorTheme } from 'vs/platform/theme/common/themeService';

import { IInsight, IPointDataSet, customMixin } from './interfaces';
import { IInsightOptions, DataDirection, ChartType, LegendPosition, DataType } from 'sql/workbench/contrib/charts/common/interfaces';
import { values } from 'vs/base/common/collections';
import { find } from 'vs/base/common/arrays';
import { IInsightData } from 'sql/platform/dashboard/browser/insightRegistry';

const noneLineGraphs = [ChartType.Doughnut, ChartType.Pie];

const timeSeriesScales: chartjs.ChartOptions = {
	scales: {
		xAxes: [{
			type: 'time',
			display: true,
			ticks: {
				autoSkip: false,
				maxRotation: 45,
				minRotation: 45
			}
		}],

		yAxes: [{
			display: true,
		}]
	}
};

const defaultOptions: IInsightOptions = {
	type: ChartType.Bar,
	dataDirection: DataDirection.Horizontal
};

export class Graph implements IInsight {
	private _options: IInsightOptions;
	private canvas: HTMLCanvasElement;
	private chartjs: chartjs;
	private _data: IInsightData;

	private originalType: ChartType;

	public static readonly types = [ChartType.Bar, ChartType.Doughnut, ChartType.HorizontalBar, ChartType.Line, ChartType.Pie, ChartType.Scatter, ChartType.TimeSeries];
	public readonly types = Graph.types;

	private _theme: IColorTheme;

	constructor(
		container: HTMLElement, options: IInsightOptions = defaultOptions,
		@IThemeService themeService: IThemeService
	) {
		this._theme = themeService.getColorTheme();
		themeService.onDidColorThemeChange(e => {
			this._theme = e;
			this.data = this._data;
		});
		this.options = mixin(options, defaultOptions, false);

		let canvasContainer = document.createElement('div');
		canvasContainer.style.width = '100%';
		canvasContainer.style.height = '100%';

		this.canvas = document.createElement('canvas');
		canvasContainer.appendChild(this.canvas);

		container.appendChild(canvasContainer);
	}

	public dispose() {

	}

	public layout() {

	}

	public getCanvasData(): string {
		return this.chartjs.toBase64Image();
	}

	public set data(data: IInsightData) {
		if (!data) {
			return;
		}
		this._data = data;
		let labels: Array<string>;
		let chartData: Array<Chart.ChartDataSets>;

		if (this.options.dataDirection === DataDirection.Horizontal) {
			if (this.options.labelFirstColumn) {
				labels = data.columns.slice(1);
			} else {
				labels = data.columns;
			}
		} else {
			labels = data.rows.map(row => row[0]);
		}

		if (this.originalType === ChartType.TimeSeries) {
			let dataSetMap: { [label: string]: IPointDataSet } = {};
			this._data.rows.map(row => {
				if (row && row.length >= 3) {
					let legend = row[0];
					if (!dataSetMap[legend]) {
						dataSetMap[legend] = { label: legend, data: [], fill: false };
					}
					dataSetMap[legend].data.push({ x: row[1], y: Number(row[2]) });
				}
			});
			chartData = values(dataSetMap);
		} else {
			if (this.options.dataDirection === DataDirection.Horizontal) {
				if (this.options.labelFirstColumn) {
					chartData = data.rows.map((row) => {
						return {
							data: row.map(item => Number(item)).slice(1),
							label: row[0]
						};
					});
				} else {
					chartData = data.rows.map((row, i) => {
						return {
							data: row.map(item => Number(item)),
							label: localize('series', "Series {0}", i)
						};
					});
				}
			} else {
				if (this.options.columnsAsLabels) {
					chartData = data.rows[0].slice(1).map((row, i) => {
						return {
							data: data.rows.map(row => Number(row[i + 1])),
							label: data.columns[i + 1]
						};
					});
				} else {
					chartData = data.rows[0].slice(1).map((row, i) => {
						return {
							data: data.rows.map(row => Number(row[i + 1])),
							label: localize('series', "Series {0}", i + 1)
						};
					});
				}
			}
		}

		chartData = chartData.map((c, i) => {
			return mixin(c, getColors(this.options.type, i, c.data.length), false);
		});

		if (this.chartjs) {
			this.chartjs.data.datasets = chartData;
			this.chartjs.config.type = this.options.type;
			// we don't want to include lables for timeSeries
			this.chartjs.data.labels = this.originalType === 'timeSeries' ? [] : labels;
			this.chartjs.options = this.transformOptions(this.options);
			this.chartjs.update({ duration: 0 });
		} else {
			this.chartjs = new chartjs.Chart(this.canvas.getContext('2d'), {
				data: {
					// we don't want to include lables for timeSeries
					labels: this.originalType === 'timeSeries' ? [] : labels,
					datasets: chartData
				},
				type: this.options.type,
				options: this.transformOptions(this.options)
			});
		}
	}

	private transformOptions(options: IInsightOptions): Chart.ChartOptions {
		let retval: Chart.ChartOptions = {};
		retval.maintainAspectRatio = false;

		let foregroundColor = this._theme.getColor(colors.editorForeground);
		let foreground = foregroundColor ? foregroundColor.toString() : null;
		let gridLinesColor = this._theme.getColor(editorLineNumbers);
		let gridLines = gridLinesColor ? gridLinesColor.toString() : null;
		let backgroundColor = this._theme.getColor(colors.editorBackground);
		let background = backgroundColor ? backgroundColor.toString() : null;

		if (options) {
			retval.scales = {};
			// we only want to include axis if it is a axis based graph type
			if (!find(noneLineGraphs, x => x === options.type as ChartType)) {
				retval.scales.xAxes = [{
					scaleLabel: {
						fontColor: foreground,
						labelString: options.xAxisLabel,
						display: options.xAxisLabel ? true : false
					},
					ticks: {
						fontColor: foreground
					},
					gridLines: {
						color: gridLines
					}
				}];

				if (options.xAxisMax) {
					retval.scales = mixin(retval.scales, { xAxes: [{ ticks: { max: options.xAxisMax } }] }, true, customMixin);
				}

				if (options.xAxisMin) {
					retval.scales = mixin(retval.scales, { xAxes: [{ ticks: { min: options.xAxisMin } }] }, true, customMixin);
				}

				retval.scales.yAxes = [{
					scaleLabel: {
						fontColor: foreground,
						labelString: options.yAxisLabel,
						display: options.yAxisLabel ? true : false
					},
					ticks: {
						fontColor: foreground
					},
					gridLines: {
						color: gridLines
					}
				}];

				if (options.yAxisMax) {
					retval.scales = mixin(retval.scales, { yAxes: [{ ticks: { max: options.yAxisMax } }] }, true, customMixin);
				}

				if (options.yAxisMin) {
					retval.scales = mixin(retval.scales, { yAxes: [{ ticks: { min: options.yAxisMin } }] }, true, customMixin);
				}

				if (this.originalType === ChartType.TimeSeries) {
					retval = mixin(retval, timeSeriesScales, true, customMixin);
					if (options.xAxisMax) {
						retval = mixin(retval, {
							scales: {
								xAxes: [{
									time: {
										max: options.xAxisMax
									}
								}],
							}
						}, true, customMixin);
					}

					if (options.xAxisMin) {
						retval = mixin(retval, {
							scales: {
								xAxes: [{
									time: {
										min: options.xAxisMin
									}
								}],
							}
						}, true, customMixin);
					}
				}
			}

			retval.legend = <Chart.ChartLegendOptions>{
				position: options.legendPosition as Chart.PositionType,
				display: options.legendPosition !== LegendPosition.None,
				labels: {
					fontColor: foreground
				}
			};
		}

		// these are custom options that will throw compile errors
		(<any>retval).viewArea = {
			backgroundColor: background
		};

		return retval;
	}

	public set options(options: IInsightOptions) {
		this._options = options;
		this.originalType = options.type as ChartType;
		if (this.options.type === ChartType.TimeSeries) {
			this.options.type = ChartType.Line;
			this.options.dataType = DataType.Point;
			this.options.dataDirection = DataDirection.Horizontal;
		}
		this.data = this._data;
	}

	public get options(): IInsightOptions {
		return this._options;
	}
}

/**
 * The Following code is pulled from ng2-charting in order to keep the same
 * color functionality
 */

const defaultColors: Array<Color> = [
	[255, 99, 132],
	[54, 162, 235],
	[255, 206, 86],
	[231, 233, 237],
	[75, 192, 192],
	[151, 187, 205],
	[220, 220, 220],
	[247, 70, 74],
	[70, 191, 189],
	[253, 180, 92],
	[148, 159, 177],
	[77, 83, 96]
];

type Color = [number, number, number];

interface ILineColor {
	backgroundColor: string;
	borderColor: string;
	pointBackgroundColor: string;
	pointBorderColor: string;
	pointHoverBackgroundColor: string;
	pointHoverBorderColor: string;
}

interface IBarColor {
	backgroundColor: string;
	borderColor: string;
	hoverBackgroundColor: string;
	hoverBorderColor: string;
}

interface IPieColors {
	backgroundColor: Array<string>;
	borderColor: Array<string>;
	pointBackgroundColor: Array<string>;
	pointBorderColor: Array<string>;
	pointHoverBackgroundColor: Array<string>;
	pointHoverBorderColor: Array<string>;
}

interface IPolarAreaColors {
	backgroundColor: Array<string>;
	borderColor: Array<string>;
	hoverBackgroundColor: Array<string>;
	hoverBorderColor: Array<string>;
}

function rgba(colour: Color, alpha: number): string {
	return 'rgba(' + colour.concat(alpha).join(',') + ')';
}

function getRandomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomColor(): Color {
	return [getRandomInt(0, 255), getRandomInt(0, 255), getRandomInt(0, 255)];
}

/**
 * Generate colors for line|bar charts
 */
function generateColor(index: number): Color {
	return defaultColors[index] || getRandomColor();
}

/**
 * Generate colors for pie|doughnut charts
 */
function generateColors(count: number): Array<Color> {
	const colorsArr = new Array(count);
	for (let i = 0; i < count; i++) {
		colorsArr[i] = defaultColors[i] || getRandomColor();
	}
	return colorsArr;
}

function formatLineColor(colors: Color): ILineColor {
	return {
		backgroundColor: rgba(colors, 0.4),
		borderColor: rgba(colors, 1),
		pointBackgroundColor: rgba(colors, 1),
		pointBorderColor: '#fff',
		pointHoverBackgroundColor: '#fff',
		pointHoverBorderColor: rgba(colors, 0.8)
	};
}

function formatBarColor(colors: Color): IBarColor {
	return {
		backgroundColor: rgba(colors, 0.6),
		borderColor: rgba(colors, 1),
		hoverBackgroundColor: rgba(colors, 0.8),
		hoverBorderColor: rgba(colors, 1)
	};
}

function formatPieColors(colors: Array<Color>): IPieColors {
	return {
		backgroundColor: colors.map(color => rgba(color, 0.6)),
		borderColor: colors.map(() => '#fff'),
		pointBackgroundColor: colors.map(color => rgba(color, 1)),
		pointBorderColor: colors.map(() => '#fff'),
		pointHoverBackgroundColor: colors.map(color => rgba(color, 1)),
		pointHoverBorderColor: colors.map(color => rgba(color, 1))
	};
}

function formatPolarAreaColors(colors: Array<Color>): IPolarAreaColors {
	return {
		backgroundColor: colors.map(color => rgba(color, 0.6)),
		borderColor: colors.map(color => rgba(color, 1)),
		hoverBackgroundColor: colors.map(color => rgba(color, 0.8)),
		hoverBorderColor: colors.map(color => rgba(color, 1))
	};
}

/**
 * Generate colors by chart type
 */
function getColors(chartType: string, index: number, count: number): Color | ILineColor | IBarColor | IPieColors | IPolarAreaColors {
	if (chartType === 'pie' || chartType === 'doughnut') {
		return formatPieColors(generateColors(count));
	}
	if (chartType === 'polarArea') {
		return formatPolarAreaColors(generateColors(count));
	}
	if (chartType === 'line' || chartType === 'radar') {
		return formatLineColor(generateColor(index));
	}
	if (chartType === 'bar' || chartType === 'horizontalBar') {
		return formatBarColor(generateColor(index));
	}
	return generateColor(index);
}
