/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { BdcDashboardModel } from './bdcDashboardModel';
import { IconPathHelper, cssStyles } from '../constants';
import { getStateDisplayText, getHealthStatusDisplayText, getEndpointDisplayText, getHealthStatusIcon, getServiceNameDisplayText, Endpoint } from '../utils';
import { EndpointModel, ServiceStatusModel, BdcStatusModel } from '../controller/apiGenerated';
import { BdcDashboard } from './bdcDashboard';

const localize = nls.loadMessageBundle();

const overviewIconColumnWidthPx = 25;
const overviewServiceNameCellWidthPx = 175;
const overviewStateCellWidthPx = 75;
const overviewHealthStatusCellWidthPx = 100;

const serviceEndpointRowServiceNameCellWidth = 200;
const serviceEndpointRowEndpointCellWidth = 350;

const hyperlinkedEndpoints = [Endpoint.metricsui, Endpoint.logsui, Endpoint.sparkHistory, Endpoint.yarnUi];

export class BdcDashboardOverviewPage {

	private initialized: boolean = false;
	private modelBuilder: azdata.ModelBuilder;

	private lastUpdatedLabel: azdata.TextComponent;
	private clusterStateLoadingComponent: azdata.LoadingComponent;
	private clusterHealthStatusLoadingComponent: azdata.LoadingComponent;

	private serviceStatusRowContainer: azdata.FlexContainer;

	private endpointsRowContainer: azdata.FlexContainer;

	constructor(private dashboard: BdcDashboard, private model: BdcDashboardModel) {
		this.model.onDidUpdateEndpoints(endpoints => this.handleEndpointsUpdate(endpoints));
		this.model.onDidUpdateBdcStatus(bdcStatus => this.handleBdcStatusUpdate(bdcStatus));
	}

