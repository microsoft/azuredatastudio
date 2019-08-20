/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { BdcDashboardModel, Endpoint, Service } from './bdcDashboardModel';
import { IconPath } from '../constants';
import { EndpointModel, ServiceStatusModel, BdcStatusModel } from '../controller/apiGenerated';

const localize = nls.loadMessageBundle();

interface IServiceStatusRow {
	stateLoadingComponent: azdata.LoadingComponent;
	healthStatusLoadingComponent: azdata.LoadingComponent;
}

interface IServiceEndpointRow {
	endpointLoadingComponent: azdata.LoadingComponent;
	isHyperlink: boolean;
}

const navWidth = '175px';
const overviewServiceNameCellWidth = '100px';
const overviewStateCellWidth = '75px';
const overviewHealthStatusCellWidth = '75px';

const serviceEndpointRowServiceNameCellWidth = '125px';
const serviceEndpointRowEndpointCellWidth = '350px';

export class BdcDashboardOverviewPage {

	private initialized: boolean = false;

	private clusterStateLoadingComponent: azdata.LoadingComponent;
	private clusterHealthStatusLoadingComponent: azdata.LoadingComponent;

	private sqlServerStatusRow: IServiceStatusRow;
	private hdfsStatusRow: IServiceStatusRow;
	private sparkStatusRow: IServiceStatusRow;
	private controlStatusRow: IServiceStatusRow;
	private gatewayStatusRow: IServiceStatusRow;
	private appStatusRow: IServiceStatusRow;

	private sqlServerEndpointRow: IServiceEndpointRow;
	private controllerEndpointRow: IServiceEndpointRow;
	private hdfsSparkGatewayEndpointRow: IServiceEndpointRow;
	private sparkHistoryEndpointRow: IServiceEndpointRow;
	private yarnHistoryEndpointRow: IServiceEndpointRow;
	private grafanaDashboardEndpointRow: IServiceEndpointRow;
	private kibanaDashboardEndpointRow: IServiceEndpointRow;

	constructor(private model: BdcDashboardModel) {
		this.model.onDidUpdateEndpoints(endpoints => this.handleEndpointsUpdate(endpoints));
		this.model.onDidUpdateBdcStatus(bdcStatus => this.handleBdcStatusUpdate(bdcStatus));
	}

