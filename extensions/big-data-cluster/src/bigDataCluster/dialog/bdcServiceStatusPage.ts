/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import { BdcStatusModel, ResourceStatusModel } from '../controller/apiGenerated';
import { BdcDashboardResourceStatusPage } from './bdcDashboardResourceStatusPage';
import { BdcDashboardModel } from './bdcDashboardModel';

export class BdcServiceStatusPage {

	private initialized: boolean = false;
	private resourceTabsCreated: boolean = false;

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
			resources.forEach(resource => {
				const resourceHeaderTab = createResourceHeaderTab(this.modelView, resource.resourceName);
				const resourceStatusPage: azdata.FlexContainer = new BdcDashboardResourceStatusPage(this.model, this.modelView, this.serviceName, resource.resourceName).container;
				resourceHeaderTab.onDidClick(() => {
					this.changeSelectedTabPage(resourceStatusPage);
				});
				if (!this.currentTabPage) {
					this.changeSelectedTabPage(resourceStatusPage);
				}
				this.resourceHeader.addItem(resourceHeaderTab, { flex: '0 0 auto', CSSStyles: { 'border-bottom': 'solid #ccc' } });
			});
			this.resourceTabsCreated = true;
		}
	}
}

/**
 * Creates a single resource header tab
 * @param view TheModelView used to construct the object
 * @param title The text to display in the tab
 */
function createResourceHeaderTab(view: azdata.ModelView, title: string): azdata.DivContainer {
	const resourceHeaderTab = view.modelBuilder.divContainer().withLayout({ width: '100px', height: '25px' }).withProperties({ CSSStyles: { 'text-align': 'center' } }).component();
	const resourceHeaderLabel = view.modelBuilder.text().withProperties({ value: title, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' } }).component();
	resourceHeaderTab.addItem(resourceHeaderLabel);
	return resourceHeaderTab;
}
