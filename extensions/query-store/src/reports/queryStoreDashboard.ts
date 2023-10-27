/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../common/constants';
import { TopResourceConsumingQueries } from './topResourceConsumingQueries';
import { OverallResourceConsumption } from './overallResourceConsumption';
import { Deferred } from '../common/promise';

export class QueryStoreDashboard {
	private dashboard?: azdata.window.ModelViewDashboard;
	private initDashboardComplete: Deferred = new Deferred();

	constructor(private dbName: string) { }

	/**
	 * Creates and opens the report
	 */
	public async open(): Promise<void> {
		// TODO: update title based on selected tab to have the current selected report in editor tab title
		this.dashboard = azdata.window.createModelViewDashboard(constants.queryStoreDashboardTitle(this.dbName));
		this.dashboard.registerTabs(async (view: azdata.ModelView) => {
			const topResourceConsumingQueriesReport = new TopResourceConsumingQueries(this.dbName);
			const overallResourceConsumptionReport = new OverallResourceConsumption(this.dbName);

			await Promise.all([topResourceConsumingQueriesReport.createReport(view), overallResourceConsumptionReport.createReport(view)]);

			const topResourceConsumingQueriesTab: azdata.DashboardTab = {
				id: constants.topResourceConsumingQueriesTabId,
				content: topResourceConsumingQueriesReport.ReportContent!,
				title: constants.topResourceConsumingQueries
			};

			const overallResourceConsumptionTab: azdata.DashboardTab = {
				id: constants.overallResourceConsumptionTabId,
				content: overallResourceConsumptionReport.ReportContent!,
				title: constants.overallResourceConsumption
			};

			this.initDashboardComplete?.resolve();

			return [
				overallResourceConsumptionTab,
				topResourceConsumingQueriesTab
			];
		});

		await this.dashboard.open();
		await this.initDashboardComplete;
	}

	public selectTab(selectedTab: string): void {
		// TODO: fix flashing - currently starts with the first tab selected, then switches to the other tab. Ideally would be able to set the
		// selected tab when registering the tabs
		this.dashboard?.selectTab(selectedTab);
	}
}
