/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { BdcDashboardModel, BdcErrorEvent } from './bdcDashboardModel';
import { IconPathHelper, cssStyles } from '../constants';
import { getStateDisplayText, getHealthStatusDisplayText, getEndpointDisplayText, getHealthStatusIcon, getServiceNameDisplayText, Endpoint, getBdcStatusErrorMessage } from '../utils';
import { EndpointModel, ServiceStatusModel, BdcStatusModel } from '../controller/apiGenerated';
import { BdcDashboard } from './bdcDashboard';
import { createViewDetailsButton } from './commonControls';
import { HdfsDialogCancelledError } from './hdfsDialogBase';
import { BdcDashboardPage } from './bdcDashboardPage';

const localize = nls.loadMessageBundle();

const clusterStateLabelColumnWidth = 100;
const clusterStateValueColumnWidth = 225;
const healthStatusColumnWidth = 125;

const overviewIconColumnWidthPx = 25;
const overviewServiceNameCellWidthPx = 175;
const overviewStateCellWidthPx = 150;
const overviewHealthStatusCellWidthPx = 100;

const serviceEndpointRowServiceNameCellWidth = 200;
const serviceEndpointRowEndpointCellWidth = 350;

const hyperlinkedEndpoints = [Endpoint.metricsui, Endpoint.logsui, Endpoint.sparkHistory, Endpoint.yarnUi];

export class BdcDashboardOverviewPage extends BdcDashboardPage {

	private modelBuilder: azdata.ModelBuilder;

	private lastUpdatedLabel: azdata.TextComponent;
	private propertiesContainer: azdata.DivContainer;
	private clusterStateLoadingComponent: azdata.LoadingComponent;
	private clusterHealthStatusLoadingComponent: azdata.LoadingComponent;

	private serviceStatusRowContainer: azdata.FlexContainer;

	private endpointsRowContainer: azdata.FlexContainer;
	private endpointsDisplayContainer: azdata.DivContainer;
	private serviceStatusDisplayContainer: azdata.DivContainer;
	private propertiesErrorMessage: azdata.TextComponent;
	private endpointsErrorMessage: azdata.TextComponent;
	private serviceStatusErrorMessage: azdata.TextComponent;

	constructor(private dashboard: BdcDashboard, private model: BdcDashboardModel) {
		super();
		this.model.onDidUpdateEndpoints(endpoints => this.eventuallyRunOnInitialized(() => this.handleEndpointsUpdate(endpoints)));
		this.model.onDidUpdateBdcStatus(bdcStatus => this.eventuallyRunOnInitialized(() => this.handleBdcStatusUpdate(bdcStatus)));
		this.model.onBdcError(error => this.eventuallyRunOnInitialized(() => this.handleBdcError(error)));
	}

