/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { BdcDashboardModel, BdcErrorEvent } from './bdcDashboardModel';
import { BdcServiceStatusPage } from './bdcServiceStatusPage';
import { BdcDashboardOverviewPage } from './bdcDashboardOverviewPage';
import { BdcStatusModel, ServiceStatusModel } from '../controller/apiGenerated';
import { getServiceNameDisplayText, showErrorMessage } from '../utils';
import { HdfsDialogCancelledError } from './hdfsDialogBase';
import { InitializingComponent } from './intializingComponent';
import * as loc from '../localizedConstants';

export class BdcDashboard extends InitializingComponent {

	private dashboard: azdata.window.ModelViewDashboard;

	private modelView: azdata.ModelView;

	private overviewPage: BdcDashboardOverviewPage;

	constructor(private title: string, private model: BdcDashboardModel) {
		super();
		model.onDidUpdateBdcStatus(bdcStatus => this.eventuallyRunOnInitialized(() => this.handleBdcStatusUpdate(bdcStatus)));
		model.onBdcError(errorEvent => this.eventuallyRunOnInitialized(() => this.handleError(errorEvent)));
	}

	public async showDashboard(): Promise<void> {
		await this.createDashboard();
		await this.dashboard.open();
	}

	private async createDashboard(): Promise<void> {
		this.dashboard = azdata.window.createModelViewDashboard(this.title, { alwaysShowTabs: true });
		//this.dashboard = azdata.workspace.createModelViewEditor(this.title, { retainContextWhenHidden: true, supportsSave: false });
		this.dashboard.registerTabs(async (modelView: azdata.ModelView) => {
			this.modelView = modelView;

			this.overviewPage = new BdcDashboardOverviewPage(this.model, modelView);
			return [
				{
					title: loc.bdcOverview,
					id: 'overview-tab',
					//icon: IconPathHelper.postgres,
					content: this.overviewPage.container,
					toolbar: this.overviewPage.toolbarContainer
				}
			];
		});
		this.initialized = true;

		// Now that we've created the UI load data from the model in case it already had data
		this.handleBdcStatusUpdate(this.model.bdcStatus);
	}

	private handleBdcStatusUpdate(bdcStatus?: BdcStatusModel): void {
		if (!bdcStatus) {
			return;
		}
		this.updateServiceNavTabs(bdcStatus.services);
	}

	private handleError(errorEvent: BdcErrorEvent): void {
		if (errorEvent.errorType !== 'general') {
			return;
		}
		// We don't want to show an error for the connection dialog being
		// canceled since that's a normal case.
		if (!(errorEvent.error instanceof HdfsDialogCancelledError)) {
			showErrorMessage(errorEvent.error.message);
		}
	}

	/**
	 * Helper to update the navigation tabs for the services when we get a status update
	 */
	private updateServiceNavTabs(services?: ServiceStatusModel[]): void {
		if (services) {
			// Add a nav item for each service
			const servicePages = services.map(s => {
				//const existingTabPage = this.dashboardTabs.serviceTabGroup.tabs.find(tab => tab.id === s.serviceName);
				//if (existingTabPage) {
				// We've already created the tab and page for this service, just update the tab health status dot
				//existingTabPage.navTab.dot.value = getHealthStatusDot(s.healthStatus);
				//} else {
				// New service - create the tab
				const serviceStatusPage = new BdcServiceStatusPage(s.serviceName, this.model, this.modelView);
				return <azdata.Tab>{
					title: getServiceNameDisplayText(s.serviceName),
					id: s.serviceName,
					content: serviceStatusPage.container,
					toolbar: serviceStatusPage.toolbarContainer
				};
				//}
			});
			this.dashboard.updateTabs([
				{
					title: loc.bdcOverview,
					id: 'overview-tab',
					//icon: IconPathHelper.postgres,
					content: this.overviewPage.container,
					toolbar: this.overviewPage.toolbarContainer
				},
				{
					title: loc.clusterDetails,
					tabs: servicePages
				}]);
		}
	}
}
