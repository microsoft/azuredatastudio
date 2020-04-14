/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { BdcStatusModel, ResourceStatusModel } from '../controller/apiGenerated';
import { BdcDashboardResourceStatusPage } from './bdcDashboardResourceStatusPage';
import { BdcDashboardModel } from './bdcDashboardModel';
import { BdcDashboardPage } from './bdcDashboardPage';

export class BdcServiceStatusPage extends BdcDashboardPage {

	private resourceTabs: Map<string, azdata.Tab> = new Map<string, azdata.Tab>();
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
		this.tabbedPanel = this.modelView.modelBuilder.tabbedPanel().component();

		this.initialized = true;

		this.handleBdcStatusUpdate(this.model.bdcStatus);
	}

	private handleBdcStatusUpdate(bdcStatus: BdcStatusModel): void {
		if (!bdcStatus) {
			return;
		}
		const service = bdcStatus.services.find(s => s.serviceName === this.serviceName);
		if (service && service.resources) {
			this.createResourceNavTabs(service.resources);
		}
	}

	/**
	 * Helper to create the navigation tabs for the resources
	 */
	private createResourceNavTabs(resources: ResourceStatusModel[]) {
		resources.forEach(resource => {
			const existingTab: azdata.Tab = this.resourceTabs.get(resource.resourceName);
			if (existingTab) {
				// We already created this tab so just update the status
				//existingTab.dot.value = getHealthStatusDot(resource.healthStatus);
			} else {
				this.resourceTabs.set(resource.resourceName, {
					title: resource.resourceName,
					id: resource.resourceName,
					content: new BdcDashboardResourceStatusPage(this.model, this.modelView, this.serviceName, resource.resourceName).container
				});
			}
		});
		this.tabbedPanel.updateTabs(Array.from(this.resourceTabs.values()));
	}
}
