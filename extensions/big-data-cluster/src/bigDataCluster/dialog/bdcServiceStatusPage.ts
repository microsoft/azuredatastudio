/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { BdcStatusModel, ResourceStatusModel } from '../controller/apiGenerated';
import { BdcDashboardResourceStatusPage } from './bdcDashboardResourceStatusPage';
import { BdcDashboardModel } from './bdcDashboardModel';
import { BdcDashboardPage } from './bdcDashboardPage';
import { getHealthStatusDotIcon } from '../utils';

export class BdcServiceStatusPage extends BdcDashboardPage {

	private createdResourceTabs: Map<string, azdata.Tab> = new Map<string, azdata.Tab>();
	private tabbedPanel: azdata.TabbedPanelComponent;

	constructor(serviceName: string, model: BdcDashboardModel, modelView: azdata.ModelView) {
		super(model, modelView, serviceName);
		this.model.onDidUpdateBdcStatus(bdcStatus => this.eventuallyRunOnInitialized(() => this.handleBdcStatusUpdate(bdcStatus)));
	}

	public get container(): azdata.TabbedPanelComponent {
		// Lazily create the container only when needed
		if (!this.tabbedPanel) {
			this.createPage();
		}
		return this.tabbedPanel;
	}

	private createPage(): void {
		this.tabbedPanel = this.modelView.modelBuilder.tabbedPanel()
			.withLayout({ showIcon: true, alwaysShowTabs: true }).component();

		// Initialize our set of tab pages
		this.handleBdcStatusUpdate(this.model.bdcStatus);

		this.initialized = true;
	}

	private handleBdcStatusUpdate(bdcStatus: BdcStatusModel): void {
		if (!bdcStatus) {
			return;
		}
		const service = bdcStatus.services.find(s => s.serviceName === this.serviceName);
		if (service && service.resources) {
			this.updateResourcePages(service.resources);
		}
	}

	/**
	 * Update the resource tab pages, creating any new ones as necessary
	 */
	private updateResourcePages(resources: ResourceStatusModel[]): void {
		resources.forEach(resource => {
			const existingTab = this.createdResourceTabs.get(resource.resourceName);
			if (existingTab) {
				existingTab.icon = getHealthStatusDotIcon(resource.healthStatus);
			} else {
				const resourceStatusPage = new BdcDashboardResourceStatusPage(this.model, this.modelView, this.serviceName, resource.resourceName);
				const newTab: azdata.Tab = {
					title: resource.resourceName,
					id: resource.resourceName,
					content: resourceStatusPage.container,
					icon: getHealthStatusDotIcon(resource.healthStatus)
				};
				this.createdResourceTabs.set(resource.resourceName, newTab);
			}
		});
		this.tabbedPanel.updateTabs(Array.from(this.createdResourceTabs.values()));
	}
}
