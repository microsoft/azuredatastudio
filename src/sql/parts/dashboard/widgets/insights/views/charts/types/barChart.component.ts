/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChartInsight } from 'sql/parts/dashboard/widgets/insights/views/charts/chartInsight.component';
import { mixin } from 'sql/base/common/objects';
import { ChartType, IChartConfig, customMixin } from 'sql/parts/dashboard/widgets/insights/views/charts/interfaces';

import { IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as colors from 'vs/platform/theme/common/colorRegistry';
import { editorLineNumbers } from 'vs/editor/common/view/editorColorRegistry';

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

	public setConfig(config: IBarChartConfig): void {
		let options = {};
		if (config.xAxisMax) {
			let opts = {
				scales: {
					xAxes: [{
						display: true,
						ticks: {
							max: config.xAxisMax
						}
					}]
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		if (config.xAxisMin) {
			let opts = {
				scales: {
					xAxes: [{
						display: true,
						ticks: {
							min: config.xAxisMin
						}
					}]
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		if (config.xAxisLabel) {
			let opts = {
				scales: {
					xAxes: [{
						display: true,
						scaleLabel: {
							display: true,
							labelString: config.xAxisLabel
						}
					}]
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		if (config.yAxisMax) {
			let opts = {
				scales: {
					yAxes: [{
						display: true,
						ticks: {
							max: config.yAxisMax
						}
					}]
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		if (config.yAxisMin) {
			let opts = {
				scales: {
					yAxes: [{
						display: true,
						ticks: {
							min: config.yAxisMin
						}
					}]
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		if (config.yAxisLabel) {
			let opts = {
				scales: {
					yAxes: [{
						display: true,
						scaleLabel: {
							display: true,
							labelString: config.yAxisLabel
						}
					}]
				}
			};
			options = mixin({}, mixin(options, opts, true, customMixin));
		}

		this.options = mixin({}, mixin(this.options, options, true, customMixin));
		super.setConfig(config);
	}

	protected updateTheme(e: IColorTheme): void {
		super.updateTheme(e);
		let foregroundColor = e.getColor(colors.editorForeground);
		let foreground = foregroundColor ? foregroundColor.toString() : null;
		let gridLinesColor = e.getColor(editorLineNumbers);
		let gridLines = gridLinesColor ? gridLinesColor.toString() : null;
		let options = {
			scales: {
				xAxes: [{
					scaleLabel: {
						fontColor: foreground
					},
					ticks: {
						fontColor: foreground
					},
					gridLines: {
						color: gridLines
					}
				}],
				yAxes: [{
					scaleLabel: {
						fontColor: foreground
					},
					ticks: {
						fontColor: foreground
					},
					gridLines: {
						color: gridLines
					}
				}]
			}
		};

		this.options = mixin({}, mixin(this.options, options, true, customMixin));
	}
}