	public create(view: azdata.ModelView): azdata.FlexContainer {
		this.modelBuilder = view.modelBuilder;
		const rootContainer = view.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'column',
				width: '100%',
				height: '100%'
			}).component();

		// ##############
		// # PROPERTIES #
		// ##############

		const propertiesLabel = view.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.propertiesHeader', "Cluster Properties"), CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '10px' } })
			.component();
		rootContainer.addItem(propertiesLabel, { CSSStyles: { 'margin-top': '15px', 'padding-left': '10px', ...cssStyles.title } });

		this.propertiesErrorMessage = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ display: 'none', CSSStyles: { ...cssStyles.errorText } }).component();
		rootContainer.addItem(this.propertiesErrorMessage, { flex: '0 0 auto' });

		this.propertiesContainer = view.modelBuilder.divContainer().component();

		// Row 1
		const row1 = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', height: '30px', alignItems: 'center' }).component();

		// Cluster State
		const clusterStateLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.clusterState', "Cluster State :") }).component();
		const clusterStateValue = view.modelBuilder.text().component();
		this.clusterStateLoadingComponent = view.modelBuilder.loadingComponent().withItem(clusterStateValue).component();
		row1.addItem(clusterStateLabel, { CSSStyles: { 'width': `${clusterStateLabelColumnWidth}px`, 'min-width': `${clusterStateLabelColumnWidth}px`, 'user-select': 'none', 'font-weight': 'bold' } });
		row1.addItem(this.clusterStateLoadingComponent, { CSSStyles: { 'width': `${clusterStateValueColumnWidth}px`, 'min-width': `${clusterStateValueColumnWidth}px` } });

		// Health Status
		const healthStatusLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.healthStatus', "Health Status :") }).component();
		const healthStatusValue = view.modelBuilder.text().component();
		this.clusterHealthStatusLoadingComponent = view.modelBuilder.loadingComponent().withItem(healthStatusValue).component();
		row1.addItem(healthStatusLabel, { CSSStyles: { 'width': `${healthStatusColumnWidth}px`, 'min-width': `${healthStatusColumnWidth}px`, 'user-select': 'none', 'font-weight': 'bold' } });
		row1.addItem(this.clusterHealthStatusLoadingComponent, { CSSStyles: { 'width': `${healthStatusColumnWidth}px`, 'min-width': `${healthStatusColumnWidth}px` } });

		this.propertiesContainer.addItem(row1, { CSSStyles: { 'padding-left': '10px', 'border-bottom': 'solid 1px #ccc', 'box-sizing': 'border-box', 'user-select': 'text' } });

		rootContainer.addItem(this.propertiesContainer, { flex: '0 0 auto' });

		// ############
		// # OVERVIEW #
		// ############

		const overviewHeaderContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', height: '20px' }).component();
		rootContainer.addItem(overviewHeaderContainer, { CSSStyles: { 'padding-left': '10px', 'padding-top': '15px' } });

		const overviewLabel = view.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: localize('bdc.dashboard.overviewHeader', "Cluster Overview"),
				CSSStyles: { ...cssStyles.text }
			})
			.component();

		overviewHeaderContainer.addItem(overviewLabel, { CSSStyles: { ...cssStyles.title } });

		this.lastUpdatedLabel = view.modelBuilder.text()
			.withProperties({
				value: localize('bdc.dashboard.lastUpdated', "Last Updated : {0}", '-'),
				CSSStyles: { ...cssStyles.lastUpdatedText }
			}).component();

		overviewHeaderContainer.addItem(this.lastUpdatedLabel, { CSSStyles: { 'margin-left': '45px' } });

		const overviewContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%' }).component();

		// Service Status header row
		const serviceStatusHeaderRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
		const nameCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.serviceNameHeader', "Service Name") }).component();
		// Service name cell covers both icon + service name so width stretches both cells
		serviceStatusHeaderRow.addItem(nameCell, { CSSStyles: { 'width': `${overviewServiceNameCellWidthPx + overviewIconColumnWidthPx}px`, 'min-width': `${overviewServiceNameCellWidthPx + overviewIconColumnWidthPx}px`, ...cssStyles.tableHeader } });
		const stateCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.stateHeader', "State"), CSSStyles: { ...cssStyles.tableHeader } }).component();
		serviceStatusHeaderRow.addItem(stateCell, { CSSStyles: { 'width': `${overviewStateCellWidthPx}px`, 'min-width': `${overviewStateCellWidthPx}px` } });
		const healthStatusCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.healthStatusHeader', "Health Status"), CSSStyles: { ...cssStyles.tableHeader } }).component();
		serviceStatusHeaderRow.addItem(healthStatusCell, { CSSStyles: { 'width': `${overviewHealthStatusCellWidthPx}px`, 'min-width': `${overviewHealthStatusCellWidthPx}px` } });
		overviewContainer.addItem(serviceStatusHeaderRow, { CSSStyles: { 'padding-left': '10px', 'box-sizing': 'border-box', 'user-select': 'text' } });

		this.serviceStatusDisplayContainer = view.modelBuilder.divContainer().component();

		// Service Status row container
		this.serviceStatusRowContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		// Note we don't give the rows container as a child of the loading component since in order to align the loading component correctly
		// messes up the layout for the row container that we display after loading is finished. Instead we just remove the loading component
		// and replace it with the rows directly
		const serviceStatusRowContainerLoadingComponent = view.modelBuilder.loadingComponent()
			.withProperties({ CSSStyles: { 'padding-top': '0px', 'padding-bottom': '0px' } })
			.component();
		this.serviceStatusRowContainer.addItem(serviceStatusRowContainerLoadingComponent, { flex: '0 0 auto', CSSStyles: { 'padding-left': '150px', width: '30px' } });

		this.serviceStatusErrorMessage = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ display: 'none', CSSStyles: { ...cssStyles.errorText } }).component();
		overviewContainer.addItem(this.serviceStatusErrorMessage);

		this.serviceStatusDisplayContainer.addItem(this.serviceStatusRowContainer);
		overviewContainer.addItem(this.serviceStatusDisplayContainer);

		rootContainer.addItem(overviewContainer, { flex: '0 0 auto' });

		// #####################
		// # SERVICE ENDPOINTS #
		// #####################

		const endpointsLabel = view.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.endpointsLabel', "Service Endpoints"), CSSStyles: { 'margin-block-start': '20px', 'margin-block-end': '0px' } })
			.component();
		rootContainer.addItem(endpointsLabel, { CSSStyles: { 'padding-left': '10px', ...cssStyles.title } });

		this.endpointsErrorMessage = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ display: 'none', CSSStyles: { ...cssStyles.errorText } }).component();

		const endpointsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%' }).component();

		// Service endpoints header row
		const endpointsHeaderRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
		const endpointsServiceNameHeaderCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.serviceHeader', "Service") }).component();
		endpointsHeaderRow.addItem(endpointsServiceNameHeaderCell, { CSSStyles: { 'width': `${serviceEndpointRowServiceNameCellWidth}px`, 'min-width': `${serviceEndpointRowServiceNameCellWidth}px`, ...cssStyles.tableHeader } });
		const endpointsEndpointHeaderCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: localize('bdc.dashboard.endpointHeader', "Endpoint") }).component();
		endpointsHeaderRow.addItem(endpointsEndpointHeaderCell, { CSSStyles: { 'width': `${serviceEndpointRowEndpointCellWidth}px`, 'min-width': `${serviceEndpointRowEndpointCellWidth}px`, ...cssStyles.tableHeader } });
		endpointsContainer.addItem(endpointsHeaderRow, { CSSStyles: { 'padding-left': '10px', 'box-sizing': 'border-box', 'user-select': 'text' } });

		this.endpointsDisplayContainer = view.modelBuilder.divContainer().component();
		this.endpointsRowContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		// Note we don't give the rows container as a child of the loading component since in order to align the loading component correctly
		// messes up the layout for the row container that we display after loading is finished. Instead we just remove the loading component
		// and replace it with the rows directly
		const endpointRowContainerLoadingComponent = view.modelBuilder.loadingComponent()
			.withProperties({ CSSStyles: { 'padding-top': '0px', 'padding-bottom': '0px' } })
			.component();
		this.endpointsRowContainer.addItem(endpointRowContainerLoadingComponent, { flex: '0 0 auto', CSSStyles: { 'padding-left': '150px', width: '30px' } });

		this.endpointsDisplayContainer.addItem(this.endpointsRowContainer);
		endpointsContainer.addItem(this.endpointsErrorMessage);
		endpointsContainer.addItem(this.endpointsDisplayContainer);
		rootContainer.addItem(endpointsContainer, { flex: '0 0 auto' });

		this.initialized = true;

		// Now that we've created the UI load data from the model in case it already had data
		this.handleEndpointsUpdate(this.model.serviceEndpoints);
		this.handleBdcStatusUpdate(this.model.bdcStatus);

		return rootContainer;
	}

	public onRefreshStarted(): void {
		this.propertiesErrorMessage.display = 'none';
		this.serviceStatusErrorMessage.display = 'none';
		this.endpointsErrorMessage.display = 'none';

		this.serviceStatusDisplayContainer.display = undefined;
		this.propertiesContainer.display = undefined;
		this.endpointsDisplayContainer.display = undefined;
	}

	private handleBdcStatusUpdate(bdcStatus?: BdcStatusModel): void {
		if (!bdcStatus) {
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
		this.endpointsRowContainer.clearItems();

		// Sort the endpoints. The sort method is that SQL Server Master is first - followed by all
		// others in alphabetical order by endpoint
		const sqlServerMasterEndpoints = endpoints.filter(e => e.name === Endpoint.sqlServerMaster);
		endpoints = endpoints.filter(e => e.name !== Endpoint.sqlServerMaster)
			.sort((e1, e2) => {
				if (e1.endpoint < e2.endpoint) { return -1; }
				if (e1.endpoint > e2.endpoint) { return 1; }
				return 0;
			});
		endpoints.unshift(...sqlServerMasterEndpoints);

		endpoints.forEach((e, i) => {
			createServiceEndpointRow(this.modelBuilder, this.endpointsRowContainer, e, this.model, hyperlinkedEndpoints.some(he => he === e.name), i === endpoints.length - 1);
		});
	}

	private handleBdcError(errorEvent: BdcErrorEvent): void {
		if (errorEvent.errorType === 'bdcEndpoints') {
			const errorMessage = localize('endpointsError', "Unexpected error retrieving BDC Endpoints: {0}", errorEvent.error.message);
			this.showEndpointsError(errorMessage);
		} else if (errorEvent.errorType === 'bdcStatus') {
			this.showBdcStatusError(getBdcStatusErrorMessage(errorEvent.error));
		} else {
			this.handleGeneralError(errorEvent.error);
		}
	}

	private showBdcStatusError(errorMessage: string): void {
		this.serviceStatusDisplayContainer.display = 'none';
		this.propertiesContainer.display = 'none';
		this.serviceStatusErrorMessage.value = errorMessage;
		this.serviceStatusErrorMessage.display = undefined;
		this.propertiesErrorMessage.value = errorMessage;
		this.propertiesErrorMessage.display = undefined;
	}

	private showEndpointsError(errorMessage: string): void {
		this.endpointsDisplayContainer.display = 'none';
		this.endpointsErrorMessage.display = undefined;
		this.endpointsErrorMessage.value = errorMessage;
	}

	private handleGeneralError(error: Error): void {
		if (error instanceof HdfsDialogCancelledError) {
			const errorMessage = localize('bdc.dashboard.noConnection', "The dashboard requires a connection. Please click retry to enter your credentials.");
			this.showBdcStatusError(errorMessage);
			this.showEndpointsError(errorMessage);
		} else {
			const errorMessage = localize('bdc.dashboard.unexpectedError', "Unexpected error occurred: {0}", error.message);
			this.showBdcStatusError(errorMessage);
			this.showEndpointsError(errorMessage);
		}
	}

	private createServiceStatusRow(container: azdata.FlexContainer, serviceStatus: ServiceStatusModel, isLastRow: boolean): void {
		const serviceStatusRow = this.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', alignItems: 'center', height: '30px' }).component();
		const statusIconCell = this.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: getHealthStatusIcon(serviceStatus.healthStatus),
				ariaRole: 'img',
				title: getHealthStatusDisplayText(serviceStatus.healthStatus),
				CSSStyles: { 'user-select': 'none' }
			}).component();
		serviceStatusRow.addItem(statusIconCell, { CSSStyles: { 'width': `${overviewIconColumnWidthPx}px`, 'min-width': `${overviewIconColumnWidthPx}px` } });
		const nameCell = this.modelBuilder.text().withProperties({ value: getServiceNameDisplayText(serviceStatus.serviceName), CSSStyles: { ...cssStyles.text, ...cssStyles.hyperlink } }).component();
		nameCell.onDidClick(() => {
			this.dashboard.switchToServiceTab(serviceStatus.serviceName);
		});
		serviceStatusRow.addItem(nameCell, { CSSStyles: { 'width': `${overviewServiceNameCellWidthPx}px`, 'min-width': `${overviewServiceNameCellWidthPx}px`, ...cssStyles.text } });
		const stateText = getStateDisplayText(serviceStatus.state);
		const stateCell = this.modelBuilder.text().withProperties({ value: stateText, title: stateText, CSSStyles: { ...cssStyles.overflowEllipsisText } }).component();
		serviceStatusRow.addItem(stateCell, { CSSStyles: { 'width': `${overviewStateCellWidthPx}px`, 'min-width': `${overviewStateCellWidthPx}px` } });
		const healthStatusText = getHealthStatusDisplayText(serviceStatus.healthStatus);
		const healthStatusCell = this.modelBuilder.text().withProperties({ value: healthStatusText, title: healthStatusText, CSSStyles: { ...cssStyles.overflowEllipsisText } }).component();
		serviceStatusRow.addItem(healthStatusCell, { CSSStyles: { 'width': `${overviewHealthStatusCellWidthPx}px`, 'min-width': `${overviewHealthStatusCellWidthPx}px` } });

		if (serviceStatus.healthStatus !== 'healthy' && serviceStatus.details && serviceStatus.details.length > 0) {
			serviceStatusRow.addItem(createViewDetailsButton(this.modelBuilder, serviceStatus.details), { flex: '0 0 auto' });
		}

		container.addItem(serviceStatusRow, { CSSStyles: { 'padding-left': '10px', 'border-top': 'solid 1px #ccc', 'border-bottom': isLastRow ? 'solid 1px #ccc' : '', 'box-sizing': 'border-box', 'user-select': 'text' } });
	}
}

