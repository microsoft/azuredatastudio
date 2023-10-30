/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../common/constants';
import { BaseQueryStoreReport } from './baseQueryStoreReport';
import { QueryStoreView } from './queryStoreView';
import { ConfigureDialog } from '../settings/configureDialog';
import { ConfigComponentsInfo } from '../common/utils';


export class OverallResourceConsumption extends BaseQueryStoreReport {
	private duration: QueryStoreView;
	private executionCount: QueryStoreView;
	private cpuTime: QueryStoreView;
	private logicalReads: QueryStoreView;

	constructor(databaseName: string) {
		super(constants.overallResourceConsumptionToolbarLabel(databaseName), constants.overallResourceConsumptionTabId,/*resizeable*/ false);
		this.duration = new QueryStoreView(constants.duration, 'chartreuse');
		this.executionCount = new QueryStoreView(constants.executionCount, 'coral');
		this.cpuTime = new QueryStoreView(constants.cpuTime, 'darkturquoise');
		this.logicalReads = new QueryStoreView(constants.logicalReads, 'forestgreen');
	}

	public override async createViews(view: azdata.ModelView): Promise<azdata.FlexContainer[]> {
		const durationContainer = await this.duration.createViewContainer(view);
		const executionCountContainer = await this.executionCount.createViewContainer(view);
		const cpuTimeContainer = await this.cpuTime.createViewContainer(view);
		const logicalReadsContainer = await this.logicalReads.createViewContainer(view);

		return [durationContainer, executionCountContainer, cpuTimeContainer, logicalReadsContainer];
	}

	protected override async configureButtonClick(configureDialog: ConfigureDialog): Promise<void> {
		const configComponentsInfo: ConfigComponentsInfo[] = [ConfigComponentsInfo.chartComponent, ConfigComponentsInfo.timeIntervalComponentOverallResource];
		await configureDialog.openDialog(configComponentsInfo);
	}
}
