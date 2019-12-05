/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { BdcDashboardModel, getTroubleshootNotebookUrl, BdcErrorEvent } from './bdcDashboardModel';
import { IconPathHelper, cssStyles } from '../constants';
import { BdcServiceStatusPage } from './bdcServiceStatusPage';
import { BdcDashboardOverviewPage } from './bdcDashboardOverviewPage';
import { BdcStatusModel, ServiceStatusModel } from '../controller/apiGenerated';
import { getHealthStatusDot, getServiceNameDisplayText, showErrorMessage } from '../utils';
import { HdfsDialogCancelledError } from './hdfsDialogBase';
import { BdcDashboardPage } from './bdcDashboardPage';
import * as loc from '../localizedConstants';

const navWidth = '200px';

const selectedTabCss = { 'font-weight': 'bold' };
const unselectedTabCss = { 'font-weight': '' };

type NavTab = { serviceName: string, div: azdata.DivContainer, dot: azdata.TextComponent, text: azdata.TextComponent };

export class BdcDashboard extends BdcDashboardPage {

	private dashboard: azdata.workspace.ModelViewEditor;

	private modelView: azdata.ModelView;
	private mainAreaContainer: azdata.FlexContainer;
	private navContainer: azdata.FlexContainer;
	private overviewPage: BdcDashboardOverviewPage;

	private currentTab: NavTab;
	private currentPageContainer: azdata.FlexContainer;

	private refreshButton: azdata.ButtonComponent;

	private serviceTabPageMapping = new Map<string, { navTab: NavTab, servicePage: BdcServiceStatusPage }>();