	public create(view: azdata.ModelView): azdata.FlexContainer {
		const rootContainer = view.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'column',
				width: '100%',
				height: '100%',
				alignItems: 'left'
			}).component();

		// ##############
		// # PROPERTIES #
		// ##############

		const propertiesLabel = view.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.propertiesHeader', "Cluster Properties"), CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '10px' } })
			.component();
		rootContainer.addItem(propertiesLabel, { CSSStyles: { 'margin-top': '15px', 'font-size': '20px', 'font-weight': 'bold', 'padding-left': '10px' } });

		// Row 1
		const row1 = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', height: '30px', alignItems: 'center' }).component();
		// Cluster Name
		const clusterNameLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.clusterName', "Cluster Name :") }).component();
		const clusterNameValue = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: this.model.clusterName }).component();
		row1.addItem(clusterNameLabel, { CSSStyles: { 'width': '100px', 'min-width': '100px', 'user-select': 'text' } });
		row1.addItem(clusterNameValue, { CSSStyles: { 'user-select': 'text' } });

		rootContainer.addItem(row1, { CSSStyles: { 'padding-left': '10px', 'border-top': 'solid 1px #ccc', 'box-sizing': 'border-box', 'user-select': 'text' } });

		// Row 2
		const row2 = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', height: '30px', alignItems: 'center' }).component();

		// Cluster State
		const clusterStateLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.clusterState', "Cluster State :") }).component();
		const clusterStateValue = view.modelBuilder.text().component();
		this.clusterStateLoadingComponent = view.modelBuilder.loadingComponent().withItem(clusterStateValue).component();
		row2.addItem(clusterStateLabel, { CSSStyles: { 'width': '125px', 'min-width': '125px', 'user-select': 'text' } });
		row2.addItem(this.clusterStateLoadingComponent, { CSSStyles: { 'width': '125px', 'min-width': '125px', 'user-select': 'text' } });

		// Health Status
		const healthStatusLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.healthStatus', "Health Status :") }).component();
		const healthStatusValue = view.modelBuilder.text().component();
		this.clusterHealthStatusLoadingComponent = view.modelBuilder.loadingComponent().withItem(healthStatusValue).component();
		row2.addItem(healthStatusLabel, { CSSStyles: { 'width': '125px', 'min-width': '125px', 'user-select': 'text' } });
		row2.addItem(this.clusterHealthStatusLoadingComponent, { CSSStyles: { 'width': '125px', 'min-width': '125px', 'user-select': 'text' } });

		rootContainer.addItem(row2, { CSSStyles: { 'padding-left': '10px', 'border-bottom': 'solid 1px #ccc', 'box-sizing': 'border-box', 'user-select': 'text' } });

		// ############
		// # OVERVIEW #
		// ############

		const overviewLabel = view.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.overviewHeader', "Cluster Overview"), CSSStyles: { 'margin-block-start': '20px', 'margin-block-end': '0px' } })
			.component();
		rootContainer.addItem(overviewLabel, { CSSStyles: { 'font-size': '20px', 'font-weight': 'bold', 'padding-left': '10px' } });

		const overviewContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%', alignItems: 'left' }).component();

		// Service Status header row
		const serviceStatusHeaderRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
		const nameCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.serviceNameHeader', "Service Name") }).component();
		serviceStatusHeaderRow.addItem(nameCell, { CSSStyles: { 'width': overviewServiceNameCellWidth, 'min-width': overviewServiceNameCellWidth, 'font-weight': 'bold', 'user-select': 'text' } });
		const stateCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.stateHeader', "State") }).component();
		serviceStatusHeaderRow.addItem(stateCell, { CSSStyles: { 'width': overviewStateCellWidth, 'min-width': overviewStateCellWidth, 'font-weight': 'bold', 'user-select': 'text' } });
		const healthStatusCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.healthStatusHeader', "Health Status") }).component();
		serviceStatusHeaderRow.addItem(healthStatusCell, { CSSStyles: { 'width': overviewHealthStatusCellWidth, 'min-width': overviewHealthStatusCellWidth, 'font-weight': 'bold', 'user-select': 'text' } });
		overviewContainer.addItem(serviceStatusHeaderRow, { CSSStyles: { 'padding-left': '10px', 'box-sizing': 'border-box', 'user-select': 'text' } });

		this.sqlServerStatusRow = createServiceStatusRow(view.modelBuilder, overviewContainer, localize('bdc.dashboard.sqlServerLabel', "SQL Server"));
		this.hdfsStatusRow = createServiceStatusRow(view.modelBuilder, overviewContainer, localize('bdc.dashboard.hdfsLabel', "HDFS"));
		this.sparkStatusRow = createServiceStatusRow(view.modelBuilder, overviewContainer, localize('bdc.dashboard.sparkLabel', "Spark"));
		this.controlStatusRow = createServiceStatusRow(view.modelBuilder, overviewContainer, localize('bdc.dashboard.controlLabel', "Control"));
		this.gatewayStatusRow = createServiceStatusRow(view.modelBuilder, overviewContainer, localize('bdc.dashboard.gatewayLabel', "Gateway"));
		this.appStatusRow = createServiceStatusRow(view.modelBuilder, overviewContainer, localize('bdc.dashboard.appLabel', "App"));

		rootContainer.addItem(overviewContainer, { flex: '0 0 auto' });

		// #####################
		// # SERVICE ENDPOINTS #
		// #####################

		const endpointsLabel = view.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.endpointsLabel', "Service Endpoints"), CSSStyles: { 'margin-block-start': '20px', 'margin-block-end': '0px' } })
			.component();
		rootContainer.addItem(endpointsLabel, { CSSStyles: { 'font-size': '20px', 'font-weight': 'bold', 'padding-left': '10px' } });

		const endpointsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%', alignItems: 'left' }).component();

		// Service endpoints header row
		const endpointsHeaderRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
		const endpointsServiceNameHeaderCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.serviceHeader', "Service") }).component();
		endpointsHeaderRow.addItem(endpointsServiceNameHeaderCell, { CSSStyles: { 'width': serviceEndpointRowServiceNameCellWidth, 'min-width': serviceEndpointRowServiceNameCellWidth, 'font-weight': 'bold', 'user-select': 'text' } });
		const endpointsEndpointHeaderCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.endpointHeader', "Endpoint") }).component();
		endpointsHeaderRow.addItem(endpointsEndpointHeaderCell, { CSSStyles: { 'width': serviceEndpointRowEndpointCellWidth, 'min-width': serviceEndpointRowEndpointCellWidth, 'font-weight': 'bold', 'user-select': 'text' } });
		endpointsContainer.addItem(endpointsHeaderRow, { CSSStyles: { 'padding-left': '10px', 'box-sizing': 'border-box', 'user-select': 'text' } });

		this.sqlServerEndpointRow = createServiceEndpointRow(view.modelBuilder, endpointsContainer, getFriendlyEndpointNames('sql-server'), false);
		this.controllerEndpointRow = createServiceEndpointRow(view.modelBuilder, endpointsContainer, getFriendlyEndpointNames('controller'), false);
		this.hdfsSparkGatewayEndpointRow = createServiceEndpointRow(view.modelBuilder, endpointsContainer, getFriendlyEndpointNames('gateway'), false);
		this.sparkHistoryEndpointRow = createServiceEndpointRow(view.modelBuilder, endpointsContainer, getFriendlyEndpointNames('spark-history'), true);
		this.yarnHistoryEndpointRow = createServiceEndpointRow(view.modelBuilder, endpointsContainer, getFriendlyEndpointNames('yarn-history'), true);
		this.grafanaDashboardEndpointRow = createServiceEndpointRow(view.modelBuilder, endpointsContainer, getFriendlyEndpointNames('grafana'), true);
		this.kibanaDashboardEndpointRow = createServiceEndpointRow(view.modelBuilder, endpointsContainer, getFriendlyEndpointNames('kibana'), true);

		rootContainer.addItem(endpointsContainer, { flex: '0 0 auto' });

		this.initialized = true;

		// Now that we've created the UI load data from the model in case it already had data
		this.handleEndpointsUpdate(this.model.serviceEndpoints);
		this.handleBdcStatusUpdate(this.model.bdcStatus);

		return rootContainer;
	}

	private handleBdcStatusUpdate(bdcStatus: BdcStatusModel): void {
		if (!this.initialized || !bdcStatus) {
			return;
		}

		this.clusterStateLoadingComponent.loading = false;
		this.clusterHealthStatusLoadingComponent.loading = false;
		this.clusterStateLoadingComponent.component.updateProperty('value', bdcStatus.state);
		this.clusterHealthStatusLoadingComponent.component.updateProperty('value', bdcStatus.healthStatus);

		if (bdcStatus.services) {
			// Service Status
			const sqlServerServiceStatus = bdcStatus.services.find(s => s.serviceName === Service.sql);
			updateServiceStatusRow(this.sqlServerStatusRow, sqlServerServiceStatus);

			const hdfsServiceStatus = bdcStatus.services.find(s => s.serviceName === Service.hdfs);
			updateServiceStatusRow(this.hdfsStatusRow, hdfsServiceStatus);

			const sparkServiceStatus = bdcStatus.services.find(s => s.serviceName === Service.spark);
			updateServiceStatusRow(this.sparkStatusRow, sparkServiceStatus);

			const controlServiceStatus = bdcStatus.services.find(s => s.serviceName === Service.control);
			updateServiceStatusRow(this.controlStatusRow, controlServiceStatus);

			const gatewayServiceStatus = bdcStatus.services.find(s => s.serviceName === Service.gateway);
			updateServiceStatusRow(this.gatewayStatusRow, gatewayServiceStatus);

			const appServiceStatus = bdcStatus.services.find(s => s.serviceName === Service.app);
			updateServiceStatusRow(this.appStatusRow, appServiceStatus);
		}
	}

	private handleEndpointsUpdate(endpoints: EndpointModel[]): void {
		if (!this.initialized || !endpoints) {
			return;
		}

		// Service Endpoints
		const sqlServerEndpoint = endpoints.find(e => e.name === Endpoint.sqlServerMaster);
		updateServiceEndpointRow(this.sqlServerEndpointRow, sqlServerEndpoint);

		const controllerEndpoint = endpoints.find(e => e.name === Endpoint.controller);
		updateServiceEndpointRow(this.controllerEndpointRow, controllerEndpoint);

		const gatewayEndpoint = endpoints.find(e => e.name === Endpoint.gateway);
		updateServiceEndpointRow(this.hdfsSparkGatewayEndpointRow, gatewayEndpoint);

		const yarnHistoryEndpoint = endpoints.find(e => e.name === Endpoint.yarnUi);
		updateServiceEndpointRow(this.yarnHistoryEndpointRow, yarnHistoryEndpoint);

		const sparkHistoryEndpoint = endpoints.find(e => e.name === Endpoint.sparkHistory);
		updateServiceEndpointRow(this.sparkHistoryEndpointRow, sparkHistoryEndpoint);

		const grafanaDashboardEndpoint = endpoints.find(e => e.name === Endpoint.metricsui);
		updateServiceEndpointRow(this.grafanaDashboardEndpointRow, grafanaDashboardEndpoint);

		const kibanaDashboardEndpoint = endpoints.find(e => e.name === Endpoint.logsui);
		updateServiceEndpointRow(this.kibanaDashboardEndpointRow, kibanaDashboardEndpoint);
	}
}

