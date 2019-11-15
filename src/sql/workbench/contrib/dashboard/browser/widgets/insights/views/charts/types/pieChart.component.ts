/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChartInsight } from 'sql/workbench/contrib/dashboard/browser/widgets/insights/views/charts/chartInsight.component';
import { ChangeDetectorRef, Inject, forwardRef } from '@angular/core';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ChartType } from 'sql/workbench/contrib/charts/common/interfaces';

export default class PieChart extends ChartInsight {
	protected readonly chartType: ChartType = ChartType.Pie;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) _changeRef: ChangeDetectorRef,
		@Inject(IThemeService) themeService: IThemeService,
		@Inject(IAdsTelemetryService) telemetryService: IAdsTelemetryService
	) {
		super(_changeRef, themeService, telemetryService);
	}
}