	public create(view: azdata.ModelView): azdata.FlexContainer {
		this.modelBuilder = view.modelBuilder;
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
		rootContainer.addItem(propertiesLabel, { CSSStyles: { 'margin-top': '15px', 'padding-left': '10px', ...cssStyles.title } });

		// Row 1
		const row1 = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', height: '30px', alignItems: 'center' }).component();

		// Cluster State
		const clusterStateLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.clusterState', "Cluster State :") }).component();
		const clusterStateValue = view.modelBuilder.text().withProperties({ CSSStyles: { 'user-select': 'text' } }).component();
		this.clusterStateLoadingComponent = view.modelBuilder.loadingComponent().withItem(clusterStateValue).component();
		row1.addItem(clusterStateLabel, { CSSStyles: { 'width': '125px', 'min-width': '125px', 'user-select': 'none', 'font-weight': 'bold' } });
		row1.addItem(this.clusterStateLoadingComponent, { CSSStyles: { 'width': '125px', 'min-width': '125px', 'user-select': 'none' } });

		// Health Status
		const healthStatusLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.healthStatus', "Health Status :") }).component();
		const healthStatusValue = view.modelBuilder.text().withProperties({ CSSStyles: { 'user-select': 'text' } }).component();
		this.clusterHealthStatusLoadingComponent = view.modelBuilder.loadingComponent().withItem(healthStatusValue).component();
		row1.addItem(healthStatusLabel, { CSSStyles: { 'width': '125px', 'min-width': '125px', 'user-select': 'none', 'font-weight': 'bold' } });
		row1.addItem(this.clusterHealthStatusLoadingComponent, { CSSStyles: { 'width': '125px', 'min-width': '125px', 'user-select': 'none' } });

		rootContainer.addItem(row1, { CSSStyles: { 'padding-left': '10px', 'border-bottom': 'solid 1px #ccc', 'box-sizing': 'border-box', 'user-select': 'text' } });

		// ############
		// # OVERVIEW #
		// ############

		const overviewHeaderContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', height: '20px' }).component();
		rootContainer.addItem(overviewHeaderContainer, { CSSStyles: { 'padding-left': '10px', 'padding-top': '15px' } });

		const overviewLabel = view.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: localize('bdc.dashboard.overviewHeader', "Cluster Overview"),
				CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' }
			})
			.component();

		overviewHeaderContainer.addItem(overviewLabel, { CSSStyles: { ...cssStyles.title } });

		this.lastUpdatedLabel = view.modelBuilder.text()
			.withProperties({
				value: localize('bdc.dashboard.lastUpdated', "Last Updated : {0}", '-'),
				CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'color': '#595959' }
			}).component();

		overviewHeaderContainer.addItem(this.lastUpdatedLabel, { CSSStyles: { 'margin-left': '45px' } });

		const overviewContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%', alignItems: 'left' }).component();

		// Service Status header row
		const serviceStatusHeaderRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
		const nameCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.serviceNameHeader', "Service Name") }).component();
		// Service name cell covers both icon + service name so width stretches both cells
		serviceStatusHeaderRow.addItem(nameCell, { CSSStyles: { 'width': `${overviewServiceNameCellWidthPx + overviewIconColumnWidthPx}px`, 'min-width': `${overviewServiceNameCellWidthPx + overviewIconColumnWidthPx}px`, ...cssStyles.tableHeader } });
		const stateCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.stateHeader', "State"), CSSStyles: { ...cssStyles.tableHeader } }).component();
		serviceStatusHeaderRow.addItem(stateCell, { CSSStyles: { 'width': `${overviewStateCellWidthPx}px`, 'min-width': `${overviewStateCellWidthPx}px`, 'user-select': 'text' } });
		const healthStatusCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.healthStatusHeader', "Health Status"), CSSStyles: { ...cssStyles.tableHeader } }).component();
		serviceStatusHeaderRow.addItem(healthStatusCell, { CSSStyles: { 'width': `${overviewHealthStatusCellWidthPx}px`, 'min-width': `${overviewHealthStatusCellWidthPx}px`, 'user-select': 'text' } });
		overviewContainer.addItem(serviceStatusHeaderRow, { CSSStyles: { 'padding-left': '10px', 'box-sizing': 'border-box', 'user-select': 'text' } });

		// Service Status row container
		this.serviceStatusRowContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		// Note we don't give the rows container as a child of the loading component since in order to align the loading component correctly
		// messes up the layout for the row container that we display after loading is finished. Instead we just remove the loading component
		// and replace it with the rows directly
		const serviceStatusRowContainerLoadingComponent = view.modelBuilder.loadingComponent()
			.withProperties({ CSSStyles: { 'padding-top': '0px', 'padding-bottom': '0px' } })
			.component();
		this.serviceStatusRowContainer.addItem(serviceStatusRowContainerLoadingComponent, { flex: '0 0 auto', CSSStyles: { 'padding-left': '150px', width: '30px' } });

		overviewContainer.addItem(this.serviceStatusRowContainer);
		rootContainer.addItem(overviewContainer, { flex: '0 0 auto' });

		// #####################
		// # SERVICE ENDPOINTS #
		// #####################

		const endpointsLabel = view.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.endpointsLabel', "Service Endpoints"), CSSStyles: { 'margin-block-start': '20px', 'margin-block-end': '0px' } })
			.component();
		rootContainer.addItem(endpointsLabel, { CSSStyles: { 'padding-left': '10px', ...cssStyles.title } });

		const endpointsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%', alignItems: 'left' }).component();

		// Service endpoints header row
		const endpointsHeaderRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
		const endpointsServiceNameHeaderCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.serviceHeader', "Service") }).component();
		endpointsHeaderRow.addItem(endpointsServiceNameHeaderCell, { CSSStyles: { 'width': `${serviceEndpointRowServiceNameCellWidth}px`, 'min-width': `${serviceEndpointRowServiceNameCellWidth}px`, ...cssStyles.tableHeader } });
		const endpointsEndpointHeaderCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.endpointHeader', "Endpoint") }).component();
		endpointsHeaderRow.addItem(endpointsEndpointHeaderCell, { CSSStyles: { 'width': `${serviceEndpointRowEndpointCellWidth}px`, 'min-width': `${serviceEndpointRowEndpointCellWidth}px`, ...cssStyles.tableHeader } });
		endpointsContainer.addItem(endpointsHeaderRow, { CSSStyles: { 'padding-left': '10px', 'box-sizing': 'border-box', 'user-select': 'text' } });

		this.endpointsRowContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		// Note we don't give the rows container as a child of the loading component since in order to align the loading component correctly
		// messes up the layout for the row container that we display after loading is finished. Instead we just remove the loading component
		// and replace it with the rows directly
		const endpointRowContainerLoadingComponent = view.modelBuilder.loadingComponent()
			.withProperties({ CSSStyles: { 'padding-top': '0px', 'padding-bottom': '0px' } })
			.component();
		this.endpointsRowContainer.addItem(endpointRowContainerLoadingComponent, { flex: '0 0 auto', CSSStyles: { 'padding-left': '150px', width: '30px' } });

		endpointsContainer.addItem(this.endpointsRowContainer);

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
		this.lastUpdatedLabel.value =
			localize('bdc.dashboard.lastUpdated', "Last Updated : {0}",
				this.model.bdcStatusLastUpdated ?
					`${this.model.bdcStatusLastUpdated.toLocaleDateString()} ${this.model.bdcStatusLastUpdated.toLocaleTimeString()}`
					: '-');

		this.clusterStateLoadingComponent.loading = false;
		this.clusterHealthStatusLoadingComponent.loading = false;
		(<azdata.TextComponent>this.clusterStateLoadingComponent.component).value = getStateDisplayText(bdcStatus.state);
		(<azdata.TextComponent>this.clusterHealthStatusLoadingComponent.component).value = getHealthStatusDisplayText(bdcStatus.healthStatus);

		if (bdcStatus.services) {
			this.serviceStatusRowContainer.clearItems();
			bdcStatus.services.forEach((s, i) => {
				this.createServiceStatusRow(this.serviceStatusRowContainer, s, i === bdcStatus.services.length - 1);
			});
		}
	}

	private handleEndpointsUpdate(endpoints: EndpointModel[]): void {
		if (!this.initialized || !endpoints) {
			return;
		}

		this.endpointsRowContainer.clearItems();
		endpoints.forEach((e, i) => {
			createServiceEndpointRow(this.modelBuilder, this.endpointsRowContainer, e, this.model, hyperlinkedEndpoints.some(he => he === e.name), i === endpoints.length - 1);
		});
	}

	private createServiceStatusRow(container: azdata.FlexContainer, serviceStatus: ServiceStatusModel, isLastRow: boolean): void {
		const serviceStatusRow = this.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', alignItems: 'center', height: '30px' }).component();
		const statusIconCell = this.modelBuilder.text().withProperties({ value: getHealthStatusIcon(serviceStatus.healthStatus), CSSStyles: { 'user-select': 'none' } }).component();
		serviceStatusRow.addItem(statusIconCell, { CSSStyles: { 'width': `${overviewIconColumnWidthPx}px`, 'min-width': `${overviewIconColumnWidthPx}px` } });
		const nameCell = this.modelBuilder.text().withProperties({ value: getServiceNameDisplayText(serviceStatus.serviceName), CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'color': '#0078d4', 'text-decoration': 'underline', 'cursor': 'pointer' } }).component();
		nameCell.onDidClick(() => {
			this.dashboard.switchToServiceTab(serviceStatus.serviceName);
		});
		serviceStatusRow.addItem(nameCell, { CSSStyles: { 'width': `${overviewServiceNameCellWidthPx}px`, 'min-width': `${overviewServiceNameCellWidthPx}px`, 'user-select': 'text', 'margin-block-start': '0px', 'margin-block-end': '0px' } });
		const stateCell = this.modelBuilder.text().withProperties({ value: getStateDisplayText(serviceStatus.state), CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'text' } }).component();
		serviceStatusRow.addItem(stateCell, { CSSStyles: { 'width': `${overviewStateCellWidthPx}px`, 'min-width': `${overviewStateCellWidthPx}px` } });
		const healthStatusCell = this.modelBuilder.text().withProperties({ value: getHealthStatusDisplayText(serviceStatus.healthStatus), CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'text' } }).component();
		serviceStatusRow.addItem(healthStatusCell, { CSSStyles: { 'width': `${overviewHealthStatusCellWidthPx}px`, 'min-width': `${overviewHealthStatusCellWidthPx}px` } });

		if (serviceStatus.healthStatus !== 'healthy' && serviceStatus.details && serviceStatus.details.length > 0) {
			const viewDetailsButton = this.modelBuilder.button().withProperties<azdata.ButtonProperties>({ label: localize('bdc.dashboard.viewDetails', "View Details") }).component();
			viewDetailsButton.onDidClick(() => {
				vscode.window.showErrorMessage(serviceStatus.details);
			});
			serviceStatusRow.addItem(viewDetailsButton, { flex: '0 0 auto' });
		}

		container.addItem(serviceStatusRow, { CSSStyles: { 'padding-left': '10px', 'border-top': 'solid 1px #ccc', 'border-bottom': isLastRow ? 'solid 1px #ccc' : '', 'box-sizing': 'border-box', 'user-select': 'text' } });
	}
}

