/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { BdcDashboardModel } from './bdcDashboardModel';
import { BdcStatusModel, InstanceStatusModel } from '../controller/apiGenerated';

const localize = nls.loadMessageBundle();

export interface IGroup {
	groupName: string;
	instances: IInstanceStatus[];
}

export interface IInstanceStatus {
	instanceName: string;
	state: string;
	healthStatus: string;
}

const metricsAndLogsInstanceNameCellWidth = '100px';
const metricsAndLogsMetricsCellWidth = '75px';
const metricsAndLogsLogsCellWidth = '75px';


export class BdcDashboardResourceStatusPage {

	private rootContainer: azdata.FlexContainer;
	private instanceHealthStatusRowsContainer: azdata.FlexContainer;
	private metricsAndLogsRowsContainer: azdata.FlexContainer;

	private initialized: boolean = false;

	constructor(private model: BdcDashboardModel, private modelView: azdata.ModelView, private serviceName: string, private resourceName: string) {
		this.model.onDidUpdateBdcStatus(bdcStatus => this.handleBdcStatusUpdate(bdcStatus));
		this.rootContainer = this.createContainer(modelView);
	}

	public get container(): azdata.FlexContainer {
		return this.rootContainer;
	}

	private createContainer(view: azdata.ModelView): azdata.FlexContainer {
		const rootContainer = view.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'column',
				width: '100%',
				height: '100%',
				alignItems: 'left'
			}).component();

		// ##############################
		// # INSTANCE HEALTH AND STATUS #
		// ##############################

		// Instance Health Label label
		const propertiesLabel = view.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.healthStatusDetailsHeader', "Health Status Details"), CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '10px' } })
			.component();
		rootContainer.addItem(propertiesLabel, { CSSStyles: { 'margin-top': '15px', 'font-size': '20px', 'font-weight': 'bold', 'padding-left': '10px' } });

		// Header row
		const instanceHealthStatusHeaderRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
		const instanceHealthAndStatusNameHeaderRow = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.metricsAndLogsHeader', "Metrics and Logs") }).component();
		instanceHealthStatusHeaderRow.addItem(instanceHealthAndStatusNameHeaderRow, { CSSStyles: { 'width': metricsAndLogsInstanceNameCellWidth, 'min-width': metricsAndLogsInstanceNameCellWidth, 'font-weight': 'bold', 'user-select': 'text' } });
		const instanceHealthAndStatusStateRow = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.stateHeader', "State") }).component();
		instanceHealthStatusHeaderRow.addItem(instanceHealthAndStatusStateRow, { CSSStyles: { 'width': metricsAndLogsMetricsCellWidth, 'min-width': metricsAndLogsMetricsCellWidth, 'font-weight': 'bold', 'user-select': 'text' } });
		const instanceHealthAndStatusHealthStatusRow = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.healthStatusHeader', "Health Status") }).component();
		instanceHealthStatusHeaderRow.addItem(instanceHealthAndStatusHealthStatusRow, { CSSStyles: { 'width': metricsAndLogsLogsCellWidth, 'min-width': metricsAndLogsLogsCellWidth, 'font-weight': 'bold', 'user-select': 'text' } });
		rootContainer.addItem(instanceHealthStatusHeaderRow, { flex: '0 0 auto', CSSStyles: { 'padding-left': '10px', 'box-sizing': 'border-box', 'user-select': 'text' } });

		this.instanceHealthStatusRowsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		rootContainer.addItem(this.instanceHealthStatusRowsContainer, { flex: '0 0 auto' });

		// ####################
		// # METRICS AND LOGS #
		// ####################

		// Title label
		const endpointsLabel = view.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.metricsAndLogsLabel', "Metrics and Logs"), CSSStyles: { 'margin-block-start': '20px', 'margin-block-end': '0px' } })
			.component();
		rootContainer.addItem(endpointsLabel, { CSSStyles: { 'font-size': '20px', 'font-weight': 'bold', 'padding-left': '10px' } });

		// Header row
		const metricsAndLogsHeaderRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
		const nameCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.metricsAndLogsHeader', "Metrics and Logs") }).component();
		metricsAndLogsHeaderRow.addItem(nameCell, { CSSStyles: { 'width': metricsAndLogsInstanceNameCellWidth, 'min-width': metricsAndLogsInstanceNameCellWidth, 'font-weight': 'bold', 'user-select': 'text' } });
		const metricsCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.metricsHeader', "Metrics") }).component();
		metricsAndLogsHeaderRow.addItem(metricsCell, { CSSStyles: { 'width': metricsAndLogsMetricsCellWidth, 'min-width': metricsAndLogsMetricsCellWidth, 'font-weight': 'bold', 'user-select': 'text' } });
		const healthStatusCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.logsHeader', "Logs") }).component();
		metricsAndLogsHeaderRow.addItem(healthStatusCell, { CSSStyles: { 'width': metricsAndLogsLogsCellWidth, 'min-width': metricsAndLogsLogsCellWidth, 'font-weight': 'bold', 'user-select': 'text' } });
		rootContainer.addItem(metricsAndLogsHeaderRow, { flex: '0 0 auto', CSSStyles: { 'padding-left': '10px', 'box-sizing': 'border-box', 'user-select': 'text' } });

		this.metricsAndLogsRowsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		rootContainer.addItem(this.metricsAndLogsRowsContainer, { flex: '0 0 auto' });

		this.initialized = true;
		this.handleBdcStatusUpdate(this.model.bdcStatus);

		return rootContainer;
	}

	private handleBdcStatusUpdate(bdcStatus: BdcStatusModel): void {
		const service = bdcStatus.services ? bdcStatus.services.find(s => s.serviceName === this.serviceName) : undefined;
		const resource = service ? service.resources.find(r => r.resourceName === this.resourceName) : undefined;

		if (!this.initialized || !resource) {
			return;
		}

		this.instanceHealthStatusRowsContainer.clearItems();
		this.metricsAndLogsRowsContainer.clearItems();

		resource.instances.forEach(i => {
			const instanceHealthStatusRow = createInstanceHealthStatusRow(this.modelView.modelBuilder, i);
			this.instanceHealthStatusRowsContainer.addItem(instanceHealthStatusRow, { CSSStyles: { 'padding-left': '10px', 'border-top': 'solid 1px #ccc', 'box-sizing': 'border-box', 'user-select': 'text' } });

			let metricsAndLogsRow = createMetricsAndLogsRow(this.modelView.modelBuilder, i);
			this.metricsAndLogsRowsContainer.addItem(metricsAndLogsRow, { CSSStyles: { 'padding-left': '10px', 'border-top': 'solid 1px #ccc', 'box-sizing': 'border-box', 'user-select': 'text' } });
		});
	}
}

