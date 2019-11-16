/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import LineChart, { ILineConfig } from './lineChart.component';
import { defaultChartConfig } from 'sql/workbench/contrib/dashboard/browser/widgets/insights/views/charts/interfaces';

import { mixin, deepClone } from 'vs/base/common/objects';
import { ChangeDetectorRef, Inject, forwardRef } from '@angular/core';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ChartType } from 'sql/workbench/contrib/charts/common/interfaces';

const defaultScatterConfig = mixin(deepClone(defaultChartConfig), { dataType: 'point', dataDirection: 'horizontal' }) as ILineConfig;

export default class ScatterChart extends LineChart {
	protected readonly chartType: ChartType = ChartType.Scatter;
	protected _defaultConfig = defaultScatterConfig;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) _changeRef: ChangeDetectorRef,
		@Inject(IThemeService) themeService: IThemeService,
		@Inject(IAdsTelemetryService) telemetryService: IAdsTelemetryService
	) {
		super(_changeRef, themeService, telemetryService);
	}
}
