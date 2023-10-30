/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChartInsight } from 'sql/workbench/contrib/dashboard/browser/widgets/insights/views/charts/chartInsight.component';
import { mixin } from 'sql/base/common/objects';
import { IChartConfig } from 'sql/workbench/contrib/dashboard/browser/widgets/insights/views/charts/interfaces';
import * as chartjs from 'chart.js';

import * as colors from 'vs/platform/theme/common/colorRegistry';
import { editorLineNumbers } from 'vs/editor/common/core/editorColorRegistry';
import { ChangeDetectorRef, Inject, forwardRef } from '@angular/core';
import { IThemeService, IColorTheme } from 'vs/platform/theme/common/themeService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { customMixin } from 'sql/workbench/contrib/charts/browser/interfaces';
import { ChartType } from 'sql/workbench/contrib/charts/browser/interfaces';

export interface IBarChartConfig extends IChartConfig {
	yAxisMin: number;
	yAxisMax: number;
	yAxisLabel: string;
	xAxisMin: number;
	xAxisMax: number;
	xAxisLabel: string;
}

export default class BarChart extends ChartInsight {
	protected readonly chartType: ChartType = ChartType.Bar;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) _changeRef: ChangeDetectorRef,
		@Inject(IThemeService) themeService: IThemeService,
		@Inject(IAdsTelemetryService) telemetryService: IAdsTelemetryService
	) {
		super(_changeRef, themeService, telemetryService);
	}

	public override setConfig(config: IBarChartConfig): void {
		let options: chartjs.ChartOptions = {};
		if (config.xAxisMax) {
			const opts: chartjs.ChartOptions = {
				scales: {
					x: {
						display: true,
						max: config.xAxisMax
					}
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		if (config.xAxisMin) {
			const opts: chartjs.ChartOptions = {
				scales: {
					x: {
						display: true,
						min: config.xAxisMin
					}
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		if (config.xAxisLabel) {
			const opts: chartjs.ChartOptions = {
				scales: {
					x: {
						display: true,
						title: {
							display: true,
							text: config.xAxisLabel
						}
					}
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		if (config.yAxisMax) {
			const opts: chartjs.ChartOptions = {
				scales: {
					y: {
						display: true,
						max: config.yAxisMax
					}
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		if (config.yAxisMin) {
			const opts: chartjs.ChartOptions = {
				scales: {
					y: {
						display: true,
						min: config.yAxisMin
					}
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		if (config.yAxisLabel) {
			const opts: chartjs.ChartOptions = {
				scales: {
					y: {
						display: true,
						title: {
							display: true,
							text: config.yAxisLabel
						}
					}
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		this.options = mixin({}, mixin(this.options, options, true, customMixin));
		super.setConfig(config);
	}

	protected override updateTheme(e: IColorTheme): void {
		super.updateTheme(e);
		const foregroundColor = e.getColor(colors.editorForeground);
		const foreground = foregroundColor ? foregroundColor.toString() : null;
		const gridLinesColor = e.getColor(editorLineNumbers);
		const gridLines = gridLinesColor ? gridLinesColor.toString() : null;
		const options: chartjs.ChartOptions = {
			scales: {
				x: {
					title: {
						color: foreground
					},
					ticks: {
						color: foreground
					},
					grid: {
						color: gridLines
					}
				},
				y: {
					title: {
						color: foreground
					},
					ticks: {
						color: foreground
					},
					grid: {
						color: gridLines
					}
				}
			}
		};

		this.options = mixin({}, mixin(this.options, options, true, customMixin));
	}
}
