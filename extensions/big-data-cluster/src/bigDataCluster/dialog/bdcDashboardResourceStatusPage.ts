/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { BdcDashboardModel } from './bdcDashboardModel';
import { BdcStatusModel, InstanceStatusModel } from '../controller/apiGenerated';
import { getHealthStatusDisplayText, getHealthStatusIcon, getStateDisplayText, Service } from '../utils';
import { cssStyles } from '../constants';
import { isNullOrUndefined } from 'util';
import { createViewDetailsButton } from './commonControls';
import { BdcDashboardPage } from './bdcDashboardPage';

const localize = nls.loadMessageBundle();

const healthAndStatusIconColumnWidth = 25;
const healthAndStatusInstanceNameColumnWidth = 100;
const healthAndStatusStateColumnWidth = 150;
const healthAndStatusHealthColumnWidth = 100;

const metricsAndLogsInstanceNameColumnWidth = 125;
const metricsAndLogsNodeMetricsColumnWidth = 80;
const metricsAndLogsSqlMetricsColumnWidth = 80;
const metricsAndLogsLogsColumnWidth = 75;

const viewText = localize('bdc.dashboard.viewHyperlink', "View");
const notAvailableText = localize('bdc.dashboard.notAvailable', "N/A");

export class BdcDashboardResourceStatusPage extends BdcDashboardPage {

	private rootContainer: azdata.FlexContainer;
	private instanceHealthStatusRowsContainer: azdata.FlexContainer;
	private metricsAndLogsRowsContainer: azdata.FlexContainer;
	private lastUpdatedLabel: azdata.TextComponent;

	constructor(private model: BdcDashboardModel, private modelView: azdata.ModelView, private serviceName: string, private resourceName: string) {
		super();
		this.model.onDidUpdateBdcStatus(bdcStatus => this.eventuallyRunOnInitialized(() => this.handleBdcStatusUpdate(bdcStatus)));
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
				height: '100%'
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
				CSSStyles: { ...cssStyles.lastUpdatedText }
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
		rootContainer.addItem(instanceHealthStatusHeaderRow, { flex: '0 0 auto', CSSStyles: { 'padding-left': '10px', 'box-sizing': 'border-box' } });

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
		const nodeMetricsCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.nodeMetricsHeader', "Node Metrics") }).component();
		metricsAndLogsHeaderRow.addItem(nodeMetricsCell, { CSSStyles: { 'width': `${metricsAndLogsNodeMetricsColumnWidth}px`, 'min-width': `${metricsAndLogsNodeMetricsColumnWidth}px`, ...cssStyles.tableHeader } });
		// Only show SQL metrics column for SQL resource instances
		if (this.serviceName.toLowerCase() === Service.sql) {
			const sqlMetricsCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.sqlMetricsHeader', "SQL Metrics") }).component();
			metricsAndLogsHeaderRow.addItem(sqlMetricsCell, { CSSStyles: { 'width': `${metricsAndLogsSqlMetricsColumnWidth}px`, 'min-width': `${metricsAndLogsSqlMetricsColumnWidth}px`, ...cssStyles.tableHeader } });
		}
		const healthStatusCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.logsHeader', "Logs") }).component();
		metricsAndLogsHeaderRow.addItem(healthStatusCell, { CSSStyles: { 'width': `${metricsAndLogsLogsColumnWidth}px`, 'min-width': `${metricsAndLogsLogsColumnWidth}px`, ...cssStyles.tableHeader } });
		rootContainer.addItem(metricsAndLogsHeaderRow, { flex: '0 0 auto', CSSStyles: { 'padding-left': '10px', 'box-sizing': 'border-box' } });

		this.metricsAndLogsRowsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		rootContainer.addItem(this.metricsAndLogsRowsContainer, { flex: '0 0 auto' });

		this.initialized = true;
		this.handleBdcStatusUpdate(this.model.bdcStatus);

		return rootContainer;
	}

