/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mixin, deepClone } from 'vs/base/common/objects';

import BarChart, { IBarChartConfig } from './barChart.component';
import { defaultChartConfig, IDataSet } from 'sql/workbench/contrib/dashboard/browser/widgets/insights/views/charts/interfaces';
import { ChangeDetectorRef, Inject, forwardRef } from '@angular/core';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IPointDataSet } from 'sql/workbench/contrib/charts/browser/interfaces';
import { DataType, ChartType } from 'sql/workbench/contrib/charts/common/interfaces';
import { values } from 'vs/base/common/collections';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';

export interface ILineConfig extends IBarChartConfig {
	dataType?: DataType;
}

const defaultLineConfig = mixin(deepClone(defaultChartConfig), { dataType: 'number' }) as ILineConfig;

export default class LineChart extends BarChart {
	protected readonly chartType: ChartType = ChartType.Line;
	protected _config: ILineConfig;
	protected _defaultConfig = defaultLineConfig;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) _changeRef: ChangeDetectorRef,
		@Inject(IThemeService) themeService: IThemeService,
		@Inject(IAdsTelemetryService) telemetryService: IAdsTelemetryService
	) {
		super(_changeRef, themeService, telemetryService);
	}

	public init() {
		if (this._config.dataType === DataType.Point) {
			this.addAxisLabels();
		}
		super.init();
	}

	public get chartData(): Array<IDataSet | IPointDataSet> {
		if (this._config.dataType === DataType.Number) {
			return super.getChartData();
		} else {
			return this.getDataAsPoint();
		}
	}

	protected clearMemoize() {
		super.clearMemoize();
		LineChart.MEMOIZER.clear();
	}

	@LineChart.MEMOIZER
	protected getDataAsPoint(): Array<IPointDataSet> {
		const dataSetMap: { [label: string]: IPointDataSet } = {};
		this._data.rows.map(row => {
			if (row && row.length >= 3) {
				const legend = row[0];
				if (!dataSetMap[legend]) {
					dataSetMap[legend] = { label: legend, data: [], fill: false };
				}
				dataSetMap[legend].data.push({ x: Number(row[1]), y: Number(row[2]) });
			}
		});
		return values(dataSetMap);
	}

	public get labels(): Array<string> {
		if (this._config.dataType === DataType.Number) {
			return super.getLabels();
		} else {
			return [];
		}
	}

	protected addAxisLabels(): void {
		const xLabel = this._config.xAxisLabel || this._data.columns[1] || 'x';
		const yLabel = this._config.yAxisLabel || this._data.columns[2] || 'y';
		const options = {
			scales: {
				xAxes: [{
					type: 'linear',
					position: 'bottom',
					display: true,
					scaleLabel: {
						display: true,
						labelString: xLabel
					}
				}],

				yAxes: [{
					display: true,
					scaleLabel: {
						display: true,
						labelString: yLabel,
					}
				}]
			}
		};

		// @SQLTODO
		this.options = mixin(this.options, options, true);
	}
}
