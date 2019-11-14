/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import PieChart from './pieChart.component';
import { ChangeDetectorRef, Inject, forwardRef } from '@angular/core';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ChartType } from 'sql/workbench/contrib/charts/common/interfaces';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';

export default class DoughnutChart extends PieChart {
	protected readonly chartType: ChartType = ChartType.Doughnut;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) _changeRef: ChangeDetectorRef,
		@Inject(IThemeService) themeService: IThemeService,
		@Inject(IAdsTelemetryService) telemetryService: IAdsTelemetryService
	) {
		super(_changeRef, themeService, telemetryService);
	}
}