	constructor(private title: string, private model: BdcDashboardModel) {
		super();
		this.model.onDidUpdateBdcStatus(bdcStatus => this.eventuallyRunOnInitialized(() => this.handleBdcStatusUpdate(bdcStatus)));
		this.model.onBdcError(errorEvent => this.eventuallyRunOnInitialized(() => this.handleError(errorEvent)));
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
					height: '100%'
				}).component();

			// ###########
			// # TOOLBAR #
			// ###########

			// Refresh button
			this.refreshButton = modelView.modelBuilder.button()
				.withProperties<azdata.ButtonProperties>({
					label: loc.refresh,
					iconPath: IconPathHelper.refresh
				}).component();

			this.refreshButton.onDidClick(async () => {
				this.overviewPage.onRefreshStarted();
				await this.doRefresh();
			});

			const openTroubleshootNotebookButton = modelView.modelBuilder.button()
				.withProperties<azdata.ButtonProperties>({
					label: loc.troubleshoot,
					iconPath: IconPathHelper.notebook
				}).component();

			openTroubleshootNotebookButton.onDidClick(() => {
				vscode.commands.executeCommand('books.sqlserver2019', getTroubleshootNotebookUrl(this.currentTab.serviceName));
			});

			const toolbarContainer = modelView.modelBuilder.toolbarContainer()
				.withToolbarItems(
					[
						{ component: this.refreshButton },
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
					height: '100%'
				}).component();

			rootContainer.addItem(this.mainAreaContainer, { flex: '0 0 100%' });

			// #################
			// # NAV CONTAINER #
			// #################

			this.navContainer = modelView.modelBuilder.flexContainer().withLayout(
				{
					flexFlow: 'column',
					width: navWidth,
					height: '100%'
				}
			).withProperties({
				ariaRole: 'tablist'
			}).component();

			this.mainAreaContainer.addItem(this.navContainer, { flex: `0 0 ${navWidth}`, CSSStyles: { 'padding': '0 20px 0 20px', 'border-right': 'solid 1px #ccc' } });

			// Overview nav item - this will be the initial page
			const overviewNavItemDiv = modelView.modelBuilder
				.divContainer()
				.withLayout({ width: navWidth, height: '30px' })
				.withProperties<azdata.DivContainerProperties>({
					clickable: true,
					ariaRole: 'tab',
					ariaSelected: true
				}).component();
			const overviewNavItemText = modelView.modelBuilder.text().withProperties({ value: loc.bdcOverview }).component();
			overviewNavItemText.updateCssStyles(selectedTabCss);
			overviewNavItemDiv.addItem(overviewNavItemText, { CSSStyles: { 'user-select': 'text' } });
			this.overviewPage = new BdcDashboardOverviewPage(this, this.model);
			const overviewContainer: azdata.FlexContainer = this.overviewPage.create(modelView);
			this.currentPageContainer = overviewContainer;
			this.currentTab = { serviceName: undefined, div: overviewNavItemDiv, dot: undefined, text: overviewNavItemText };
			this.mainAreaContainer.addItem(overviewContainer, { flex: '0 0 100%', CSSStyles: { 'margin': '0 20px 0 20px' } });

			overviewNavItemDiv.onDidClick(() => {
				if (this.currentTab) {
					this.currentTab.text.updateCssStyles(unselectedTabCss);
					this.currentTab.div.ariaSelected = false;
				}
				this.mainAreaContainer.removeItem(this.currentPageContainer);
				this.mainAreaContainer.addItem(overviewContainer, { flex: '0 0 100%', CSSStyles: { 'margin': '0 20px 0 20px' } });
				this.currentPageContainer = overviewContainer;
				this.currentTab = { serviceName: undefined, div: overviewNavItemDiv, dot: undefined, text: overviewNavItemText };
				this.currentTab.text.updateCssStyles(selectedTabCss);
				this.currentTab.div.ariaSelected = true;
			});
			this.navContainer.addItem(overviewNavItemDiv, { flex: '0 0 auto' });

			const clusterDetailsHeader = modelView.modelBuilder.text().withProperties({ value: loc.clusterDetails, CSSStyles: { 'margin-block-end': '0px' } }).component();
			this.navContainer.addItem(clusterDetailsHeader, { CSSStyles: { 'user-select': 'none', 'font-weight': 'bold', 'border-bottom': 'solid 1px #ccc', 'margin-bottom': '10px' } });

			await modelView.initializeModel(rootContainer);

			this.initialized = true;

			// Now that we've created the UI load data from the model in case it already had data
			this.handleBdcStatusUpdate(this.model.bdcStatus);
		});
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

	private async doRefresh(): Promise<void> {
		try {
			this.refreshButton.enabled = false;
			await this.model.refresh();
		} finally {
			this.refreshButton.enabled = true;
		}
	}

	/**
	 * Switches the current navigation tab to the one corresponding to the specified service
	 * @param serviceName The name of the service to switch to the tab of
	 */
	public switchToServiceTab(serviceName: string): void {
		const tabPageMapping = this.serviceTabPageMapping.get(serviceName);
		if (!tabPageMapping) {
			return;
		}
		if (this.currentTab) {
			this.currentTab.text.updateCssStyles(unselectedTabCss);
			this.currentTab.div.ariaSelected = false;
		}
		this.mainAreaContainer.removeItem(this.currentPageContainer);
		this.mainAreaContainer.addItem(tabPageMapping.servicePage.container, { CSSStyles: { 'margin': '0 20px 0 20px' } });
		this.currentPageContainer = tabPageMapping.servicePage.container;
		this.currentTab = tabPageMapping.navTab;
		this.currentTab.text.updateCssStyles(selectedTabCss);
		this.currentTab.div.ariaSelected = true;
	}

	/**
	 * Helper to update the navigation tabs for the services when we get a status update
	 */
	private updateServiceNavTabs(services?: ServiceStatusModel[]): void {
		if (services) {
			// Add a nav item for each service
			services.forEach(s => {
				const existingTabPage = this.serviceTabPageMapping.get(s.serviceName);
				if (existingTabPage) {
					// We've already created the tab and page for this service, just update the tab health status dot
					existingTabPage.navTab.dot.value = getHealthStatusDot(s.healthStatus);
				} else {
					// New service - create the page and tab
					const navItem = createServiceNavTab(this.modelView.modelBuilder, s);
					const serviceStatusPage = new BdcServiceStatusPage(s.serviceName, this.model, this.modelView);
					this.serviceTabPageMapping.set(s.serviceName, { navTab: navItem, servicePage: serviceStatusPage });
					navItem.div.onDidClick(() => {
						this.switchToServiceTab(s.serviceName);
					});
					this.navContainer.addItem(navItem.div, { flex: '0 0 auto' });
				}
			});
		}
	}
}

function createServiceNavTab(modelBuilder: azdata.ModelBuilder, serviceStatus: ServiceStatusModel): NavTab {
	const div = modelBuilder.divContainer()
		.withLayout({
			width: navWidth,
			height: '30px',
		})
		.withProperties<azdata.DivContainerProperties>({
			clickable: true,
			ariaRole: 'tab'
		}).component();
	const innerContainer = modelBuilder.flexContainer().withLayout({ width: navWidth, height: '30px', flexFlow: 'row' }).component();
	const dot = modelBuilder.text().withProperties({ value: getHealthStatusDot(serviceStatus.healthStatus), CSSStyles: { 'color': 'red', 'font-size': '40px', 'width': '20px', ...cssStyles.nonSelectableText } }).component();
	innerContainer.addItem(dot, { flex: '0 0 auto' });
	const text = modelBuilder.text().withProperties({ value: getServiceNameDisplayText(serviceStatus.serviceName), CSSStyles: { ...cssStyles.tabHeaderText } }).component();
	innerContainer.addItem(text, { flex: '0 0 auto' });
	div.addItem(innerContainer);
	return { serviceName: serviceStatus.serviceName, div: div, dot: dot, text: text };
}