/**
 * Creates a row with the name, state and health status for a particular instance on this resource
 *
 * @param modelBuilder The builder used to create the component
 * @param instanceStatus The status object for the instance this row is for
 */
function createInstanceHealthStatusRow(modelBuilder: azdata.ModelBuilder, instanceStatus: InstanceStatusModel): azdata.FlexContainer {
	const instanceHealthStatusRow = modelBuilder.flexContainer().withLayout({ flexFlow: 'row', alignItems: 'center', height: '30px' }).component();
	const nameCell = modelBuilder.text().withProperties({ value: instanceStatus.instanceName, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' } }).component();
	instanceHealthStatusRow.addItem(nameCell, { CSSStyles: { 'width': '100px', 'min-width': '100px', 'user-select': 'text', 'margin-block-start': '0px', 'margin-block-end': '0px' } });
	const stateCell = modelBuilder.text().withProperties({ value: instanceStatus.state, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'text' } }).component();
	instanceHealthStatusRow.addItem(stateCell, { CSSStyles: { 'width': '75px', 'min-width': '75px' } });
	const healthStatusCell = modelBuilder.text().withProperties({ value: instanceStatus.healthStatus, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'text' } }).component();
	instanceHealthStatusRow.addItem(healthStatusCell, { CSSStyles: { 'width': '75px', 'min-width': '75px' } });

	return instanceHealthStatusRow;
}

/**
 * Creates a row with the name, link to the metrics and a link to the logs for a particular instance on this resource
 * @param modelBuilder The builder used to create the component
 * @param instanceStatus The status object for the instance this row is for
 */
function createMetricsAndLogsRow(modelBuilder: azdata.ModelBuilder, instanceStatus: InstanceStatusModel): azdata.FlexContainer {
	const metricsAndLogsRow = modelBuilder.flexContainer().withLayout({ flexFlow: 'row', alignItems: 'center', height: '30px' }).component();
	const nameCell = modelBuilder.text().withProperties({ value: instanceStatus.instanceName, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' } }).component();
	metricsAndLogsRow.addItem(nameCell, { CSSStyles: { 'width': '100px', 'min-width': '100px', 'user-select': 'text', 'margin-block-start': '0px', 'margin-block-end': '0px' } });
	const metricsCell = modelBuilder.hyperlink().withProperties({ label: localize('bdc.dashboard.viewHyperlink', "View"), url: instanceStatus.dashboards.nodeMetricsUrl, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'text' } }).component();
	metricsAndLogsRow.addItem(metricsCell, { CSSStyles: { 'width': '75px', 'min-width': '75px' } });
	const logsCell = modelBuilder.hyperlink().withProperties({ label: localize('bdc.dashboard.viewHyperlink', "View"), url: instanceStatus.dashboards.logsUrl, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'text' } }).component();
	metricsAndLogsRow.addItem(logsCell, { CSSStyles: { 'width': '75px', 'min-width': '75px' } });

	return metricsAndLogsRow;
}

