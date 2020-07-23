/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../../../localizedConstants';
import { DashboardPage } from '../../components/dashboardPage';
import { IconPathHelper, cssStyles, ResourceType, Endpoints } from '../../../constants';
import { ControllerModel } from '../../../models/controllerModel';
import { promptForResourceDeletion, getDatabaseStateDisplayText } from '../../../common/utils';
import { MiaaModel } from '../../../models/miaaModel';

export class MiaaDashboardOverviewPage extends DashboardPage {

	private _propertiesLoading!: azdata.LoadingComponent;
	private _kibanaLoading!: azdata.LoadingComponent;
	private _grafanaLoading!: azdata.LoadingComponent;
	private _databasesTableLoading!: azdata.LoadingComponent;

	private _propertiesContainer!: azdata.PropertiesContainerComponent;
	private _kibanaLink!: azdata.HyperlinkComponent;
	private _grafanaLink!: azdata.HyperlinkComponent;
	private _databasesTable!: azdata.DeclarativeTableComponent;

	private _instanceProperties = {
		resourceGroup: '-',
		status: '-',
		dataController: '-',
		region: '-',
		subscriptionId: '-',
		miaaAdmin: '-',
		host: '-',
		vCores: ''
	};

	constructor(modelView: azdata.ModelView, private _controllerModel: ControllerModel, private _miaaModel: MiaaModel) {
		super(modelView);
		this._instanceProperties.miaaAdmin = this._miaaModel.username || this._instanceProperties.miaaAdmin;
		this.disposables.push(
			this._controllerModel.onRegistrationsUpdated(() => this.handleRegistrationsUpdated()),
			this._controllerModel.onEndpointsUpdated(() => this.eventuallyRunOnInitialized(() => this.handleEndpointsUpdated())),
			this._miaaModel.onStatusUpdated(() => this.eventuallyRunOnInitialized(() => this.handleMiaaStatusUpdated())),
			this._miaaModel.onDatabasesUpdated(() => this.eventuallyRunOnInitialized(() => this.handleDatabasesUpdated()))
		);
	}

	public get title(): string {
		return loc.overview;
	}

	public get id(): string {
		return 'miaa-overview';
	}

	public get icon(): { dark: string, light: string } {
		return IconPathHelper.properties;
	}

	protected async refresh(): Promise<void> {
		await Promise.all([this._controllerModel.refresh(), this._miaaModel.refresh()]);
	}

