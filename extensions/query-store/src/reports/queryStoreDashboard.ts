/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as constants from '../common/constants';
import { TopResourceConsumingQueries } from './topResourceConsumingQueries';
import { OverallResourceConsumption } from './overallResourceConsumption';

export class QueryStoreDashboard {
	constructor(private dbName: string, private extensionContext: vscode.ExtensionContext) { }

	/**
	 * Creates and opens the report
	 */
	public async open(): Promise<void> {
		// TODO: update title based on selected tab to have the current selected report in editor tab title
		const dashboard = azdata.window.createModelViewDashboard(constants.queryStoreDashboardTitle(this.dbName));
		dashboard.registerTabs(async (view: azdata.ModelView) => {
			const topResourceConsumingQueriesReport = new TopResourceConsumingQueries(this.extensionContext, this.dbName);
			const overallResourceConsumptionReport = new OverallResourceConsumption(this.extensionContext, this.dbName);

			await Promise.all([topResourceConsumingQueriesReport.createReport(view), overallResourceConsumptionReport.createReport(view)]);

			const topResourceConsumingQueriesTab: azdata.DashboardTab = {
				id: 'TopResourceConsumingQueriesTab',
				content: topResourceConsumingQueriesReport.ReportContent!,
				title: constants.topResourceConsumingQueries
			};

			const overallResourceConsumptionTab: azdata.DashboardTab = {
				id: 'OverallResourceConsumptionTab',
				content: overallResourceConsumptionReport.ReportContent!,
				title: constants.overallResourceConsumption
			};

			return [
				overallResourceConsumptionTab,
				topResourceConsumingQueriesTab
			];
		});

		await dashboard.open();
	}
}

