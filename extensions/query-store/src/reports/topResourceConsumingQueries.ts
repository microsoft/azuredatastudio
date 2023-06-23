/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { BaseQueryStoreReport } from './baseQueryStoreReport';
import { createOneComponentFlexContainer } from '../common/utils';


export class TopResourceConsumingQueries extends BaseQueryStoreReport {
	constructor(extensionContext: vscode.ExtensionContext, databaseName: string) {
		super(constants.topResourceConsumingQueries, constants.topResourceConsumingQueriesToolbarLabel(databaseName), true, extensionContext);
	}

	public override async createViews(view: azdata.ModelView): Promise<azdata.FlexContainer[]> {
		// TODO: replace these text components with the actual chart components
		const queriesComponent = view.modelBuilder.text().withProps({
			value: 'Queries'
		}).component();
		const queriesContainer = await createOneComponentFlexContainer(view, queriesComponent, 'chartreuse');

		const planSummaryComponent = view.modelBuilder.text().withProps({
			value: 'Plan summary for query x'
		}).component();

		const planSummaryContainer = await createOneComponentFlexContainer(view, planSummaryComponent, 'coral');

		const planComponent = view.modelBuilder.text().withProps({
			value: 'Plan x'
		}).component();

		const planContainer = await createOneComponentFlexContainer(view, planComponent, 'darkturquoise');

		return [queriesContainer, planSummaryContainer, planContainer];
	}
}
