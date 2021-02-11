/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPanelTab } from 'sql/base/browser/ui/panel/panel';
import { ChartView } from './chartView';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';

import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { VisualizationOptions, VisualizationType } from 'sql/workbench/services/query/common/query';
import { ChartType, InsightType } from 'sql/workbench/contrib/charts/common/interfaces';
import { INotificationService } from 'vs/platform/notification/common/notification';

const VisualizationTypeMap = new Map<VisualizationType, (ChartType | InsightType)>([
	['Bar', ChartType.Bar],
	['Count', InsightType.Count],
	['Doughnut', ChartType.Doughnut],
	['HorizontalBar', ChartType.HorizontalBar],
	['Image', InsightType.Image],
	['Line', ChartType.Line],
	['Pie', ChartType.Pie],
	['Scatter', ChartType.Scatter],
	['Table', InsightType.Table],
	['TimeSeries', ChartType.TimeSeries],
]);

export class ChartTab implements IPanelTab {
	public readonly title = localize('chartTabTitle', "Chart");
	public readonly identifier = 'ChartTab';
	public readonly view: ChartView;

	constructor(@IInstantiationService instantiationService: IInstantiationService,
		@INotificationService private notificationService: INotificationService) {
		this.view = instantiationService.createInstance(ChartView, true);
	}

	public set queryRunner(runner: QueryRunner) {
		this.view.queryRunner = runner;
	}

	public chart(dataId: { batchId: number, resultId: number }): void {
		this.view.chart(dataId);
	}

	public setOptions(options: VisualizationOptions): void {
		let type = VisualizationTypeMap.get(options.type);
		if (type) {
			this.view.options = {
				type: type
			};
		} else {
			this.notificationService.error(localize('chart.unsupportedVisualizationType', "The visualization type: '{0}' is not supported", options.type));
		}
	}

	public dispose() {
		this.view.dispose();
	}

	public clear() {
		this.view.clear();
	}
}
