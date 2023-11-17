/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { Component, Input, Inject, ChangeDetectorRef, forwardRef, ViewChild, ElementRef } from '@angular/core';
import * as chartjs from 'chart.js';

import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { mixin } from 'sql/base/common/objects';
import { defaultChartConfig, IChartConfig } from 'sql/workbench/contrib/dashboard/browser/widgets/insights/views/charts/interfaces';

import * as colors from 'vs/platform/theme/common/colorRegistry';
import * as types from 'vs/base/common/types';
import { Disposable } from 'vs/base/common/lifecycle';
import * as nls from 'vs/nls';
import { IThemeService, IColorTheme } from 'vs/platform/theme/common/themeService';
import { IInsightsView, IInsightData } from 'sql/platform/dashboard/browser/insightRegistry';
import { ChartType, ChartTypeToChartJsType, LegendPosition } from 'sql/workbench/contrib/charts/browser/interfaces';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';

@Component({
	templateUrl: decodeURI(require.toUrl('./chartInsight.component.html'))
})
export abstract class ChartInsight extends Disposable implements IInsightsView {
	private _isDataAvailable: boolean = false;
	protected _hasInit: boolean = false;
	protected _hasError: boolean = false;
	private _options: chartjs.ChartOptions = {};
	private _chart: chartjs.Chart;
	private _chartCanvas: HTMLCanvasElement;

	@ViewChild('chartContainer') private _chartContainer: ElementRef;

	protected _defaultConfig = defaultChartConfig;
	protected _config: IChartConfig;
	protected _data: IInsightData;

	protected readonly CHART_ERROR_MESSAGE = nls.localize('chartErrorMessage', "Chart cannot be displayed with the given data");

