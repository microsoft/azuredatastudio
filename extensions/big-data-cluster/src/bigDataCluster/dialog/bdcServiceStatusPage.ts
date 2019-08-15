/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { ServiceStatusModel, BdcStatusModel, ResourceStatusModel } from '../controller/apiGenerated';
import { BdcDashboardResourceStatusPage } from './bdcDashboardResourceStatusPage';
import { BdcDashboardModel } from './bdcDashboardModel';

const localize = nls.loadMessageBundle();

export class BdcServiceStatusPage {

	private initialized: boolean = false;
	private resourceTabsCreated: boolean = false;

	private currentTabPage: azdata.FlexContainer;
	private rootContainer: azdata.FlexContainer;

	constructor(private serviceName: string, private model: BdcDashboardModel) {
		this.model.onDidUpdateBdcStatus(bdcStatus => this.handleBdcStatusUpdate(bdcStatus));
	}

	public create(view: azdata.ModelView): azdata.FlexContainer {
		this.rootContainer = view.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'column',
				width: '100%',
				height: '100%',
				alignItems: 'left'
			}).component();

		const resourceHeader = view.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'row',
				width: '100%',
				height: '25px',
				alignItems: 'left'
			}
		).component();

		this.rootContainer.addItem(resourceHeader, { CSSStyles: { 'padding-top': '15px' } });

		this.initialized = true;

		return this.rootContainer;
	}

	private handleBdcStatusUpdate(bdcStatus: BdcStatusModel): void {
		if (!this.initialized) {
			return;
		}

		const service = bdcStatus.services.find(s => s.serviceName === this.serviceName);
		this.createServiceNavTabs(service.resources);
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
	private createServiceNavTabs(resources: ResourceStatusModel[]) {
		/*
		if (this.initialized && !this.serviceTabsCreated) {
			serviceStatus.resources.forEach(resource => {
				const resourceHeaderTab = createResourceHeaderTab(view, resource.resourceName);
				const resourceStatusPage: azdata.FlexContainer = new BdcDashboardResourceStatusPage(this.model, this.serviceName, resource.resourceName).create(view);
				resourceHeaderTab.onDidClick(() => {
					this.changeSelectedTabPage(resourceStatusPage);
				});
				if (!this.currentTabPage) {
					this.changeSelectedTabPage(resourceStatusPage);
				}
				resourceHeader.addItem(resourceHeaderTab, { flex: '0 0 auto', CSSStyles: { 'border-bottom': 'solid #ccc' } });
			});
			this.serviceTabsCreated = true;
		}
		*/
	}
}

function createResourceHeaderTab(view: azdata.ModelView, title: string): azdata.DivContainer {
	const resourceHeaderTab = view.modelBuilder.divContainer().withLayout({ width: '100px', height: '25px' }).withProperties({ CSSStyles: { 'text-align': 'center' } }).component();
	const resourceHeaderLabel = view.modelBuilder.text().withProperties({ value: title, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' } }).component();
	resourceHeaderTab.addItem(resourceHeaderLabel);
	return resourceHeaderTab;
}
