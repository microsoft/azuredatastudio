/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { BdcDashboardModel } from './bdcDashboardModel';
import { IconPathHelper } from '../constants';
import { BdcServiceStatusPage } from './bdcServiceStatusPage';
import { BdcDashboardOverviewPage } from './bdcDashboardOverviewPage';
import { BdcStatusModel, ServiceStatusModel } from '../controller/apiGenerated';
import { getHealthStatusDot, getServiceNameDisplayText } from '../utils';

const localize = nls.loadMessageBundle();

const navWidth = '200px';

const selectedTabCss = { 'font-weight': 'bold' };
const unselectedTabCss = { 'font-weight': '' };

type NavTab = { div: azdata.DivContainer, dot: azdata.TextComponent, text: azdata.TextComponent };

export class BdcDashboard {

	private dashboard: azdata.workspace.ModelViewEditor;

	private initialized: boolean = false;
	private serviceTabsCreated: boolean = false;

	private modelView: azdata.ModelView;
	private mainAreaContainer: azdata.FlexContainer;
	private navContainer: azdata.FlexContainer;

	private currentTab: NavTab;
	private currentPage: azdata.FlexContainer;

	private serviceTabPageMapping: { [key: string]: { navTab: NavTab, servicePage: azdata.FlexContainer } } = {};

	constructor(private title: string, private model: BdcDashboardModel) {
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
					iconPath: IconPathHelper.refresh,
					height: '50px'
				}).component();

			refreshButton.onDidClick(() => this.model.refresh());

			const openTroubleshootNotebookButton = modelView.modelBuilder.button()
				.withProperties({
					label: localize('bdc.dashboard.troubleshootButton', "Troubleshoot"),
					iconPath: IconPathHelper.notebook,
					height: '50px'
				}).component();

			openTroubleshootNotebookButton.onDidClick(() => {
				vscode.commands.executeCommand('books.sqlserver2019');
			});

			const toolbarContainer = modelView.modelBuilder.toolbarContainer()
				.withToolbarItems(
					[
						{ component: refreshButton },
						{ component: openTroubleshootNotebookButton }
					]
				).component();

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

			this.mainAreaContainer.addItem(this.navContainer, { flex: `0 0 ${navWidth}`, CSSStyles: { 'padding': '0 20px 0 20px', 'border-right': 'solid 1px #ccc' } });

			// Overview nav item - this will be the initial page
			const overviewNavItemDiv = modelView.modelBuilder.divContainer().withLayout({ width: navWidth, height: '30px' }).withProperties({ CSSStyles: { 'cursor': 'pointer' } }).component();
			const overviewNavItemText = modelView.modelBuilder.text().withProperties({ value: localize('bdc.dashboard.overviewNavTitle', 'Big data cluster overview') }).component();
			overviewNavItemText.updateCssStyles(selectedTabCss);
			overviewNavItemDiv.addItem(overviewNavItemText, { CSSStyles: { 'user-select': 'text' } });
			const overviewPage = new BdcDashboardOverviewPage(this, this.model).create(modelView);
			this.currentPage = overviewPage;
			this.currentTab = { div: overviewNavItemDiv, dot: undefined, text: overviewNavItemText };
			this.mainAreaContainer.addItem(overviewPage, { flex: '0 0 100%', CSSStyles: { 'margin': '0 20px 0 20px' } });

			overviewNavItemDiv.onDidClick(() => {
				if (this.currentTab) {
					this.currentTab.text.updateCssStyles(unselectedTabCss);
				}
				this.mainAreaContainer.removeItem(this.currentPage);
				this.mainAreaContainer.addItem(overviewPage, { flex: '0 0 100%', CSSStyles: { 'margin': '0 20px 0 20px' } });
				this.currentPage = overviewPage;
				this.currentTab = { div: overviewNavItemDiv, dot: undefined, text: overviewNavItemText };
				this.currentTab.text.updateCssStyles(selectedTabCss);
			});
			this.navContainer.addItem(overviewNavItemDiv, { flex: '0 0 auto' });

			const clusterDetailsHeader = modelView.modelBuilder.text().withProperties({ value: localize('bdc.dashboard.clusterDetails', 'Cluster Details'), CSSStyles: { 'margin-block-end': '0px' } }).component();
			this.navContainer.addItem(clusterDetailsHeader, { CSSStyles: { 'user-select': 'none', 'font-weight': 'bold', 'border-bottom': 'solid 1px #ccc', 'margin-bottom': '10px' } });

			await modelView.initializeModel(rootContainer);

			this.initialized = true;

			// Now that we've created the UI load data from the model in case it already had data
			this.handleBdcStatusUpdate(this.model.bdcStatus);
		});
	}

	private handleBdcStatusUpdate(bdcStatus: BdcStatusModel): void {
		if (!this.initialized || !bdcStatus) {
			return;
		}

		this.createServiceNavTabs(bdcStatus.services);
	}

	/**
	 * Switches the current navigation tab to the one corresponding to the specified service
	 * @param serviceName The name of the service to switch to the tab of
	 */
	public switchToServiceTab(serviceName: string): void {
		const tabPageMapping = this.serviceTabPageMapping[serviceName];
		if (!tabPageMapping) {
			return;
		}
		if (this.currentTab) {
			this.currentTab.text.updateCssStyles(unselectedTabCss);
		}
		this.mainAreaContainer.removeItem(this.currentPage);
		this.mainAreaContainer.addItem(tabPageMapping.servicePage, { CSSStyles: { 'margin': '0 20px 0 20px' } });
		this.currentPage = tabPageMapping.servicePage;
		this.currentTab = tabPageMapping.navTab;
		this.currentTab.text.updateCssStyles(selectedTabCss);
	}

	/**
	 * Helper to create the navigation tabs for the services once the status has been loaded
	 */
	private createServiceNavTabs(services: ServiceStatusModel[]): void {
		if (this.initialized && !this.serviceTabsCreated && services) {
			// Add a nav item for each service
			services.forEach(s => {
				const navItem = createServiceNavTab(this.modelView.modelBuilder, s);
				const serviceStatusPage = new BdcServiceStatusPage(s.serviceName, this.model, this.modelView).container;
				this.serviceTabPageMapping[s.serviceName] = { navTab: navItem, servicePage: serviceStatusPage };
				navItem.div.onDidClick(() => {
					this.switchToServiceTab(s.serviceName);
				});
				this.navContainer.addItem(navItem.div, { flex: '0 0 auto' });
			});
			this.serviceTabsCreated = true;
		}
	}
}

function createServiceNavTab(modelBuilder: azdata.ModelBuilder, serviceStatus: ServiceStatusModel): NavTab {
	const div = modelBuilder.divContainer().withLayout({ width: navWidth, height: '30px' }).withProperties({ CSSStyles: { 'cursor': 'pointer' } }).component();
	const innerContainer = modelBuilder.flexContainer().withLayout({ width: navWidth, height: '30px', flexFlow: 'row' }).component();
	const dot = modelBuilder.text().withProperties({ value: getHealthStatusDot(serviceStatus.healthStatus), CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'none', 'color': 'red', 'font-size': '40px', 'width': '20px' } }).component();
	innerContainer.addItem(dot, { flex: '0 0 auto' });
	const text = modelBuilder.text().withProperties({ value: getServiceNameDisplayText(serviceStatus.serviceName), CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'none' } }).component();
	innerContainer.addItem(text, { flex: '0 0 auto' });
	div.addItem(innerContainer);
	return { div: div, dot: dot, text: text };
}