	protected abstract get chartType(): ChartType;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IThemeService) private themeService: IThemeService,
		@Inject(IAdsTelemetryService) private _telemetryService: IAdsTelemetryService
	) {
		super();
		chartjs.Chart.register(
			...chartjs.registerables,
		);
		chartjs.Chart.register(chartjs.Colors);
	}

	init() {
		this._register(this.themeService.onDidColorThemeChange(e => this.updateTheme(e)));
		this.updateTheme(this.themeService.getColorTheme());
		// Note: must use a boolean to not render the canvas until all properties such as the labels and chart type are set.
		// This is because chart.js doesn't auto-update anything other than dataset when re-rendering so defaults are used
		// hence it's easier to not render until ready
		this.options = mixin(this.options, { maintainAspectRatio: false });
		this._hasInit = true;
		this._hasError = false;
		try {
			this._changeRef.detectChanges();
		} catch (err) {
			this._hasInit = false;
			this._hasError = true;
			this._changeRef.detectChanges();
		}
		this._chartCanvas = document.createElement('canvas');
		this._chartContainer.nativeElement.appendChild(this._chartCanvas);
		this._chartCanvas.style.width = '100%';
		this._chartCanvas.style.height = '100%';
		this._chart = new chartjs.Chart(this._chartCanvas, {
			type: ChartTypeToChartJsType[this.chartType],
			data: {
				labels: this.labels,
				datasets: this.chartData,
			},
			options: this.options
		});
		this.refresh();

		this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.TelemetryAction.ChartCreated)
			.withAdditionalProperties({ type: this.chartType })
			.send();
	}

	/**
	 * Sets the options for the chart; handles rerendering the chart if needed
	 */
	public set options(options: chartjs.ChartOptions) {
		this._options = options;
		if (this._isDataAvailable) {
			this._options = mixin({}, mixin(this._options, { animation: { duration: 0 } }));
			this.refresh();
		}
	}

	public get options(): chartjs.ChartOptions {
		return this._options;
	}

	protected updateTheme(e: IColorTheme): void {
		const foregroundColor = e.getColor(colors.editorForeground);
		const foreground = foregroundColor ? foregroundColor.toString() : null;
		const options: chartjs.ChartOptions = {
			plugins: {
				legend: {
					labels: {
						color: foreground
					}
				}
			}
		};
		this.options = mixin({}, mixin(this.options, options));
	}

	public refresh() {
		// cheaper refresh but causes problems when change data for rerender
		if (this._chart) {
			this._chart.options = this.options;
			this._chart.data.datasets = this.chartData;
			this._chart.data.labels = this.labels;
			this._chart.config['type'] = ChartTypeToChartJsType[this.chartType];
			this._chart.update();
		}
	}

	public refreshChartOptions() {
		if (this._chart) {
			this._chart.options = this.options;
			this._chart.update();
		}
	}

	public getCanvasData(): string | undefined {
		if (this._chart) {
			return this._chart.toBase64Image();
		} else {
			return undefined;
		}
	}

	@Input() set data(data: IInsightData) {
		// unmemoize chart data as the data needs to be recalced
		this.clearMemoize();
		this._data = this.filterToTopNData(data);
		if (isValidData(data)) {
			this._isDataAvailable = true;
		}

		this._changeRef.detectChanges();
	}

	private filterToTopNData(data: IInsightData): IInsightData {
		if (this._config.dataDirection === 'horizontal') {
			return {
				columns: this.getTopNData(data.columns),
				rows: data.rows.map((row) => {
					return this.getTopNData(row);
				})
			};
		} else {
			return {
				columns: data.columns,
				rows: data.rows.slice(0, this._config.showTopNData)
			};
		}
	}

	private getTopNData(data: any[]): any[] {
		if (this._config.showTopNData) {
			if (this._config.dataDirection === 'horizontal' && this._config.labelFirstColumn) {
				return data.slice(0, this._config.showTopNData + 1);
			} else {
				return data.slice(0, this._config.showTopNData);
			}
		} else {
			return data;
		}
	}

	protected clearMemoize(): void {
		this._cachedChartData = undefined;
		this._cachedColors = undefined;
		this._cachedLabels = undefined;
	}

	public setConfig(config: IChartConfig) {
		this.clearMemoize();
		this._config = mixin(config, this._defaultConfig, false);
		this.legendPosition = this._config.legendPosition;
		if (this._isDataAvailable) {
			this._options = mixin({}, mixin(this._options, { animation: false }));
			this.refresh();
		}
	}

	/* Typescript does not allow you to access getters/setters for super classes.
	his is a workaround that allows us to still call base getter */
	private _cachedChartData: chartjs.ChartDataset[];
	protected getChartData(): chartjs.ChartDataset[] {
		if (!this._cachedChartData) {
			if (this._config.dataDirection === 'horizontal') {
				if (this._config.labelFirstColumn) {
					this._cachedChartData = this._data.rows.map((row) => {
						return {
							data: row.map(item => Number(item)).slice(1),
							label: row[0]
						};
					});
				} else {
					this._cachedChartData = this._data.rows.map((row, i) => {
						return {
							data: row.map(item => Number(item)),
							label: 'Series' + i
						};
					});
				}
			} else {
				if (this._config.columnsAsLabels) {
					this._cachedChartData = this._data.rows[0].slice(1).map((row, i) => {
						return {
							data: this._data.rows.map(row => Number(row[i + 1])),
							label: this._data.columns[i + 1]
						};
					});
				} else {
					this._cachedChartData = this._data.rows[0].slice(1).map((row, i) => {
						return {
							data: this._data.rows.map(row => Number(row[i + 1])),
							label: 'Series' + (i + 1)
						};
					});
				}
			}
		}
		return this._cachedChartData;
	}

	public get chartData(): chartjs.ChartDataset[] {
		return this.getChartData();
	}

	private _cachedLabels: Array<string>;
	public getLabels(): Array<string> {
		if (!this._cachedLabels) {
			if (this._config.dataDirection === 'horizontal') {
				if (this._config.labelFirstColumn) {
					this._cachedLabels = this._data.columns.slice(1);
				} else {
					this._cachedLabels = this._data.columns;
				}
			} else {
				this._cachedLabels = this._data.rows.map(row => row[0]);
			}
		}
		return this._cachedLabels;
	}

	public get labels(): Array<string> {
		return this.getLabels();
	}

	private _cachedColors: { backgroundColor: string[] }[];
	public get colors(): { backgroundColor: string[] }[] {
		if (!this._cachedColors) {
			if (this._config && this._config.colorMap) {
				const backgroundColor = this.labels.map((item) => {
					return this._config.colorMap[item];
				});
				const colorsMap = { backgroundColor };
				this._cachedColors = [colorsMap];
			} else {
				this._cachedColors = undefined;
			}
		}
		return this._cachedColors;
	}

	public set legendPosition(input: LegendPosition) {
		const options: chartjs.ChartOptions = {
			plugins: {
				legend: {
					position: 'top',
					display: true
				}
			}
		};
		if (input === 'none') {
			options.plugins.legend.display = false;
		} else {
			options.plugins.legend.position = input;
		}
		this.options = mixin(this.options, options);
	}
}

function isValidData(data: IInsightData): boolean {
	if (types.isUndefinedOrNull(data)) {
		return false;
	}

	if (types.isUndefinedOrNull(data.columns)) {
		return false;
	}

	if (types.isUndefinedOrNull(data.rows)) {
		return false;
	}

	return true;
}
