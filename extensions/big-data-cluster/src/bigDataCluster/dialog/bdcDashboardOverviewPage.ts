/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { BdcDashboardModel, BdcErrorEvent } from './bdcDashboardModel';
import { IconPathHelper, cssStyles } from '../constants';
import { getStateDisplayText, getHealthStatusDisplayText, getEndpointDisplayText, getHealthStatusIcon, getServiceNameDisplayText, Endpoint, getBdcStatusErrorMessage } from '../utils';
import { EndpointModel, BdcStatusModel } from '../controller/apiGenerated';
import { createViewDetailsButton } from './commonControls';
import { HdfsDialogCancelledError } from './hdfsDialogBase';
import { BdcDashboardPage } from './bdcDashboardPage';
import * as loc from '../localizedConstants';

const hyperlinkedEndpoints = [Endpoint.metricsui, Endpoint.logsui, Endpoint.sparkHistory, Endpoint.yarnUi];

export class BdcDashboardOverviewPage extends BdcDashboardPage {
	private rootContainer: azdata.FlexContainer;
	private lastUpdatedLabel: azdata.TextComponent;
	private propertiesContainerLoadingComponent: azdata.LoadingComponent;

	private serviceStatusTable: azdata.DeclarativeTableComponent;
	private endpointsTable: azdata.DeclarativeTableComponent;
	private endpointsLoadingComponent: azdata.LoadingComponent;
	private endpointsDisplayContainer: azdata.FlexContainer;
	private serviceStatusLoadingComponent: azdata.LoadingComponent;
	private serviceStatusDisplayContainer: azdata.FlexContainer;
	private propertiesErrorMessage: azdata.TextComponent;
	private endpointsErrorMessage: azdata.TextComponent;
	private serviceStatusErrorMessage: azdata.TextComponent;

	constructor(model: BdcDashboardModel, modelView: azdata.ModelView, private dashboard: azdata.window.ModelViewDashboard) {
		super(model, modelView);
		this.model.onDidUpdateEndpoints(endpoints => this.eventuallyRunOnInitialized(() => this.handleEndpointsUpdate(endpoints)));
		this.model.onDidUpdateBdcStatus(bdcStatus => this.eventuallyRunOnInitialized(() => this.handleBdcStatusUpdate(bdcStatus)));
		this.model.onBdcError(error => this.eventuallyRunOnInitialized(() => this.handleBdcError(error)));
	}

	public get container(): azdata.FlexContainer {
		// Lazily create the container only when needed
		if (!this.rootContainer) {
			this.rootContainer = this.createContainer();
		}
		return this.rootContainer;
	}