function updateServiceStatusRow(serviceStatusRow: IServiceStatusRow, serviceStatus: ServiceStatusModel) {
	if (serviceStatus) {
		serviceStatusRow.stateLoadingComponent.loading = false;
		serviceStatusRow.healthStatusLoadingComponent.loading = false;
		serviceStatusRow.stateLoadingComponent.component.updateProperty('value', serviceStatus.state);
		serviceStatusRow.healthStatusLoadingComponent.component.updateProperty('value', serviceStatus.healthStatus);
	}
	else {
		serviceStatusRow.stateLoadingComponent.loading = true;
		serviceStatusRow.healthStatusLoadingComponent.loading = true;
	}
}

function updateServiceEndpointRow(serviceEndpointRow: IServiceEndpointRow, endpoint: EndpointModel) {
	if (endpoint) {
		serviceEndpointRow.endpointLoadingComponent.loading = false;
		if (serviceEndpointRow.isHyperlink) {
			serviceEndpointRow.endpointLoadingComponent.component.updateProperties({ label: endpoint.endpoint, url: endpoint.endpoint });
		}
		else {
			serviceEndpointRow.endpointLoadingComponent.component.updateProperty('value', endpoint.endpoint);
		}
	}
	else {
		serviceEndpointRow.endpointLoadingComponent.loading = true;
	}
}

