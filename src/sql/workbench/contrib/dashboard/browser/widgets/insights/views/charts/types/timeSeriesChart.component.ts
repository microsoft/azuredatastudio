/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import LineChart, { ILineConfig } from './lineChart.component';
import { defaultChartConfig } from 'sql/workbench/contrib/dashboard/browser/widgets/insights/views/charts/interfaces';
import * as chartjs from 'chart.js';

import { mixin, deepClone } from 'vs/base/common/objects';
import { Color } from 'vs/base/common/color';
import { ChangeDetectorRef, Inject, forwardRef } from '@angular/core';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ChartType } from 'sql/workbench/contrib/charts/browser/interfaces';
import { values } from 'vs/base/common/collections';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';

const defaultTimeSeriesConfig = mixin(deepClone(defaultChartConfig), { dataType: 'point', dataDirection: 'horizontal' }) as ILineConfig;

export default class TimeSeriesChart extends LineChart {
	protected override _defaultConfig = defaultTimeSeriesConfig;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) _changeRef: ChangeDetectorRef,
		@Inject(IThemeService) themeService: IThemeService,
		@Inject(IAdsTelemetryService) telemetryService: IAdsTelemetryService
	) {
		super(_changeRef, themeService, telemetryService);
	}

	protected override addAxisLabels(): void {
		const xLabel = this._config.xAxisLabel || this.getLabels()[1] || 'x';
		const yLabel = this._config.yAxisLabel || this.getLabels()[2] || 'y';

		const options: chartjs.ChartOptions = {
			scales: {
				x: {
					type: 'time',
					display: true,
					title: {
						display: true,
						text: xLabel
					},
					ticks: {
						autoSkip: false,
						maxRotation: 45,
						minRotation: 45
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

		this.options = Object.assign({}, mixin(this.options, options));
	}

	protected override getDataAsPoint(): chartjs.ChartDataset[] {
		const dataSetMap: { [label: string]: chartjs.ChartDataset<'line', any[]> } = {};
		this._data.rows.map(row => {
			if (row && row.length >= 3) {
				const legend = row[0];
				if (!dataSetMap[legend]) {
					dataSetMap[legend] = { label: legend, data: [] };
				}
				dataSetMap[legend].data.push({ x: row[1], y: Number(row[2]) });

				if (this.chartType === ChartType.Scatter) {
					dataSetMap[legend].backgroundColor = Color.cyan.toString();
				}
			}
		});
		return values(dataSetMap);
	}
}
