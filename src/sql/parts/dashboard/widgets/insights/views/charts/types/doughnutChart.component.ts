/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import PieChart from './pieChart.component';
import { ChartType } from 'sql/parts/dashboard/widgets/insights/views/charts/interfaces';
import { ChangeDetectorRef, Inject, forwardRef, ElementRef } from '@angular/core';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';

export default class DoughnutChart extends PieChart {
	protected readonly chartType: ChartType = ChartType.Doughnut;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) _changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) _el: ElementRef,
		@Inject(IWorkbenchThemeService) themeService: IWorkbenchThemeService,
		@Inject(ITelemetryService) telemetryService: ITelemetryService
	) {
		super(_changeRef, _el, themeService, telemetryService);
	}
}
