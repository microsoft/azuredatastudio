/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mixin, deepClone } from 'vs/base/common/objects';

import BarChart, { IBarChartConfig } from './barChart.component';
import { memoize, unmemoize } from 'sql/base/common/decorators';
import { ChartType, DataType, defaultChartConfig, IDataSet, IPointDataSet } from 'sql/workbench/parts/dashboard/widgets/insights/views/charts/interfaces';
import { ChangeDetectorRef, Inject, forwardRef } from '@angular/core';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';

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
		@Inject(ITelemetryService) telemetryService: ITelemetryService,
		@Inject(ILogService) logService: ILogService
	) {
		super(_changeRef, themeService, telemetryService, logService);
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
		unmemoize(this, 'getDataAsPoint');
	}

	@memoize
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
		return Object.values(dataSetMap);
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
