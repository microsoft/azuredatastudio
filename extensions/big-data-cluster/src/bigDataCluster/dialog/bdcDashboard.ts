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
import { IconPathHelper } from '../constants';

export class BdcDashboard extends InitializingComponent {

	private dashboard: azdata.window.ModelViewDashboard;

	private modelView: azdata.ModelView;

	private createdServicePages: Map<string, azdata.Tab> = new Map<string, azdata.Tab>();

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
		this.dashboard.registerTabs(async (modelView: azdata.ModelView) => {
			this.modelView = modelView;

			const overviewPage = new BdcDashboardOverviewPage(this.model, modelView);
			return [
				{
					title: loc.bdcOverview,
					id: 'overview-tab',
					//icon: IconPathHelper.postgres,
					content: overviewPage.container,
					toolbar: overviewPage.toolbarContainer
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
		this.createServicePages(bdcStatus.services);
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
	 * Helper to create service status pages for new services
	 */
	private createServicePages(services?: ServiceStatusModel[]): void {
		if (services) {
			const newTabs: azdata.Tab[] = [];
			let i = 0;
			// Create a service page for each new service. We currently don't support services being removed.
			services.forEach(s => {
				const existingPage = this.createdServicePages.get(s.serviceName);
				if (existingPage) {
					existingPage.icon = existingPage.icon === IconPathHelper.status_circle_red ? IconPathHelper.status_circle_blank : IconPathHelper.status_circle_red;
				} else {
					const serviceStatusPage = new BdcServiceStatusPage(s.serviceName, this.model, this.modelView);
					const newTab = <azdata.Tab>{
						title: getServiceNameDisplayText(s.serviceName),
						id: s.serviceName,
						icon: i++ % 2 === 0 ? IconPathHelper.status_circle_red : IconPathHelper.status_circle_blank,
						content: serviceStatusPage.container,
						toolbar: serviceStatusPage.toolbarContainer
					};
					this.createdServicePages.set(s.serviceName, newTab);
					newTabs.push(newTab);
				}
			});
			this.dashboard.addTabs([
				{
					title: loc.clusterDetails,
					tabs: newTabs
				}]);
		}
	}
}
