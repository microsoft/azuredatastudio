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
	private queries: QueryStoreView;
	private planSummary: QueryStoreView;
	private plan: QueryStoreView;

	constructor(extensionContext: vscode.ExtensionContext, databaseName: string) {
		super(constants.topResourceConsumingQueries, constants.topResourceConsumingQueriesToolbarLabel(databaseName), /*resizeable*/ true, extensionContext);
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
}