function createServiceStatusRow(modelBuilder: azdata.ModelBuilder, container: azdata.FlexContainer, name: string): IServiceStatusRow {
	const serviceStatusRow = modelBuilder.flexContainer().withLayout({ flexFlow: 'row', alignItems: 'center', height: '30px' }).component();
	const nameCell = modelBuilder.text().withProperties({ value: name, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' } }).component();
	serviceStatusRow.addItem(nameCell, { CSSStyles: { 'width': '100px', 'min-width': '100px', 'user-select': 'text', 'margin-block-start': '0px', 'margin-block-end': '0px' } });
	const stateCell = modelBuilder.text().withProperties({ CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'text' } }).component();
	const stateLoadingComponent = modelBuilder.loadingComponent()
		.withItem(stateCell)
		.withProperties({ CSSStyles: { 'padding-top': '0px', 'padding-bottom': '0px' } })
		.component();
	serviceStatusRow.addItem(stateLoadingComponent, { CSSStyles: { 'width': '75px', 'min-width': '75px' } });
	const healthStatusCell = modelBuilder.text().withProperties({ CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'text' } }).component();
	const healthStatusLoadingComponent = modelBuilder.loadingComponent()
		.withItem(healthStatusCell)
		.withProperties({ CSSStyles: { 'padding-top': '0px', 'padding-bottom': '0px' } })
		.component();
	serviceStatusRow.addItem(healthStatusLoadingComponent, { CSSStyles: { 'width': '75px', 'min-width': '75px' } });

	container.addItem(serviceStatusRow, { CSSStyles: { 'padding-left': '10px', 'border-top': 'solid 1px #ccc', 'box-sizing': 'border-box', 'user-select': 'text' } });

	return { stateLoadingComponent: stateLoadingComponent, healthStatusLoadingComponent: healthStatusLoadingComponent };
}

