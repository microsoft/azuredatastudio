/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
// import * as path from 'path';
// import * as utils from '../common/utils';
// import * as constants from '../common/constants';

export class QueryStoreDashboard {
	protected editor: azdata.workspace.ModelViewEditor;
	protected flexModel?: azdata.FlexContainer;
	protected configureButton?: azdata.ButtonComponent;

	constructor(reportName: string) {
		this.editor = azdata.workspace.createModelViewEditor(reportName, { retainContextWhenHidden: true, supportsSave: false }, reportName);
	}

	/**
	 * Creates and opens the report
	 */
	public async open(): Promise<void> {
		const dashboard = azdata.window.createModelViewDashboard('Overall Resource Consumption - AdventureWorks');
		dashboard.registerTabs(async (view: azdata.ModelView) => {

			this.flexModel = <azdata.FlexContainer>view.modelBuilder.flexContainer().component();

			// this.flexModel.addItem(mainContainer, { CSSStyles: { 'width': '100%', 'height': '100%' } });

			this.flexModel.setLayout({
				flexFlow: 'column',
				height: '100%'
			});

			// const input1 = view.modelBuilder.inputBox().withProps({ value: 'input 1' }).component();
			// const homeTab: azdata.DashboardTab = {
			// 	id: 'home',
			// 	toolbar: toolbar,
			// 	content: input1,
			// 	title: 'Home',
			// };

			const topResourceConsumingTabText = view.modelBuilder.inputBox().withProps({ value: 'Top Resource Consuming Queries placeholder', width: '400px' }).component();

			const topResourceConsumingTab: azdata.DashboardTab = {
				id: 'TopResourceConsumingTab',
				content: topResourceConsumingTabText,
				title: 'Top Resource Consuming Queries'
			};

			const overallResourceConsumptionTabText = view.modelBuilder.inputBox().withProps({ value: 'Overall Resource Consumption', width: '400px' }).component();

			const overallResourceConsumptionTab: azdata.DashboardTab = {
				id: 'OverallResourceConsumptionTab',
				content: overallResourceConsumptionTabText,
				title: 'Overall Resource Consumption'
			};

			const oqueriesWithForcedPlansTabText = view.modelBuilder.inputBox().withProps({ value: 'Queries With Forced Plans Placeholder', width: '400px' }).component();

			const queriesWithForcedPlansTab: azdata.DashboardTab = {
				id: 'QueriesWithForcedPlansTab',
				content: oqueriesWithForcedPlansTabText,
				title: 'Queries With Forced Plans'
			};

			const trackedQueriesTabText = view.modelBuilder.inputBox().withProps({ value: 'Tracked Queries', width: '400px' }).component();

			const trackedQueriesTab: azdata.DashboardTab = {
				id: 'TrackedQueriesTab',
				content: trackedQueriesTabText,
				title: 'Tracked Queries'
			};

			return [
				overallResourceConsumptionTab,
				topResourceConsumingTab,
				queriesWithForcedPlansTab,
				trackedQueriesTab];
		});
		await dashboard.open();
	}
}

