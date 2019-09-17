/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { BdcDashboardModel } from './bdcDashboardModel';
import { BdcStatusModel, InstanceStatusModel } from '../controller/apiGenerated';
import { getHealthStatusDisplayText, getHealthStatusIcon, getStateDisplayText } from '../utils';
import { cssStyles } from '../constants';

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

const healthAndStatusIconColumnWidth = 25;
const healthAndStatusInstanceNameColumnWidth = 100;
const healthAndStatusStateColumnWidth = 75;
const healthAndStatusHealthColumnWidth = 75;

const metricsAndLogsInstanceNameColumnWidth = 125;
const metricsAndLogsMetricsColumnWidth = 75;
const metricsAndLogsLogsColumnWidth = 75;


export class BdcDashboardResourceStatusPage {

	private rootContainer: azdata.FlexContainer;
	private instanceHealthStatusRowsContainer: azdata.FlexContainer;
	private metricsAndLogsRowsContainer: azdata.FlexContainer;
	private lastUpdatedLabel: azdata.TextComponent;
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

		const healthStatusHeaderContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', height: '20px' }).component();
		rootContainer.addItem(healthStatusHeaderContainer, { CSSStyles: { 'padding-left': '10px', 'padding-top': '15px' } });

		// Header label
		const healthStatusHeaderLabel = view.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: localize('bdc.dashboard.healthStatusDetailsHeader', "Health Status Details"),
				CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '10px' }
			})
			.component();

		healthStatusHeaderContainer.addItem(healthStatusHeaderLabel, { CSSStyles: { ...cssStyles.title } });

		// Last updated label
		this.lastUpdatedLabel = view.modelBuilder.text()
			.withProperties({
				value: localize('bdc.dashboard.lastUpdated', "Last Updated : {0}", '-'),
				CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'color': '#595959' }
			}).component();

		healthStatusHeaderContainer.addItem(this.lastUpdatedLabel, { CSSStyles: { 'margin-left': '45px' } });

		// Header row
		const instanceHealthStatusHeaderRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
		const instanceHealthAndStatusNameHeader = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.instanceHeader', "Instance") }).component();
		// Instance name cell covers both icon + service name so width stretches both cells
		instanceHealthStatusHeaderRow.addItem(instanceHealthAndStatusNameHeader, { CSSStyles: { 'width': `${healthAndStatusIconColumnWidth + healthAndStatusInstanceNameColumnWidth}px`, 'min-width': `${healthAndStatusIconColumnWidth + healthAndStatusInstanceNameColumnWidth}px`, ...cssStyles.tableHeader } });
		const instanceHealthAndStatusState = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.stateHeader', "State") }).component();
		instanceHealthStatusHeaderRow.addItem(instanceHealthAndStatusState, { CSSStyles: { 'width': `${healthAndStatusStateColumnWidth}px`, 'min-width': `${healthAndStatusStateColumnWidth}px`, ...cssStyles.tableHeader } });
		const instanceHealthAndStatusHealthStatus = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.healthStatusHeader', "Health Status") }).component();
		instanceHealthStatusHeaderRow.addItem(instanceHealthAndStatusHealthStatus, { CSSStyles: { 'width': `${healthAndStatusHealthColumnWidth}px`, 'min-width': `${healthAndStatusHealthColumnWidth}px`, ...cssStyles.tableHeader } });
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
		rootContainer.addItem(endpointsLabel, { CSSStyles: { 'padding-left': '10px', ...cssStyles.title } });

		// Header row
		const metricsAndLogsHeaderRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
		const nameCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.instanceHeader', "Instance") }).component();
		metricsAndLogsHeaderRow.addItem(nameCell, { CSSStyles: { 'width': `${metricsAndLogsInstanceNameColumnWidth}px`, 'min-width': `${metricsAndLogsInstanceNameColumnWidth}px`, ...cssStyles.tableHeader } });
		const metricsCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.metricsHeader', "Metrics") }).component();
		metricsAndLogsHeaderRow.addItem(metricsCell, { CSSStyles: { 'width': `${metricsAndLogsMetricsColumnWidth}px`, 'min-width': `${metricsAndLogsMetricsColumnWidth}px`, ...cssStyles.tableHeader } });
		const healthStatusCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.logsHeader', "Logs") }).component();
		metricsAndLogsHeaderRow.addItem(healthStatusCell, { CSSStyles: { 'width': `${metricsAndLogsLogsColumnWidth}px`, 'min-width': `${metricsAndLogsLogsColumnWidth}px`, ...cssStyles.tableHeader } });
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

		this.lastUpdatedLabel.value =
			localize('bdc.dashboard.lastUpdated', "Last Updated : {0}",
				this.model.bdcStatusLastUpdated ?
					`${this.model.bdcStatusLastUpdated.toLocaleDateString()} ${this.model.bdcStatusLastUpdated.toLocaleTimeString()}`
					: '-');

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
	const statusIconCell = modelBuilder.text()
		.withProperties<azdata.TextComponentProperties>({
			value: getHealthStatusIcon(instanceStatus.healthStatus),
			CSSStyles: { 'user-select': 'none' }
		}).component();
	instanceHealthStatusRow.addItem(statusIconCell, { CSSStyles: { 'width': `${healthAndStatusIconColumnWidth}px`, 'min-width': `${healthAndStatusIconColumnWidth}px` } });
	const nameCell = modelBuilder.text().withProperties({ value: instanceStatus.instanceName, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' } }).component();
	instanceHealthStatusRow.addItem(nameCell, { CSSStyles: { 'width': `${healthAndStatusInstanceNameColumnWidth}px`, 'min-width': `${healthAndStatusInstanceNameColumnWidth}px`, 'user-select': 'text', 'margin-block-start': '0px', 'margin-block-end': '0px' } });
	const stateCell = modelBuilder.text().withProperties({ value: getStateDisplayText(instanceStatus.state), CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'text' } }).component();
	instanceHealthStatusRow.addItem(stateCell, { CSSStyles: { 'width': `${healthAndStatusStateColumnWidth}px`, 'min-width': `${healthAndStatusStateColumnWidth}px` } });
	const healthStatusCell = modelBuilder.text().withProperties({ value: getHealthStatusDisplayText(instanceStatus.healthStatus), CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'text' } }).component();
	instanceHealthStatusRow.addItem(healthStatusCell, { CSSStyles: { 'width': `${healthAndStatusHealthColumnWidth}px`, 'min-width': `${healthAndStatusHealthColumnWidth}px` } });

	if (instanceStatus.healthStatus !== 'healthy' && instanceStatus.details && instanceStatus.details.length > 0) {
		const viewDetailsButton = modelBuilder.button().withProperties<azdata.ButtonProperties>({ label: localize('bdc.dashboard.viewDetails', "View Details") }).component();
		viewDetailsButton.onDidClick(() => {
			vscode.window.showErrorMessage(instanceStatus.details);
		});
		instanceHealthStatusRow.addItem(viewDetailsButton, { flex: '0 0 auto' });
	}
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
	metricsAndLogsRow.addItem(nameCell, { CSSStyles: { 'width': `${metricsAndLogsInstanceNameColumnWidth}px`, 'min-width': `${metricsAndLogsInstanceNameColumnWidth}px`, 'user-select': 'text', 'margin-block-start': '0px', 'margin-block-end': '0px' } });
	const metricsCell = modelBuilder.hyperlink().withProperties({ label: localize('bdc.dashboard.viewHyperlink', "View"), url: instanceStatus.dashboards.nodeMetricsUrl, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'text', 'color': '#0078d4', 'text-decoration': 'underline' } }).component();
	metricsAndLogsRow.addItem(metricsCell, { CSSStyles: { 'width': `${metricsAndLogsMetricsColumnWidth}px`, 'min-width': `${metricsAndLogsMetricsColumnWidth}px` } });
	const logsCell = modelBuilder.hyperlink().withProperties({ label: localize('bdc.dashboard.viewHyperlink', "View"), url: instanceStatus.dashboards.logsUrl, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'text', 'color': '#0078d4', 'text-decoration': 'underline' } }).component();
	metricsAndLogsRow.addItem(logsCell, { CSSStyles: { 'width': `${metricsAndLogsLogsColumnWidth}px`, 'min-width': `${metricsAndLogsLogsColumnWidth}px` } });

	return metricsAndLogsRow;
}