function createServiceEndpointRow(modelBuilder: azdata.ModelBuilder, container: azdata.FlexContainer, endpoint: EndpointModel, bdcModel: BdcDashboardModel, isHyperlink: boolean, isLastRow: boolean): void {
	const endPointRow = modelBuilder.flexContainer().withLayout({ flexFlow: 'row', alignItems: 'center', height: '40px' }).component();
	const nameCell = modelBuilder.text().withProperties({ value: getEndpointDisplayText(endpoint.name, endpoint.description), CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' } }).component();
	endPointRow.addItem(nameCell, { CSSStyles: { 'width': `${serviceEndpointRowServiceNameCellWidth}px`, 'min-width': `${serviceEndpointRowServiceNameCellWidth}px`, 'user-select': 'text', 'text-align': 'center' } });
	if (isHyperlink) {
		const endpointCell = modelBuilder.hyperlink()
			.withProperties({ label: endpoint.endpoint, url: endpoint.endpoint, CSSStyles: { 'height': '15px' } })
			.component();
		endPointRow.addItem(endpointCell, { CSSStyles: { 'width': `${serviceEndpointRowEndpointCellWidth}px`, 'min-width': `${serviceEndpointRowEndpointCellWidth}px`, 'color': '#0078d4', 'text-decoration': 'underline', 'overflow': 'hidden' } });
	}
	else if (endpoint.name === Endpoint.sqlServerMaster) {
		const endpointCell = modelBuilder.text()
			.withProperties({ value: endpoint.endpoint, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'text', 'cursor': 'pointer', 'color': '#0078d4', 'text-decoration': 'underline' } })
			.component();
		endpointCell.onDidClick(async () => {
			const connProfile = bdcModel.getSqlServerMasterConnectionProfile();
			const result = await azdata.connection.connect(connProfile, true, true);
			if (!result.connected) {
				if (result.errorMessage && result.errorMessage.length > 0) {
					vscode.window.showErrorMessage(result.errorMessage);
				}
				// Clear out the password and username before connecting since those being wrong are likely the issue
				connProfile.userName = undefined;
				connProfile.password = undefined;
				azdata.connection.openConnectionDialog(undefined, connProfile);
			}
		});
		endPointRow.addItem(endpointCell, { CSSStyles: { 'width': `${serviceEndpointRowEndpointCellWidth}px`, 'min-width': `${serviceEndpointRowEndpointCellWidth}px`, 'overflow': 'hidden' } });
	}
	else {
		const endpointCell = modelBuilder.text()
			.withProperties({ value: endpoint.endpoint, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px', 'user-select': 'text' } })
			.component();
		endPointRow.addItem(endpointCell, { CSSStyles: { 'width': `${serviceEndpointRowEndpointCellWidth}px`, 'min-width': `${serviceEndpointRowEndpointCellWidth}px`, 'overflow': 'hidden' } });
	}
	const copyValueCell = modelBuilder.button().component();
	copyValueCell.iconPath = IconPathHelper.copy;
	copyValueCell.onDidClick(() => {
		vscode.env.clipboard.writeText(endpoint.endpoint);
	});
	copyValueCell.title = localize('bdc.dashboard.copyTitle', "Copy");
	copyValueCell.iconHeight = '14px';
	copyValueCell.iconWidth = '14px';
	endPointRow.addItem(copyValueCell, { CSSStyles: { 'width': '14px', 'min-width': '14px', 'padding-left': '10px', 'margin-block-start': '0px', 'margin-block-end': '0px' } });

	container.addItem(endPointRow, { CSSStyles: { 'padding-left': '10px', 'border-top': 'solid 1px #ccc', 'border-bottom': isLastRow ? 'solid 1px #ccc' : '', 'box-sizing': 'border-box', 'user-select': 'text' } });
}
