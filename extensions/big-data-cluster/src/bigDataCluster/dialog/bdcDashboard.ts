/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { BdcDashboardModel } from './bdcDashboardModel';
import { IconPath } from '../constants';
import { BdcServiceStatusPage } from './bdcServiceStatusPage';
import { BdcDashboardOverviewPage } from './bdcDashboardOverviewPage';
import { EndpointModel, BdcStatusModel, ServiceStatusModel } from '../controller/apiGenerated';

const localize = nls.loadMessageBundle();

const navWidth = '175px';

export class BdcDashboard {

	private dashboard: azdata.workspace.ModelViewEditor;

	private initialized: boolean = false;
	private serviceTabsCreated: boolean = false;

	private modelView: azdata.ModelView;
	private mainAreaContainer: azdata.FlexContainer;
	private navContainer: azdata.FlexContainer;
	private currentPage: azdata.FlexContainer;

	constructor(private title: string, private model: BdcDashboardModel) {
		this.model.onDidUpdateEndpoints(endpoints => this.handleEndpointsUpdate(endpoints));
		this.model.onDidUpdateBdcStatus(bdcStatus => this.handleBdcStatusUpdate(bdcStatus));
	}

	public showDashboard(): void {
		this.createDashboard();
		this.dashboard.openEditor();
	}

	private createDashboard(): void {
		this.dashboard = azdata.workspace.createModelViewEditor(this.title, { retainContextWhenHidden: true, supportsSave: false });
		this.dashboard.registerContent(async (modelView: azdata.ModelView) => {
			this.modelView = modelView;
			const rootContainer = modelView.modelBuilder.flexContainer().withLayout(
				{
					flexFlow: 'column',
					width: '100%',
					height: '100%',
					alignItems: 'left'
				}).component();

			// ###########
			// # TOOLBAR #
			// ###########

			// Refresh button
			const refreshButton = modelView.modelBuilder.button()
				.withProperties({
					label: localize('bdc.dashboard.refreshButton', "Refresh"),
					iconPath: IconPath.refresh,
					height: '50'
				}).component();

			refreshButton.onDidClick(() => this.model.refresh());

			const toolbarContainer = modelView.modelBuilder.toolbarContainer().withToolbarItems([{ component: refreshButton }]).component();

			rootContainer.addItem(toolbarContainer, { flex: '0 0 auto' });

			// #############
			// # MAIN AREA #
			// #############

			this.mainAreaContainer = modelView.modelBuilder.flexContainer().withLayout(
				{
					flexFlow: 'row',
					width: '100%',
					height: '100%',
					alignItems: 'left'
				}).component();

			rootContainer.addItem(this.mainAreaContainer, { flex: '0 0 100%' });

			// #################
			// # NAV CONTAINER #
			// #################

			this.navContainer = modelView.modelBuilder.flexContainer().withLayout(
				{
					flexFlow: 'column',
					width: navWidth,
					height: '100%',
					alignItems: 'left'
				}
			).component();

			this.mainAreaContainer.addItem(this.navContainer, { flex: `0 0 ${navWidth}`, CSSStyles: { 'padding-left': '10px', 'border-right': 'solid 1px #ccc' } });

			// Overview nav item - this will be the initial page
			const overviewNavItem = modelView.modelBuilder.divContainer().withLayout({ width: navWidth, height: '30px' }).component();
			overviewNavItem.addItem(modelView.modelBuilder.text().withProperties({ value: localize('bdc.dashboard.overviewNavTitle', 'Big data cluster overview') }).component(), { CSSStyles: { 'user-select': 'text' } });
			const overviewPage = new BdcDashboardOverviewPage(this.model).create(modelView);
			this.currentPage = overviewPage;
			this.mainAreaContainer.addItem(overviewPage, { flex: '0 0 100%' });

			overviewNavItem.onDidClick(() => {
				this.mainAreaContainer.removeItem(this.currentPage);
				this.mainAreaContainer.addItem(overviewPage, { flex: '0 0 100%' });
				this.currentPage = overviewPage;
			});
			this.navContainer.addItem(overviewNavItem, { flex: '0 0 auto' });

			await modelView.initializeModel(rootContainer);

			this.initialized = true;

			// Now that we've created the UI load data from the model in case it already had data
			this.handleEndpointsUpdate(this.model.serviceEndpoints);
			this.handleBdcStatusUpdate(this.model.bdcStatus);
		});
	}

	private handleEndpointsUpdate(endpoints: EndpointModel[]): void {
		if (!this.initialized || !endpoints) {
			return;
		}
	}

	private handleBdcStatusUpdate(bdcStatus: BdcStatusModel): void {
		if (!this.initialized || !bdcStatus) {
			return;
		}

		this.createServiceNavTabs(bdcStatus.services);
	}

	/**
	 * Helper to create the navigation tabs for the services once the status has been loaded
	 */
	private createServiceNavTabs(services: ServiceStatusModel[]): void {
		if (this.initialized && !this.serviceTabsCreated && services) {
			// Add a nav item for each service
			services.forEach(s => {
				const navItem = createServiceNavTab(this.modelView.modelBuilder, getFriendlyServiceName(s.serviceName));
				const serviceStatusPage = new BdcServiceStatusPage(s.serviceName, this.model, this.modelView).container;
				navItem.onDidClick(() => {
					this.mainAreaContainer.removeItem(this.currentPage);
					this.mainAreaContainer.addItem(serviceStatusPage);
					this.currentPage = serviceStatusPage;
				});
				this.navContainer.addItem(navItem, { flex: '0 0 auto' });
			});
			this.serviceTabsCreated = true;
		}
	}
}

function createServiceNavTab(modelBuilder: azdata.ModelBuilder, serviceName: string): azdata.DivContainer {
	const navItem = modelBuilder.divContainer().withLayout({ width: navWidth, height: '30px' }).component();
	navItem.addItem(modelBuilder.text().withProperties({ value: serviceName }).component(), { CSSStyles: { 'user-select': 'text' } });
	return navItem;
}

function getFriendlyServiceName(serviceName: string): string {
	serviceName = serviceName || '';
	switch (serviceName.toLowerCase()) {
		case 'sql':
			return localize('bdc.dashboard.sql', "SQL Server");
		case 'hdfs':
			return localize('bdc.dashboard.hdfs', "HDFS");
		case 'spark':
			return localize('bdc.dashboard.spark', "Spark");
		case 'control':
			return localize('bdc.dashboard.control', "Control");
		case 'gateway':
			return localize('bdc.dashboard.gateway', "Gateway");
		case 'app':
			return localize('bdc.dashboard.app', "App");
		default:
			return serviceName;
	}
}