function createServiceEndpointRow(modelBuilder: azdata.ModelBuilder, container: azdata.FlexContainer, endpoint: EndpointModel, bdcModel: BdcDashboardModel, isHyperlink: boolean, isLastRow: boolean): void {
	const endPointRow = modelBuilder.flexContainer().withLayout({ flexFlow: 'row', alignItems: 'center', height: '40px' }).component();
	const nameCell = modelBuilder.text().withProperties({ value: getEndpointDisplayText(endpoint.name, endpoint.description), CSSStyles: { ...cssStyles.text } }).component();
	endPointRow.addItem(nameCell, { CSSStyles: { 'width': `${serviceEndpointRowServiceNameCellWidth}px`, 'min-width': `${serviceEndpointRowServiceNameCellWidth}px`, 'text-align': 'center' } });
	if (isHyperlink) {
		const endpointCell = modelBuilder.hyperlink()
			.withProperties<azdata.HyperlinkComponentProperties>({
				label: endpoint.endpoint,
				title: endpoint.endpoint,
				url: endpoint.endpoint, CSSStyles: { 'height': '15px' }
			})
			.component();
		endPointRow.addItem(endpointCell, { CSSStyles: { 'width': `${serviceEndpointRowEndpointCellWidth}px`, 'min-width': `${serviceEndpointRowEndpointCellWidth}px`, 'overflow': 'hidden', 'text-overflow': 'ellipsis', ...cssStyles.hyperlink } });
	}
	else if (endpoint.name === Endpoint.sqlServerMaster) {
		const endpointCell = modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: endpoint.endpoint,
				title: endpoint.endpoint,
				CSSStyles: { 'overflow': 'hidden', 'text-overflow': 'ellipsis', ...cssStyles.text, ...cssStyles.hyperlink }
			})
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
		endPointRow.addItem(endpointCell, { CSSStyles: { 'width': `${serviceEndpointRowEndpointCellWidth}px`, 'min-width': `${serviceEndpointRowEndpointCellWidth}px` } });
	}
	else {
		const endpointCell = modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: endpoint.endpoint,
				title: endpoint.endpoint,
				CSSStyles: { 'overflow': 'hidden', 'text-overflow': 'ellipsis', ...cssStyles.text }
			})
			.component();
		endPointRow.addItem(endpointCell, { CSSStyles: { 'width': `${serviceEndpointRowEndpointCellWidth}px`, 'min-width': `${serviceEndpointRowEndpointCellWidth}px` } });
	}
	const copyValueCell = modelBuilder.button().withProperties<azdata.ButtonProperties>({ title: localize('bdc.dashboard.copyTitle', "Copy") }).component();
	copyValueCell.iconPath = IconPathHelper.copy;
	copyValueCell.onDidClick(() => {
		vscode.env.clipboard.writeText(endpoint.endpoint);
		vscode.window.showInformationMessage(localize('copiedEndpoint', "Endpoint '{0}' copied to clipboard", getEndpointDisplayText(endpoint.name, endpoint.description)));
	});
	copyValueCell.iconHeight = '14px';
	copyValueCell.iconWidth = '14px';
	endPointRow.addItem(copyValueCell, { CSSStyles: { 'width': '14px', 'min-width': '14px', 'padding-left': '10px', ...cssStyles.text } });

	container.addItem(endPointRow, { CSSStyles: { 'padding-left': '10px', 'border-top': 'solid 1px #ccc', 'border-bottom': isLastRow ? 'solid 1px #ccc' : '', 'box-sizing': 'border-box', 'user-select': 'text' } });
}
