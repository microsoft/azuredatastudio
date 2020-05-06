/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { BdcStatusModel, ResourceStatusModel } from '../controller/apiGenerated';
import { BdcDashboardResourceStatusPage } from './bdcDashboardResourceStatusPage';
import { BdcDashboardModel } from './bdcDashboardModel';
import { BdcDashboardPage } from './bdcDashboardPage';
import { IconPathHelper } from '../constants';

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
		// Initialize our set of tab pages
		this.handleBdcStatusUpdate(this.model.bdcStatus);

		this.tabbedPanel = this.modelView.modelBuilder.tabbedPanel()
			.withTabs(Array.from(this.createdResourceTabs.values()))
			.withLayout({ showIcon: true }).component();

		this.initialized = true;
	}

	private handleBdcStatusUpdate(bdcStatus: BdcStatusModel): void {
		if (!bdcStatus) {
			return;
		}
		const service = bdcStatus.services.find(s => s.serviceName === this.serviceName);
		if (service && service.resources) {
			this.createAndUpdateResourcePages(service.resources);
		}
	}

	/**
	 * Helper to create the resource status page
	 */
	private createAndUpdateResourcePages(resources: ResourceStatusModel[]): azdata.Tab[] {
		const newTabs: azdata.Tab[] = [];
		let i = 0;
		resources.forEach(resource => {
			const existingTab = this.createdResourceTabs.get(resource.resourceName);
			if (existingTab) {
				existingTab.icon = existingTab.icon === IconPathHelper.status_circle_red ? IconPathHelper.status_circle_blank : IconPathHelper.status_circle_red;
			} else {
				const resourceStatusPage = new BdcDashboardResourceStatusPage(this.model, this.modelView, this.serviceName, resource.resourceName);
				const newTab: azdata.Tab = {
					title: resource.resourceName,
					id: resource.resourceName,
					content: resourceStatusPage.container,
					icon: i++ % 2 === 0 ? IconPathHelper.status_circle_red : IconPathHelper.status_circle_blank
				};
				this.createdResourceTabs.set(resource.resourceName, newTab);

				newTabs.push();
			}
		});
		return newTabs;
	}
}