	public get container(): azdata.Component {
		// Create loaded components
		this._propertiesContainer = this.modelView.modelBuilder.propertiesContainer().component();
		this._propertiesLoading = this.modelView.modelBuilder.loadingComponent().component();

		this._kibanaLink = this.modelView.modelBuilder.hyperlink().component();
		this._kibanaLoading = this.modelView.modelBuilder.loadingComponent().component();

		this._grafanaLink = this.modelView.modelBuilder.hyperlink().component();
		this._grafanaLoading = this.modelView.modelBuilder.loadingComponent().component();

		this._databasesTableLoading = this.modelView.modelBuilder.loadingComponent().component();
		this._databasesTable = this.modelView.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			width: '100%',
			columns: [
				{
					displayName: loc.name,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '80%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.status,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '20%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			data: []
		}).component();

		// Update loaded components with data
		this.handleRegistrationsUpdated();
		this.handleMiaaStatusUpdated();
		this.handleEndpointsUpdated();
		this.handleDatabasesUpdated();

		// Assign the loading component after it has data
		this._propertiesLoading.component = this._propertiesContainer;
		this._kibanaLoading.component = this._kibanaLink;
		this._grafanaLoading.component = this._grafanaLink;
		this._databasesTableLoading.component = this._databasesTable;

		// Assemble the container
		const rootContainer = this.modelView.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withProperties({ CSSStyles: { 'margin': '18px' } })
			.component();

		// Properties
		rootContainer.addItem(this._propertiesLoading, { CSSStyles: cssStyles.text });

		// Service endpoints
		const titleCSS = { ...cssStyles.title, 'margin-block-start': '2em', 'margin-block-end': '0' };
		rootContainer.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: loc.serviceEndpoints, CSSStyles: titleCSS }).component());

		const endpointsTable = this.modelView.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			width: '100%',
			columns: [
				{
					displayName: loc.name,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '20%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.endpoint,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: '50%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: {
						...cssStyles.tableRow,
						'overflow': 'hidden',
						'text-overflow': 'ellipsis',
						'white-space': 'nowrap',
						'max-width': '0'
					}
				},
				{
					displayName: loc.description,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '30%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			data: [
				[loc.kibanaDashboard, this._kibanaLoading, loc.kibanaDashboardDescription],
				[loc.grafanaDashboard, this._grafanaLoading, loc.grafanaDashboardDescription]]
		}).component();

		rootContainer.addItem(endpointsTable);

		// Databases
		rootContainer.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: loc.databases, CSSStyles: titleCSS }).component());
		rootContainer.addItem(this._databasesTableLoading, { CSSStyles: { 'margin-bottom': '20px' } });

		this.initialized = true;
		return rootContainer;
	}

	public get toolbarContainer(): azdata.ToolbarContainer {

		const deleteButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.deleteText,
			iconPath: IconPathHelper.delete
		}).component();

		this.disposables.push(
			deleteButton.onDidClick(async () => {
				deleteButton.enabled = false;
				try {
					if (await promptForResourceDeletion(this._miaaModel.info.namespace, this._miaaModel.info.name)) {
						await this._controllerModel.miaaDelete(this._miaaModel.info.namespace, this._miaaModel.info.name);
						vscode.window.showInformationMessage(loc.resourceDeleted(this._miaaModel.info.name));
					}
				} catch (error) {
					vscode.window.showErrorMessage(loc.resourceDeletionFailed(this._miaaModel.info.name, error));
				} finally {
					deleteButton.enabled = true;
				}
			}));

		// Refresh
		const refreshButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.refresh,
			iconPath: IconPathHelper.refresh
		}).component();

		this.disposables.push(
			refreshButton.onDidClick(async () => {
				refreshButton.enabled = false;
				try {
					this._propertiesLoading!.loading = true;
					this._kibanaLoading!.loading = true;
					this._grafanaLoading!.loading = true;
					this._databasesTableLoading!.loading = true;

					await this.refresh();
				} finally {
					refreshButton.enabled = true;
				}
			}));

		const openInAzurePortalButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.openInAzurePortal,
			iconPath: IconPathHelper.openInTab
		}).component();

		this.disposables.push(
			openInAzurePortalButton.onDidClick(async () => {
				const r = this._controllerModel.getRegistration(ResourceType.sqlManagedInstances, this._miaaModel.info.namespace, this._miaaModel.info.name);
				if (r) {
					vscode.env.openExternal(vscode.Uri.parse(
						`https://portal.azure.com/#resource/subscriptions/${r.subscriptionId}/resourceGroups/${r.resourceGroupName}/providers/Microsoft.AzureData/${ResourceType.sqlManagedInstances}/${r.instanceName}`));
				} else {
					vscode.window.showErrorMessage(loc.couldNotFindRegistration(this._miaaModel.info.namespace, this._miaaModel.info.name));
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems(
			[
				{ component: deleteButton },
				{ component: refreshButton, toolbarSeparatorAfter: true },
				{ component: openInAzurePortalButton }
			]
		).component();
	}

	private handleRegistrationsUpdated(): void {
		const reg = this._controllerModel.getRegistration(ResourceType.sqlManagedInstances, this._miaaModel.info.namespace, this._miaaModel.info.name);
		if (reg) {
			this._instanceProperties.resourceGroup = reg.resourceGroupName || '-';
			this._instanceProperties.dataController = this._controllerModel.controllerRegistration?.instanceName || '-';
			this._instanceProperties.region = reg.region || '-';
			this._instanceProperties.subscriptionId = reg.subscriptionId || '-';
			this._instanceProperties.vCores = reg.vCores || '';
			this._instanceProperties.host = reg.externalEndpoint || '-';
			this.refreshDisplayedProperties();
		}
	}

	private handleMiaaStatusUpdated(): void {
		this._instanceProperties.status = this._miaaModel.status;
		this.refreshDisplayedProperties();
	}

	private handleEndpointsUpdated(): void {
		const kibanaEndpoint = this._controllerModel.getEndpoint(Endpoints.logsui);
		const kibanaQuery = `kubernetes_namespace:"${this._miaaModel.info.namespace}" and instance_name :"${this._miaaModel.info.name}"`;
		const kibanaUrl = kibanaEndpoint ? `${kibanaEndpoint.endpoint}/app/kibana#/discover?_a=(query:(language:kuery,query:'${kibanaQuery}'))` : '';
		this._kibanaLink.label = kibanaUrl;
		this._kibanaLink.url = kibanaUrl;

		const grafanaEndpoint = this._controllerModel.getEndpoint(Endpoints.metricsui);
		const grafanaQuery = `var-hostname=${this._miaaModel.info.name}-0`;
		const grafanaUrl = grafanaEndpoint ? `${grafanaEndpoint.endpoint}/d/wZx3OUdmz/azure-sql-db-managed-instance-metrics?${grafanaQuery}` : '';
		this._grafanaLink.label = grafanaUrl;
		this._grafanaLink.url = grafanaUrl;

		this._kibanaLoading!.loading = !this._controllerModel.endpointsLastUpdated;
		this._grafanaLoading!.loading = !this._controllerModel.endpointsLastUpdated;
	}

	private handleDatabasesUpdated(): void {
		// If we were able to get the databases it means we have a good connection so update the username too
		this._instanceProperties.miaaAdmin = this._miaaModel.username || this._instanceProperties.miaaAdmin;
		this.refreshDisplayedProperties();
		this._databasesTable.data = this._miaaModel.databases.map(d => [d.name, getDatabaseStateDisplayText(d.status)]);
		this._databasesTableLoading.loading = !this._miaaModel.databasesLastUpdated;
	}

	private refreshDisplayedProperties(): void {
		this._propertiesContainer.propertyItems = [
			{
				displayName: loc.resourceGroup,
				value: this._instanceProperties.resourceGroup
			},
			{
				displayName: loc.status,
				value: this._instanceProperties.status
			},
			{
				displayName: loc.dataController,
				value: this._instanceProperties.dataController
			},
			{
				displayName: loc.region,
				value: this._instanceProperties.region
			},
			{
				displayName: loc.subscriptionId,
				value: this._instanceProperties.subscriptionId
			},
			{
				displayName: loc.miaaAdmin,
				value: this._instanceProperties.miaaAdmin
			},
			{
				displayName: loc.host,
				value: this._instanceProperties.host
			},
			{
				displayName: loc.compute,
				value: loc.numVCores(this._instanceProperties.vCores)
			}
		];

		this._propertiesLoading.loading =
			!this._controllerModel.registrationsLastUpdated &&
			!this._miaaModel.statusLastUpdated &&
			!this._miaaModel.databasesLastUpdated;
	}
}
