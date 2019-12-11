/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import BarChart from './barChart.component';
import { forwardRef, Inject, ChangeDetectorRef } from '@angular/core';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ChartType } from 'sql/workbench/contrib/charts/common/interfaces';

export default class HorizontalBarChart extends BarChart {
	protected readonly chartType: ChartType = ChartType.HorizontalBar;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) _changeRef: ChangeDetectorRef,
		@Inject(IThemeService) themeService: IThemeService,
		@Inject(IAdsTelemetryService) telemetryService: IAdsTelemetryService
	) {
		super(_changeRef, themeService, telemetryService);
	}
}
