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

export class TopResourceConsumingQueries extends BaseQueryStoreReport {
	private queries: QueryStoreView;
	private planSummary: QueryStoreView;
	private plan: QueryStoreView;

	constructor(databaseName: string) {
		super(constants.topResourceConsumingQueriesToolbarLabel(databaseName), constants.topResourceConsumingQueriesTabId,/*resizeable*/ true);
		this.queries = new QueryStoreView(constants.queries, 'chartreuse');
		this.planSummary = new QueryStoreView(constants.planSummary('x'), 'coral'); // TODO: replace 'x' with actual query id
		this.plan = new QueryStoreView(constants.plan('x'), 'darkturquoise');
	}

	public override async createViews(view: azdata.ModelView): Promise<azdata.FlexContainer[]> {
		const queriesContainer = await this.queries.createViewContainer(view);
		const planSummaryContainer = await this.planSummary.createViewContainer(view);
		const planContainer = await this.plan.createViewContainer(view);

		return [queriesContainer, planSummaryContainer, planContainer];
	}

	protected override async configureButtonClick(configureDialog: ConfigureDialog): Promise<void> {
		const configComponentsInfo: ConfigComponentsInfo[] = [ConfigComponentsInfo.consumptionCriteriaComponentTopResource, ConfigComponentsInfo.timeIntervalComponent, ConfigComponentsInfo.returnComponent,
		ConfigComponentsInfo.filterComponent];
		await configureDialog.openDialog(configComponentsInfo);
	}
}
