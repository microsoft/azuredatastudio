/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import BarChart, { IBarChartConfig } from './barChart.component';
import { forwardRef, Inject, ChangeDetectorRef } from '@angular/core';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ChartType } from 'sql/workbench/contrib/charts/browser/interfaces';
import * as chartjs from 'chart.js';
import { mixin } from 'sql/base/common/objects';
import { customMixin } from 'sql/workbench/contrib/charts/browser/interfaces';

export default class HorizontalBarChart extends BarChart {
	protected override readonly chartType: ChartType = ChartType.Bar;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) _changeRef: ChangeDetectorRef,
		@Inject(IThemeService) themeService: IThemeService,
		@Inject(IAdsTelemetryService) telemetryService: IAdsTelemetryService
	) {
		super(_changeRef, themeService, telemetryService);
	}

	public override setConfig(config: IBarChartConfig): void {
		let options: chartjs.ChartOptions = {
			indexAxis: 'y'
		};
		this.options = mixin({}, mixin(this.options, options, true, customMixin));
		super.setConfig(config);
	}
}
