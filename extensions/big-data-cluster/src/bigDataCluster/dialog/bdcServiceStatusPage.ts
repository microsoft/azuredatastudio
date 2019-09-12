/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import { BdcStatusModel, ResourceStatusModel } from '../controller/apiGenerated';
import { BdcDashboardResourceStatusPage } from './bdcDashboardResourceStatusPage';
import { BdcDashboardModel } from './bdcDashboardModel';
import { getHealthStatusDot } from '../utils';
import { cssStyles } from '../constants';

export class BdcServiceStatusPage {

	private initialized: boolean = false;
	private resourceTabsCreated: boolean = false;

	private currentTab: { div: azdata.DivContainer, text: azdata.TextComponent, index: number };
	private currentTabPage: azdata.FlexContainer;
	private rootContainer: azdata.FlexContainer;
	private resourceHeader: azdata.FlexContainer;

	constructor(private serviceName: string, private model: BdcDashboardModel, private modelView: azdata.ModelView) {
		this.model.onDidUpdateBdcStatus(bdcStatus => this.handleBdcStatusUpdate(bdcStatus));
		this.createPage();
	}

	public get container(): azdata.FlexContainer {
		return this.rootContainer;
	}

	private createPage(): void {
		this.rootContainer = this.modelView.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'column',
				width: '100%',
				height: '100%',
				alignItems: 'left'
			}).component();

		this.resourceHeader = this.modelView.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'row',
				width: '100%',
				height: '25px',
				alignItems: 'left'
			}
		).component();

		this.rootContainer.addItem(this.resourceHeader, { CSSStyles: { 'padding-top': '15px' } });

		this.initialized = true;

		this.handleBdcStatusUpdate(this.model.bdcStatus);
	}

	private handleBdcStatusUpdate(bdcStatus: BdcStatusModel): void {
		if (!this.initialized || !bdcStatus) {
			return;
		}

		const service = bdcStatus.services.find(s => s.serviceName === this.serviceName);
		this.createResourceNavTabs(service.resources);
	}

	private changeSelectedTabPage(newPage: azdata.FlexContainer): void {
		if (this.currentTabPage) {
			this.rootContainer.removeItem(this.currentTabPage);
		}
		this.rootContainer.addItem(newPage);
		this.currentTabPage = newPage;
	}

	/**
	 * Helper to create the navigation tabs for the resources
	 */
	private createResourceNavTabs(resources: ResourceStatusModel[]) {
		if (this.initialized && !this.resourceTabsCreated) {
			let tabIndex = 0;
			resources.forEach(resource => {
				const currentIndex = tabIndex++;
				const resourceHeaderTab = createResourceHeaderTab(this.modelView.modelBuilder, resource);
				const resourceStatusPage: azdata.FlexContainer = new BdcDashboardResourceStatusPage(this.model, this.modelView, this.serviceName, resource.resourceName).container;
				resourceHeaderTab.div.onDidClick(() => {
					// Don't need to do anything if this is already the currently selected tab
					if (this.currentTab.index === currentIndex) {
						return;
					}
					if (this.currentTab) {
						this.currentTab.text.updateCssStyles(cssStyles.unselectedResourceHeaderTab);
						this.resourceHeader.removeItem(this.currentTab.div);
						this.resourceHeader.insertItem(this.currentTab.div, this.currentTab.index, { flex: '0 0 auto', CSSStyles: cssStyles.unselectedTabDiv });
					}
					this.changeSelectedTabPage(resourceStatusPage);
					this.currentTab = { ...resourceHeaderTab, index: currentIndex };
					this.currentTab.text.updateCssStyles(cssStyles.selectedResourceHeaderTab);
					this.resourceHeader.removeItem(this.currentTab.div);
					this.resourceHeader.insertItem(this.currentTab.div, this.currentTab.index, { flex: '0 0 auto', CSSStyles: cssStyles.selectedTabDiv });
				});
				// Set initial page
				if (!this.currentTabPage) {
					this.changeSelectedTabPage(resourceStatusPage);
					this.currentTab = { ...resourceHeaderTab, index: currentIndex };
					this.currentTab.text.updateCssStyles(cssStyles.selectedResourceHeaderTab);
					this.resourceHeader.addItem(resourceHeaderTab.div, { flex: '0 0 auto', CSSStyles: cssStyles.selectedTabDiv });
				}
				else {
					resourceHeaderTab.text.updateCssStyles(cssStyles.unselectedResourceHeaderTab);
					this.resourceHeader.addItem(resourceHeaderTab.div, { flex: '0 0 auto', CSSStyles: cssStyles.unselectedTabDiv });
				}

			});
			this.resourceTabsCreated = true;
		}
	}
}

/**
 * Creates a single resource header tab
 * @param modelBuilder The ModelBuilder used to construct the object
 * @param title The text to display in the tab
 */
function createResourceHeaderTab(modelBuilder: azdata.ModelBuilder, resourceStatus: ResourceStatusModel): { div: azdata.DivContainer, text: azdata.TextComponent } {
	const resourceHeaderTab = modelBuilder.divContainer().withLayout({ width: '100px', height: '25px' }).withProperties({ CSSStyles: { 'cursor': 'pointer' } }).component();
	const innerContainer = modelBuilder.flexContainer().withLayout({ width: '100px', height: '25px', flexFlow: 'row' }).component();
	innerContainer.addItem(modelBuilder.text().withProperties({ value: getHealthStatusDot(resourceStatus.healthStatus), CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'none', 'color': 'red', 'font-size': '40px', 'width': '20px', 'text-align': 'right' } }).component(), { flex: '0 0 auto' });
	const resourceHeaderLabel = modelBuilder.text().withProperties({ value: resourceStatus.resourceName, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'text-align': 'left' } }).component();
	innerContainer.addItem(resourceHeaderLabel);
	resourceHeaderTab.addItem(innerContainer);
	return { div: resourceHeaderTab, text: resourceHeaderLabel };
}