	private handleBdcStatusUpdate(bdcStatus?: BdcStatusModel): void {
		if (!bdcStatus) {
			return;
		}
		const service = bdcStatus.services ? bdcStatus.services.find(s => s.serviceName === this.serviceName) : undefined;
		const resource = service ? service.resources.find(r => r.resourceName === this.resourceName) : undefined;

		if (!resource || isNullOrUndefined(resource.instances)) {
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

			let metricsAndLogsRow = createMetricsAndLogsRow(this.modelView.modelBuilder, i, this.serviceName);
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
	const nameCell = modelBuilder.text().withProperties({ value: instanceStatus.instanceName, CSSStyles: { ...cssStyles.text } }).component();
	instanceHealthStatusRow.addItem(nameCell, { CSSStyles: { 'width': `${healthAndStatusInstanceNameColumnWidth}px`, 'min-width': `${healthAndStatusInstanceNameColumnWidth}px`, ...cssStyles.text } });
	const stateText = getStateDisplayText(instanceStatus.state);
	const stateCell = modelBuilder.text().withProperties({ value: stateText, title: stateText, CSSStyles: { ...cssStyles.overflowEllipsisText } }).component();
	instanceHealthStatusRow.addItem(stateCell, { CSSStyles: { 'width': `${healthAndStatusStateColumnWidth}px`, 'min-width': `${healthAndStatusStateColumnWidth}px` } });
	const healthStatusText = getHealthStatusDisplayText(instanceStatus.healthStatus);
	const healthStatusCell = modelBuilder.text().withProperties({ value: healthStatusText, title: healthStatusText, CSSStyles: { ...cssStyles.overflowEllipsisText } }).component();
	instanceHealthStatusRow.addItem(healthStatusCell, { CSSStyles: { 'width': `${healthAndStatusHealthColumnWidth}px`, 'min-width': `${healthAndStatusHealthColumnWidth}px` } });

	if (instanceStatus.healthStatus !== 'healthy' && instanceStatus.details && instanceStatus.details.length > 0) {
		instanceHealthStatusRow.addItem(createViewDetailsButton(modelBuilder, instanceStatus.details), { flex: '0 0 auto' });
	}
	return instanceHealthStatusRow;
}

/**
 * Creates a row with the name, link to the metrics and a link to the logs for a particular instance on this resource
 * @param modelBuilder The builder used to create the component
 * @param instanceStatus The status object for the instance this row is for
 * @param serviceName The name of the service this resource instance belongs to
 */
function createMetricsAndLogsRow(modelBuilder: azdata.ModelBuilder, instanceStatus: InstanceStatusModel, serviceName: string): azdata.FlexContainer {
	const metricsAndLogsRow = modelBuilder.flexContainer().withLayout({ flexFlow: 'row', alignItems: 'center', height: '30px' }).component();
	const nameCell = modelBuilder.text().withProperties({ value: instanceStatus.instanceName, CSSStyles: { ...cssStyles.text } }).component();
	metricsAndLogsRow.addItem(nameCell, { CSSStyles: { 'width': `${metricsAndLogsInstanceNameColumnWidth}px`, 'min-width': `${metricsAndLogsInstanceNameColumnWidth}px`, ...cssStyles.text } });

	// Not all instances have all logs available - in that case just display N/A instead of a link
	if (isNullOrUndefined(instanceStatus.dashboards) || isNullOrUndefined(instanceStatus.dashboards.nodeMetricsUrl)) {
		const metricsCell = modelBuilder.text().withProperties({ value: notAvailableText, CSSStyles: { ...cssStyles.text } }).component();
		metricsAndLogsRow.addItem(metricsCell, { CSSStyles: { 'width': `${metricsAndLogsNodeMetricsColumnWidth}px`, 'min-width': `${metricsAndLogsNodeMetricsColumnWidth}px`, ...cssStyles.text } });
	} else {
		const nodeMetricsCell = modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: viewText,
			url: instanceStatus.dashboards.nodeMetricsUrl,
			title: instanceStatus.dashboards.nodeMetricsUrl,
			CSSStyles: { ...cssStyles.text, ...cssStyles.hyperlink }
		})
			.component();
		metricsAndLogsRow.addItem(nodeMetricsCell, { CSSStyles: { 'width': `${metricsAndLogsNodeMetricsColumnWidth}px`, 'min-width': `${metricsAndLogsNodeMetricsColumnWidth}px` } });
	}

	// Only show SQL metrics column for SQL resource instances
	if (serviceName === Service.sql) {
		// Not all instances have all logs available - in that case just display N/A instead of a link
		if (isNullOrUndefined(instanceStatus.dashboards) || isNullOrUndefined(instanceStatus.dashboards.sqlMetricsUrl)) {
			const metricsCell = modelBuilder.text().withProperties({ value: notAvailableText, CSSStyles: { ...cssStyles.text } }).component();
			metricsAndLogsRow.addItem(metricsCell, { CSSStyles: { 'width': `${metricsAndLogsSqlMetricsColumnWidth}px`, 'min-width': `${metricsAndLogsSqlMetricsColumnWidth}px`, ...cssStyles.text } });
		} else {
			const sqlMetricsCell = modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
				label: viewText,
				url: instanceStatus.dashboards.sqlMetricsUrl,
				title: instanceStatus.dashboards.sqlMetricsUrl,
				CSSStyles: { ...cssStyles.text, ...cssStyles.hyperlink }
			})
				.component();
			metricsAndLogsRow.addItem(sqlMetricsCell, { CSSStyles: { 'width': `${metricsAndLogsSqlMetricsColumnWidth}px`, 'min-width': `${metricsAndLogsSqlMetricsColumnWidth}px` } });
		}
	}

	if (isNullOrUndefined(instanceStatus.dashboards) || isNullOrUndefined(instanceStatus.dashboards.logsUrl)) {
		const logsCell = modelBuilder.text().withProperties({ value: notAvailableText, CSSStyles: { ...cssStyles.text } }).component();
		metricsAndLogsRow.addItem(logsCell, { CSSStyles: { 'width': `${metricsAndLogsLogsColumnWidth}px`, 'min-width': `${metricsAndLogsLogsColumnWidth}px`, ...cssStyles.text } });
	} else {
		const logsCell = modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: viewText,
			url: instanceStatus.dashboards.logsUrl,
			title: instanceStatus.dashboards.logsUrl,
			CSSStyles: { ...cssStyles.text, ...cssStyles.hyperlink }
		})
			.component();
		metricsAndLogsRow.addItem(logsCell, { CSSStyles: { 'width': `${metricsAndLogsLogsColumnWidth}px`, 'min-width': `${metricsAndLogsLogsColumnWidth}px` } });
	}

	return metricsAndLogsRow;
}