	public createContainer(): azdata.FlexContainer {
		const rootContainer = this.modelView.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'column',
				width: '100%',
				height: '100%'
			}).component();

		// ##############
		// # PROPERTIES #
		// ##############

		const propertiesLabel = this.modelView.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: loc.clusterProperties, CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '10px' } })
			.component();
		rootContainer.addItem(propertiesLabel, { CSSStyles: { 'margin-top': '15px', 'padding-left': '10px', ...cssStyles.title } });

		const propertiesContainer = this.modelView.modelBuilder.propertiesContainer().component();

		this.propertiesContainerLoadingComponent = this.modelView.modelBuilder.loadingComponent().withItem(propertiesContainer).component();
		rootContainer.addItem(this.propertiesContainerLoadingComponent, { flex: '0 0 auto', CSSStyles: { 'padding-left': '10px' } });

		// ############
		// # OVERVIEW #
		// ############

		const overviewHeaderContainer = this.modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', height: '20px' }).component();
		rootContainer.addItem(overviewHeaderContainer, { CSSStyles: { 'padding-left': '10px', 'padding-top': '15px' } });

		const overviewLabel = this.modelView.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: loc.clusterOverview,
				CSSStyles: { ...cssStyles.text }
			})
			.component();

		overviewHeaderContainer.addItem(overviewLabel, { CSSStyles: { ...cssStyles.title } });

		this.lastUpdatedLabel = this.modelView.modelBuilder.text()
			.withProperties({
				value: loc.lastUpdated(),
				CSSStyles: { ...cssStyles.lastUpdatedText }
			}).component();

		overviewHeaderContainer.addItem(this.lastUpdatedLabel, { CSSStyles: { 'margin-left': '45px' } });

		const overviewContainer = this.modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%' }).component();

		this.serviceStatusTable = this.modelView.modelBuilder.declarativeTable()
			.withProperties<azdata.DeclarativeTableProperties>(
				{
					columns: [
						{ // status icon
							displayName: '',
							ariaLabel: loc.statusIcon,
							valueType: azdata.DeclarativeDataType.component,
							isReadOnly: true,
							width: 25,
							headerCssStyles: {
								'border': 'none'
							},
							rowCssStyles: {
								'border-top': 'solid 1px #ccc',
								'border-bottom': 'solid 1px #ccc',
								'border-left': 'none',
								'border-right': 'none'
							},
						},
						{ // service
							displayName: loc.serviceName,
							valueType: azdata.DeclarativeDataType.component,
							isReadOnly: true,
							width: 175,
							headerCssStyles: {
								'border': 'none',
								...cssStyles.tableHeader
							},
							rowCssStyles: {
								'border-top': 'solid 1px #ccc',
								'border-bottom': 'solid 1px #ccc',
								'border-left': 'none',
								'border-right': 'none'
							},
						},
						{ // state
							displayName: loc.state,
							valueType: azdata.DeclarativeDataType.string,
							isReadOnly: true,
							width: 150,
							headerCssStyles: {
								'border': 'none',
								...cssStyles.tableHeader
							},
							rowCssStyles: {
								'border-top': 'solid 1px #ccc',
								'border-bottom': 'solid 1px #ccc',
								'border-left': 'none',
								'border-right': 'none'
							},
						},
						{ // health status
							displayName: loc.healthStatus,
							valueType: azdata.DeclarativeDataType.string,
							isReadOnly: true,
							width: 100,
							headerCssStyles: {
								'border': 'none',
								'text-align': 'left',
								...cssStyles.tableHeader
							},
							rowCssStyles: {
								'border-top': 'solid 1px #ccc',
								'border-bottom': 'solid 1px #ccc',
								'border-left': 'none',
								'border-right': 'none'
							}
						},
						{ // view details button
							displayName: '',
							ariaLabel: loc.viewErrorDetails,
							valueType: azdata.DeclarativeDataType.component,
							isReadOnly: true,
							width: 150,
							headerCssStyles: {
								'border': 'none',
							},
							rowCssStyles: {
								'border-top': 'solid 1px #ccc',
								'border-bottom': 'solid 1px #ccc',
								'border-left': 'none',
								'border-right': 'none'
							},
						},
					],
					data: [],
					ariaLabel: loc.clusterOverview
				})
			.component();

		this.serviceStatusDisplayContainer = this.modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		this.serviceStatusDisplayContainer.addItem(this.serviceStatusTable);

		// Note we don't make the table a child of the loading component since making the loading component align correctly
		// messes up the layout for the table that we display after loading is finished. Instead we'll just remove the loading
		// component once it's finished loading the content
		this.serviceStatusLoadingComponent = this.modelView.modelBuilder.loadingComponent()
			.withProperties({ CSSStyles: { 'padding-top': '0px', 'padding-bottom': '0px' } })
			.component();

		this.serviceStatusDisplayContainer.addItem(this.serviceStatusLoadingComponent, { flex: '0 0 auto', CSSStyles: { 'padding-left': '150px', width: '30px' } });

		this.serviceStatusErrorMessage = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ display: 'none', CSSStyles: { ...cssStyles.errorText } }).component();
		overviewContainer.addItem(this.serviceStatusErrorMessage);

		overviewContainer.addItem(this.serviceStatusDisplayContainer);

		rootContainer.addItem(overviewContainer, { flex: '0 0 auto' });

		// #####################
		// # SERVICE ENDPOINTS #
		// #####################

		const endpointsLabel = this.modelView.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: loc.serviceEndpoints, CSSStyles: { 'margin-block-start': '20px', 'margin-block-end': '0px' } })
			.component();
		rootContainer.addItem(endpointsLabel, { CSSStyles: { 'padding-left': '10px', ...cssStyles.title } });

		this.endpointsErrorMessage = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ display: 'none', CSSStyles: { ...cssStyles.errorText } }).component();

		const endpointsContainer = this.modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%' }).component();

		this.endpointsTable = this.modelView.modelBuilder.declarativeTable()
			.withProperties<azdata.DeclarativeTableProperties>(
				{
					columns: [
						{ // service
							displayName: loc.service,
							valueType: azdata.DeclarativeDataType.string,
							isReadOnly: true,
							width: 200,
							headerCssStyles: {
								'border': 'none',
								...cssStyles.tableHeader
							},
							rowCssStyles: {
								'border-top': 'solid 1px #ccc',
								'border-bottom': 'solid 1px #ccc',
								'border-left': 'none',
								'border-right': 'none'
							},
						},
						{ // endpoint
							displayName: loc.endpoint,
							valueType: azdata.DeclarativeDataType.component,
							isReadOnly: true,
							width: 350,
							headerCssStyles: {
								'border': 'none',
								...cssStyles.tableHeader
							},
							rowCssStyles: {
								'border-top': 'solid 1px #ccc',
								'border-bottom': 'solid 1px #ccc',
								'border-left': 'none',
								'border-right': 'none',
								'overflow': 'hidden',
								'text-overflow': 'ellipsis'
							},
						},
						{ // copy
							displayName: '',
							ariaLabel: loc.copy,
							valueType: azdata.DeclarativeDataType.component,
							isReadOnly: true,
							width: 50,
							headerCssStyles: {
								'border': 'none',
							},
							rowCssStyles: {
								'border-top': 'solid 1px #ccc',
								'border-bottom': 'solid 1px #ccc',
								'border-left': 'none',
								'border-right': 'none'
							}
						}
					],
					data: [],
					ariaLabel: loc.serviceEndpoints
				}).component();

		this.endpointsDisplayContainer = this.modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		this.endpointsDisplayContainer.addItem(this.endpointsTable);

		// Note we don't make the table a child of the loading component since making the loading component align correctly
		// messes up the layout for the table that we display after loading is finished. Instead we'll just remove the loading
		// component once it's finished loading the content
		this.endpointsLoadingComponent = this.modelView.modelBuilder.loadingComponent()
			.withProperties({ CSSStyles: { 'padding-top': '0px', 'padding-bottom': '0px' } })
			.component();
		this.endpointsDisplayContainer.addItem(this.endpointsLoadingComponent, { flex: '0 0 auto', CSSStyles: { 'padding-left': '150px', width: '30px' } });

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
		this.propertiesContainerLoadingComponent.display = undefined;
		this.endpointsDisplayContainer.display = undefined;
	}

	private handleBdcStatusUpdate(bdcStatus?: BdcStatusModel): void {
		if (!bdcStatus) {
			return;
		}
		this.lastUpdatedLabel.value = loc.lastUpdated(this.model.bdcStatusLastUpdated);

		this.propertiesContainerLoadingComponent.loading = false;

		(<azdata.PropertiesContainerComponentProperties>this.propertiesContainerLoadingComponent.component).propertyItems = [
			{ displayName: loc.clusterState, value: getStateDisplayText(bdcStatus.state) },
			{ displayName: loc.healthStatus, value: getHealthStatusDisplayText(bdcStatus.healthStatus) }
		];

		if (bdcStatus.services) {
			this.serviceStatusTable.data = bdcStatus.services.map(serviceStatus => {
				const statusIconCell = this.modelView.modelBuilder.text()
					.withProperties<azdata.TextComponentProperties>({
						value: getHealthStatusIcon(serviceStatus.healthStatus),
						ariaRole: 'img',
						title: getHealthStatusDisplayText(serviceStatus.healthStatus),
						CSSStyles: { 'user-select': 'none', ...cssStyles.text }
					}).component();
				const nameCell = this.modelView.modelBuilder.hyperlink()
					.withProperties<azdata.HyperlinkComponentProperties>({
						label: getServiceNameDisplayText(serviceStatus.serviceName),
						url: '',
						CSSStyles: { ...cssStyles.text }
					}).component();
				nameCell.onDidClick(() => {
					this.dashboard.selectTab(serviceStatus.serviceName);
				});

				const viewDetailsButton = serviceStatus.healthStatus !== 'healthy' && serviceStatus.details && serviceStatus.details.length > 0 ? createViewDetailsButton(this.modelView.modelBuilder, serviceStatus.details) : undefined;
				return [
					statusIconCell,
					nameCell,
					getStateDisplayText(serviceStatus.state),
					getHealthStatusDisplayText(serviceStatus.healthStatus),
					viewDetailsButton];
			});
			this.serviceStatusDisplayContainer.removeItem(this.serviceStatusLoadingComponent);
		}
	}

	private handleEndpointsUpdate(endpoints?: EndpointModel[]): void {
		if (!endpoints) {
			return;
		}
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

		this.endpointsTable.data = endpoints.map(e => {
			const copyValueCell = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({ title: loc.copy }).component();
			copyValueCell.iconPath = IconPathHelper.copy;
			copyValueCell.onDidClick(() => {
				vscode.env.clipboard.writeText(e.endpoint);
				vscode.window.showInformationMessage(loc.copiedEndpoint(getEndpointDisplayText(e.name, e.description)));
			});
			copyValueCell.iconHeight = '14px';
			copyValueCell.iconWidth = '14px';
			return [getEndpointDisplayText(e.name, e.description),
			createEndpointComponent(this.modelView.modelBuilder, e, this.model, hyperlinkedEndpoints.some(he => he === e.name)),
				copyValueCell];
		});

		this.endpointsDisplayContainer.removeItem(this.endpointsLoadingComponent);
	}

	private handleBdcError(errorEvent: BdcErrorEvent): void {
		if (errorEvent.errorType === 'bdcEndpoints') {
			const errorMessage = loc.endpointsError(errorEvent.error.message);
			this.showEndpointsError(errorMessage);
		} else if (errorEvent.errorType === 'bdcStatus') {
			this.showBdcStatusError(getBdcStatusErrorMessage(errorEvent.error));
		} else {
			this.handleGeneralError(errorEvent.error);
		}
	}

	private showBdcStatusError(errorMessage: string): void {
		this.serviceStatusDisplayContainer.display = 'none';
		this.propertiesContainerLoadingComponent.display = 'none';
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
			const errorMessage = loc.noConnectionError;
			this.showBdcStatusError(errorMessage);
			this.showEndpointsError(errorMessage);
		} else {
			const errorMessage = loc.unexpectedError(error);
			this.showBdcStatusError(errorMessage);
			this.showEndpointsError(errorMessage);
		}
	}
}

function createEndpointComponent(modelBuilder: azdata.ModelBuilder, endpoint: EndpointModel, bdcModel: BdcDashboardModel, isHyperlink: boolean): azdata.HyperlinkComponent | azdata.TextComponent {
	if (isHyperlink) {
		return modelBuilder.hyperlink()
			.withProperties<azdata.HyperlinkComponentProperties>({
				label: endpoint.endpoint,
				title: endpoint.endpoint,
				url: endpoint.endpoint
			})
			.component();
	}
	else if (endpoint.name === Endpoint.sqlServerMaster) {
		const endpointCell = modelBuilder.hyperlink()
			.withProperties<azdata.HyperlinkComponentProperties>({
				title: endpoint.endpoint,
				label: endpoint.endpoint,
				url: '',
				CSSStyles: { ...cssStyles.text }
			}).component();
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
		return endpointCell;
	}
	else {
		return modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: endpoint.endpoint,
				title: endpoint.endpoint,
				CSSStyles: { ...cssStyles.text }
			})
			.component();
	}
}
