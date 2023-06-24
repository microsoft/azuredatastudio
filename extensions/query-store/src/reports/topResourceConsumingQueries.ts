/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { BaseQueryStoreReport } from './baseQueryStoreReport';
import { QueryStoreView } from './queryStoreView';


export class TopResourceConsumingQueries extends BaseQueryStoreReport {
	queries: QueryStoreView;
	planSummary: QueryStoreView;
	plan: QueryStoreView;

	constructor(extensionContext: vscode.ExtensionContext, databaseName: string) {
		super(constants.topResourceConsumingQueries, constants.topResourceConsumingQueriesToolbarLabel(databaseName), true, extensionContext);
		this.queries = new QueryStoreView('Queries', 'chartreuse');
		this.planSummary = new QueryStoreView('Plan summary for query x', 'coral');
		this.plan = new QueryStoreView('Plan x', 'darkturquoise');
	}

	public override async createViews(view: azdata.ModelView): Promise<azdata.FlexContainer[]> {
		const queriesContainer = await this.queries.createViewContainer(view);
		const planSummaryContainer = await this.planSummary.createViewContainer(view);
		const planContainer = await this.plan.createViewContainer(view);

		return [queriesContainer, planSummaryContainer, planContainer];
	}
}
