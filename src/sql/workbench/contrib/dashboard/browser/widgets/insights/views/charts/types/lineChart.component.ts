/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mixin, deepClone } from 'vs/base/common/objects';
import * as chartjs from 'chart.js';

import BarChart, { IBarChartConfig } from './barChart.component';
import { defaultChartConfig } from 'sql/workbench/contrib/dashboard/browser/widgets/insights/views/charts/interfaces';
import { ChangeDetectorRef, Inject, forwardRef } from '@angular/core';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { DataType, ChartType } from 'sql/workbench/contrib/charts/browser/interfaces';
import { values } from 'vs/base/common/collections';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';

export interface ILineConfig extends IBarChartConfig {
	dataType?: DataType;
}

const defaultLineConfig = mixin(deepClone(defaultChartConfig), { dataType: 'number' }) as ILineConfig;

export default class LineChart extends BarChart {
	protected override readonly chartType: ChartType = ChartType.Line;
	protected override _config: ILineConfig;
	protected override _defaultConfig = defaultLineConfig;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) _changeRef: ChangeDetectorRef,
		@Inject(IThemeService) themeService: IThemeService,
		@Inject(IAdsTelemetryService) telemetryService: IAdsTelemetryService
	) {
		super(_changeRef, themeService, telemetryService);
	}

	public override init() {
		if (this._config.dataType === DataType.Point) {
			this.addAxisLabels();
		}
		super.init();
	}

	public override get chartData(): chartjs.ChartDataset[] {
		if (this._config.dataType === DataType.Number) {
			return super.getChartData();
		} else {
			return this.getDataAsPoint();
		}
	}

	protected override clearMemoize() {
		super.clearMemoize();
		this._cachedPointData = undefined;
	}

	private _cachedPointData: chartjs.ChartDataset[];
	protected getDataAsPoint(): chartjs.ChartDataset[] {
		if (!this._cachedPointData) {
			const dataSetMap: { [label: string]: chartjs.ChartDataset } = {};
			this._data.rows.map(row => {
				if (row && row.length >= 3) {
					const legend = row[0];
					if (!dataSetMap[legend]) {
						dataSetMap[legend] = { label: legend, data: [], fill: false };
					}
					dataSetMap[legend].data.push({ x: Number(row[1]), y: Number(row[2]) });
				}
			});
			this._cachedPointData = values(dataSetMap);
		}
		return this._cachedPointData;
	}

	public override get labels(): Array<string> {
		if (this._config.dataType === DataType.Number) {
			return super.getLabels();
		} else {
			return [];
		}
	}

	protected addAxisLabels(): void {
		const xLabel = this._config.xAxisLabel || this._data.columns[1] || 'x';
		const yLabel = this._config.yAxisLabel || this._data.columns[2] || 'y';
		const options: chartjs.ChartOptions = {
			scales: {
				x: {
					type: 'linear',
					position: 'bottom',
					display: true,
					title: {
						display: true,
						text: xLabel
					}
				},
				y: {
					display: true,
					title: {
						display: true,
						text: yLabel
					}
				}
			}
		};

		// @SQLTODO
		this.options = mixin(this.options, options, true);
	}
}
