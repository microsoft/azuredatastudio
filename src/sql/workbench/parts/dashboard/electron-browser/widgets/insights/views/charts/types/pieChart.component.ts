/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChartInsight } from 'sql/workbench/parts/dashboard/electron-browser/widgets/insights/views/charts/chartInsight.component';
import { ChangeDetectorRef, Inject, forwardRef } from '@angular/core';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { ChartType } from 'sql/workbench/parts/charts/browser/interfaces';

export default class PieChart extends ChartInsight {
	protected readonly chartType: ChartType = ChartType.Pie;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) _changeRef: ChangeDetectorRef,
		@Inject(IThemeService) themeService: IThemeService,
		@Inject(ITelemetryService) telemetryService: ITelemetryService,
		@Inject(ILogService) logService: ILogService
	) {
		super(_changeRef, themeService, telemetryService, logService);
	}
}