function createServiceEndpointRow(modelBuilder: azdata.ModelBuilder, container: azdata.FlexContainer, name: string, isHyperlink: boolean): IServiceEndpointRow {
	const endPointRow = modelBuilder.flexContainer().withLayout({ flexFlow: 'row', alignItems: 'center', height: '30px' }).component();
	const nameCell = modelBuilder.text().withProperties({ value: name, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' } }).component();
	endPointRow.addItem(nameCell, { CSSStyles: { 'width': serviceEndpointRowServiceNameCellWidth, 'min-width': serviceEndpointRowServiceNameCellWidth, 'user-select': 'text' } });
	let retRow: IServiceEndpointRow;
	if (isHyperlink) {
		const endpointCell = modelBuilder.hyperlink().withProperties({ CSSStyles: { 'height': '15px' } }).component();
		const endpointLoadingComponent = modelBuilder.loadingComponent()
			.withItem(endpointCell)
			.withProperties({ CSSStyles: { 'padding-top': '0px', 'padding-bottom': '0px' } })
			.component();
		retRow = { endpointLoadingComponent: endpointLoadingComponent, isHyperlink: true };
		endPointRow.addItem(endpointLoadingComponent, { CSSStyles: { 'width': serviceEndpointRowEndpointCellWidth, 'min-width': serviceEndpointRowEndpointCellWidth, 'color': '#0078d4', 'text-decoration': 'underline', 'overflow': 'hidden' } });
	}
	else {
		const endpointCell = modelBuilder.text().withProperties({ CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'text' } }).component();
		const endpointLoadingComponent = modelBuilder.loadingComponent()
			.withItem(endpointCell)
			.withProperties({ CSSStyles: { 'padding-top': '0px', 'padding-bottom': '0px' } })
			.component();
		retRow = { endpointLoadingComponent: endpointLoadingComponent, isHyperlink: false };
		endPointRow.addItem(endpointLoadingComponent, { CSSStyles: { 'width': serviceEndpointRowEndpointCellWidth, 'min-width': serviceEndpointRowEndpointCellWidth, 'overflow': 'hidden' } });
	}
	const copyValueCell = modelBuilder.button().component();
	copyValueCell.iconPath = IconPath.copy;
	copyValueCell.onDidClick(() => {
		// vscode.env.clipboard.writeText(hyperlink);
	});
	copyValueCell.title = localize('bdc.dashboard.copyTitle', "Copy");
	copyValueCell.iconHeight = '14px';
	copyValueCell.iconWidth = '14px';
	endPointRow.addItem(copyValueCell, { CSSStyles: { 'width': '50px', 'min-width': '50px', 'padding-left': '10px', 'margin-block-start': '0px', 'margin-block-end': '0px' } });

	container.addItem(endPointRow, { CSSStyles: { 'padding-left': '10px', 'border-top': 'solid 1px #ccc', 'box-sizing': 'border-box', 'user-select': 'text' } });

	return retRow;
}

function getFriendlyEndpointNames(name: string): string {
	switch (name) {
		case 'app-proxy':
			return localize('bdc.dashboard.appproxy', "Application Proxy");
		case 'controller':
			return localize('bdc.dashboard.controller', "Controller");
		case 'gateway':
			return localize('bdc.dashboard.gateway', "HDFS/Spark Gateway");
		case 'management-proxy':
			return localize('bdc.dashboard.managementproxy', "Management Proxy");
		case 'mgmtproxy':
			return localize('bdc.dashboard.mgmtproxy', "Management Proxy");
		case 'sql-server':
			return localize('bdc.dashboard.sqlServerEndpoint', "SQL Server Master Instance");
		case 'grafana':
			return localize('bdc.dashboard.grafana', "Metrics Dashboard");
		case 'kibana':
			return localize('bdc.dashboard.kibana', "Log Search Dashboard");
		case 'yarn-history':
			localize('bdc.dashboard.yarnHistory', "Spark Resource Management");
		case 'spark-history':
			localize('sparkHistory', "Spark Job Monitoring");
		default:
			return name;
	}
}
