/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, Input, Inject, ChangeDetectorRef, forwardRef, ViewChild } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import * as chartjs from 'chart.js';

import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { mixin } from 'sql/base/common/objects';
import { defaultChartConfig, IChartConfig, IDataSet } from 'sql/workbench/contrib/dashboard/browser/widgets/insights/views/charts/interfaces';

import * as colors from 'vs/platform/theme/common/colorRegistry';
import * as types from 'vs/base/common/types';
import { Disposable } from 'vs/base/common/lifecycle';
import * as nls from 'vs/nls';
import { IThemeService, IColorTheme } from 'vs/platform/theme/common/themeService';
import { IPointDataSet } from 'sql/workbench/contrib/charts/browser/interfaces';
import { IInsightsView, IInsightData } from 'sql/platform/dashboard/browser/insightRegistry';
import { ChartType, LegendPosition } from 'sql/workbench/contrib/charts/common/interfaces';
import { createMemoizer } from 'vs/base/common/decorators';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';

@Component({
	template: `	<div style="display: block; width: 100%; height: 100%; position: relative">
					<canvas #canvas *ngIf="_isDataAvailable && _hasInit"
							baseChart
							[datasets]="chartData"
							[labels]="labels"
							[chartType]="chartType"
							[colors]="colors"
							[options]="_options"></canvas>
					<div *ngIf="_hasError">{{CHART_ERROR_MESSAGE}}</div>
				</div>`
})
export abstract class ChartInsight extends Disposable implements IInsightsView {
	protected static readonly MEMOIZER = createMemoizer();

	private _isDataAvailable: boolean = false;
	protected _hasInit: boolean = false;
	protected _hasError: boolean = false;
	private _options: any = {};

	@ViewChild(BaseChartDirective) private _chart: BaseChartDirective;

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
		this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.ChartCreated)
			.withAdditionalProperties({ type: this.chartType })
			.send();
	}

	/**
	 * Sets the options for the chart; handles rerendering the chart if needed
	 */
	public set options(options: any) {
		this._options = options;
		if (this._isDataAvailable) {
			this._options = mixin({}, mixin(this._options, { animation: { duration: 0 } }));
			this.refresh();
		}
	}

	public get options(): any {
		return this._options;
	}

	protected updateTheme(e: IColorTheme): void {
		const foregroundColor = e.getColor(colors.editorForeground);
		const foreground = foregroundColor ? foregroundColor.toString() : null;
		const backgroundColor = e.getColor(colors.editorBackground);
		const background = backgroundColor ? backgroundColor.toString() : null;

		const options = {
			legend: {
				labels: {
					fontColor: foreground
				}
			},
			viewArea: {
				backgroundColor: background
			}
		};
		this.options = mixin({}, mixin(this.options, options));
	}

	public refresh() {
		// cheaper refresh but causes problems when change data for rerender
		if (this._chart) {
			this._chart.ngOnChanges({});
		}
	}

	public getCanvasData(): string {
		if (this._chart && this._chart.chart) {
			return this._chart.chart.toBase64Image();
		} else {
			return undefined;
		}
	}

	@Input() set data(data: IInsightData) {
		// unmemoize chart data as the data needs to be recalced
		ChartInsight.MEMOIZER.clear();
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
		// unmemoize getters since their result can be changed by a new config
		ChartInsight.MEMOIZER.clear();
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
	@ChartInsight.MEMOIZER
	protected getChartData(): Array<IDataSet> {
		if (this._config.dataDirection === 'horizontal') {
			if (this._config.labelFirstColumn) {
				return this._data.rows.map((row) => {
					return {
						data: row.map(item => Number(item)).slice(1),
						label: row[0]
					};
				});
			} else {
				return this._data.rows.map((row, i) => {
					return {
						data: row.map(item => Number(item)),
						label: 'Series' + i
					};
				});
			}
		} else {
			if (this._config.columnsAsLabels) {
				return this._data.rows[0].slice(1).map((row, i) => {
					return {
						data: this._data.rows.map(row => Number(row[i + 1])),
						label: this._data.columns[i + 1]
					};
				});
			} else {
				return this._data.rows[0].slice(1).map((row, i) => {
					return {
						data: this._data.rows.map(row => Number(row[i + 1])),
						label: 'Series' + (i + 1)
					};
				});
			}
		}
	}

	public get chartData(): Array<IDataSet | IPointDataSet> {
		return this.getChartData();
	}

	@ChartInsight.MEMOIZER
	public getLabels(): Array<string> {
		if (this._config.dataDirection === 'horizontal') {
			if (this._config.labelFirstColumn) {
				return this._data.columns.slice(1);
			} else {
				return this._data.columns;
			}
		} else {
			return this._data.rows.map(row => row[0]);
		}
	}

	public get labels(): Array<string> {
		return this.getLabels();
	}


	@ChartInsight.MEMOIZER
	public get colors(): { backgroundColor: string[] }[] {
		if (this._config && this._config.colorMap) {
			const backgroundColor = this.labels.map((item) => {
				return this._config.colorMap[item];
			});
			const colorsMap = { backgroundColor };
			return [colorsMap];
		} else {
			return undefined;
		}
	}

	public set legendPosition(input: LegendPosition) {
		const options = {
			legend: {
				display: true,
				position: 'top'
			}
		};
		if (input === 'none') {
			options.legend.display = false;
		} else {
			options.legend.position = input;
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

chartjs.Chart.pluginService.register({
	beforeDraw: function (chart) {
		if ((chart.config.options as any).viewArea && (chart.config.options as any).viewArea.backgroundColor) {
			let ctx = (chart as any).chart.ctx;
			ctx.fillStyle = (chart.config.options as any).viewArea.backgroundColor;
			ctx.fillRect(0, 0, (chart as any).chart.width, (chart as any).chart.height);
		}
	}
});
