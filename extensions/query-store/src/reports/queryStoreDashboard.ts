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
	protected editor: azdata.workspace.ModelViewEditor;
	protected flexModel?: azdata.FlexContainer;
	protected configureButton?: azdata.ButtonComponent;

	constructor(private dbName: string, private extensionContext: vscode.ExtensionContext) {
		this.editor = azdata.workspace.createModelViewEditor(dbName, { retainContextWhenHidden: true, supportsSave: false }, dbName);
	}

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

			const topResourceConsumingTab: azdata.DashboardTab = {
				id: 'TopResourceConsumingTab',
				content: topResourceConsumingQueriesReport.flexModel!,
				title: constants.topResourceConsumingQueries
			};

			const overallResourceConsumptionTab: azdata.DashboardTab = {
				id: 'OverallResourceConsumptionTab',
				content: overallResourceConsumptionReport.flexModel!,
				title: constants.overallResourceConsumption
			};

			return [
				overallResourceConsumptionTab,
				topResourceConsumingTab
			];
		});

		await dashboard.open();
	}
}

