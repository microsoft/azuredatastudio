/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as azdataExt from 'azdata-ext';
import * as azurecore from 'azurecore';
import * as vscode from 'vscode';
import { getDatabaseStateDisplayText, promptForInstanceDeletion } from '../../../common/utils';
import { cssStyles, IconPathHelper, miaaTroubleshootDocsUrl } from '../../../constants';
import * as loc from '../../../localizedConstants';
import { ControllerModel } from '../../../models/controllerModel';
import { MiaaModel } from '../../../models/miaaModel';
import { DashboardPage } from '../../components/dashboardPage';
import { ResourceType } from 'arc';
import { UserCancelledError } from '../../../common/api';

export class MiaaDashboardOverviewPage extends DashboardPage {

	private _propertiesLoading!: azdata.LoadingComponent;
	private _kibanaLoading!: azdata.LoadingComponent;
	private _grafanaLoading!: azdata.LoadingComponent;

	private _propertiesContainer!: azdata.PropertiesContainerComponent;
	private _kibanaLink!: azdata.HyperlinkComponent;
	private _grafanaLink!: azdata.HyperlinkComponent;
	private _databasesTable!: azdata.DeclarativeTableComponent;
	private _databasesMessage!: azdata.TextComponent;
	private _openInAzurePortalButton!: azdata.ButtonComponent;

	private _databasesContainer!: azdata.DivContainer;
	private _connectToServerLoading!: azdata.LoadingComponent;
	private _connectToServerButton!: azdata.ButtonComponent;
	private _databasesTableLoading!: azdata.LoadingComponent;

	private readonly _azdataApi: azdataExt.IExtension;
	private readonly _azurecoreApi: azurecore.IExtension;

	private _instanceProperties = {
		resourceGroup: '-',
		status: '-',
		dataController: '-',
		region: '-',
		subscriptionId: '-',
		miaaAdmin: '-',
		externalEndpoint: '-',
		vCores: ''
	};

	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _controllerModel: ControllerModel, private _miaaModel: MiaaModel) {
		super(modelView, dashboard);
		this._azdataApi = vscode.extensions.getExtension(azdataExt.extension.name)?.exports;
		this._azurecoreApi = vscode.extensions.getExtension(azurecore.extension.name)?.exports;

		this._instanceProperties.miaaAdmin = this._miaaModel.username || this._instanceProperties.miaaAdmin;
		this.disposables.push(
			this._controllerModel.onRegistrationsUpdated(() => this.handleRegistrationsUpdated()),
			this._controllerModel.onEndpointsUpdated(() => this.eventuallyRunOnInitialized(() => this.refreshDashboardLinks())),
			this._miaaModel.onConfigUpdated(() => this.eventuallyRunOnInitialized(() => this.handleMiaaConfigUpdated())),
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

		this._databasesContainer = this.modelView.modelBuilder.divContainer().component();

		const connectToServerText = this.modelView.modelBuilder.text().withProps({
			value: loc.miaaConnectionRequired
		}).component();

		this._connectToServerButton = this.modelView.modelBuilder.button().withProps({
			label: loc.connectToServer,
			enabled: false,
			CSSStyles: { 'max-width': '125px', 'margin-left': '40%' }
		}).component();

		const connectToServerContainer = this.modelView.modelBuilder.divContainer().component();


		connectToServerContainer.addItem(connectToServerText, { CSSStyles: { 'text-align': 'center', 'margin-top': '20px' } });
		connectToServerContainer.addItem(this._connectToServerButton);

		this._connectToServerLoading = this.modelView.modelBuilder.loadingComponent().withItem(connectToServerContainer).component();

		this._databasesContainer.addItem(this._connectToServerLoading, { CSSStyles: { 'margin-top': '20px' } });

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
			dataValues: []
		}).component();

		this._databasesMessage = this.modelView.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ CSSStyles: { 'text-align': 'center' } })
			.component();

		// Update loaded components with data
		this.handleRegistrationsUpdated();
		this.handleMiaaConfigUpdated();
		this.refreshDashboardLinks();
		this.handleDatabasesUpdated();

		// Assign the loading component after it has data
		this._propertiesLoading.component = this._propertiesContainer;
		this._kibanaLoading.component = this._kibanaLink;
		this._grafanaLoading.component = this._grafanaLink;
		this._databasesTableLoading.component = this._databasesTable;

		// Assemble the container
		const rootContainer = this.modelView.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withProps({ CSSStyles: { 'margin': '18px' } })
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
			dataValues: [
				[{ value: loc.kibanaDashboard }, { value: this._kibanaLoading }, { value: loc.kibanaDashboardDescription }],
				[{ value: loc.grafanaDashboard }, { value: this._grafanaLoading }, { value: loc.grafanaDashboardDescription }]]
		}).component();

		rootContainer.addItem(endpointsTable);

		// Databases
		rootContainer.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: loc.databases, CSSStyles: titleCSS }).component());
		this.disposables.push(
			this._connectToServerButton!.onDidClick(async () => {
				this._connectToServerButton!.enabled = false;
				this._databasesTableLoading!.loading = true;
				try {
					await this.callGetDatabases();
				} catch {
					this._connectToServerButton!.enabled = true;
				}
			})
		);
		rootContainer.addItem(this._databasesContainer);
		rootContainer.addItem(this._databasesMessage);

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
					if (await promptForInstanceDeletion(this._miaaModel.info.name)) {
						await vscode.window.withProgress(
							{
								location: vscode.ProgressLocation.Notification,
								title: loc.deletingInstance(this._miaaModel.info.name),
								cancellable: false
							},
							async (_progress, _token) => {
								return await this._azdataApi.azdata.arc.sql.mi.delete(this._miaaModel.info.name, this._controllerModel.azdataAdditionalEnvVars, this._controllerModel.controllerContext);
							}
						);
						await this._controllerModel.refreshTreeNode();
						vscode.window.showInformationMessage(loc.instanceDeleted(this._miaaModel.info.name));
						try {
							await this.dashboard.close();
						} catch (err) {
							// Failures closing the dashboard aren't something we need to show users
							console.log('Error closing MIAA dashboard ', err);
						}

					}
				} catch (error) {
					vscode.window.showErrorMessage(loc.instanceDeletionFailed(this._miaaModel.info.name, error));
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

		this._openInAzurePortalButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.openInAzurePortal,
			iconPath: IconPathHelper.openInTab,
			enabled: !!this._controllerModel.controllerConfig
		}).component();

		this.disposables.push(
			this._openInAzurePortalButton.onDidClick(async () => {
				const config = this._controllerModel.controllerConfig;
				if (config) {
					vscode.env.openExternal(vscode.Uri.parse(
						`https://portal.azure.com/#resource/subscriptions/${config.spec.settings.azure.subscription}/resourceGroups/${config.spec.settings.azure.resourceGroup}/providers/Microsoft.AzureArcData/${ResourceType.sqlManagedInstances}/${this._miaaModel.info.name}`));
				} else {
					vscode.window.showErrorMessage(loc.couldNotFindControllerRegistration);
				}
			}));

		const troubleshootButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.troubleshoot,
			iconPath: IconPathHelper.wrench
		}).component();

		this.disposables.push(
			troubleshootButton.onDidClick(async () => {
				await vscode.env.openExternal(vscode.Uri.parse(miaaTroubleshootDocsUrl));
			})
		);

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems(
			[
				{ component: deleteButton },
				{ component: refreshButton, toolbarSeparatorAfter: true },
				{ component: this._openInAzurePortalButton }
			]
		).component();
	}

	private async callGetDatabases(): Promise<void> {
		try {
			await this._miaaModel.getDatabases();
		} catch (error) {
			if (error instanceof UserCancelledError) {
				vscode.window.showWarningMessage(loc.miaaConnectionRequired);
			} else {
				vscode.window.showErrorMessage(loc.fetchDatabasesFailed(this._miaaModel.info.name, error));
			}
			throw error;
		}
	}

	private handleRegistrationsUpdated(): void {
		const config = this._controllerModel.controllerConfig;
		if (this._openInAzurePortalButton) {
			this._openInAzurePortalButton.enabled = !!config;
		}
		this._instanceProperties.resourceGroup = config?.spec.settings.azure.resourceGroup || this._instanceProperties.resourceGroup;
		this._instanceProperties.dataController = config?.metadata.name || this._instanceProperties.dataController;
		this._instanceProperties.region = this._azurecoreApi.getRegionDisplayName(config?.spec.settings.azure.location) || this._instanceProperties.region;
		this._instanceProperties.subscriptionId = config?.spec.settings.azure.subscription || this._instanceProperties.subscriptionId;
		this.refreshDisplayedProperties();
	}

	private handleMiaaConfigUpdated(): void {
		if (this._miaaModel.config) {
			this._instanceProperties.status = this._miaaModel.config.status.state || '-';
			this._instanceProperties.externalEndpoint = this._miaaModel.config.status.primaryEndpoint || loc.notConfigured;
			this._instanceProperties.vCores = this._miaaModel.config.spec.scheduling?.default?.resources?.limits?.cpu?.toString() || '';
			this._databasesMessage.value = !this._miaaModel.config.status.primaryEndpoint ? loc.noExternalEndpoint : '';
			if (!this._miaaModel.config.status.primaryEndpoint) {
				this._databasesContainer.removeItem(this._connectToServerLoading);
			}
		}

		this.refreshDisplayedProperties();
		this.refreshDashboardLinks();
	}

	private handleDatabasesUpdated(): void {
		// If we were able to get the databases it means we have a good connection so update the username too
		this._instanceProperties.miaaAdmin = this._miaaModel.username || this._instanceProperties.miaaAdmin;
		this.refreshDisplayedProperties();
		let databaseDisplayText = this._miaaModel.databases.map(d => [d.name, getDatabaseStateDisplayText(d.status)]);
		let databasesTextValues = databaseDisplayText.map(d => {
			return d.map((value): azdata.DeclarativeTableCellValue => {
				return { value: value };
			});
		});
		this._databasesTable.setDataValues(databasesTextValues);
		this._databasesTableLoading.loading = false;

		if (this._miaaModel.databasesLastUpdated) {
			// We successfully connected so now can remove the button and replace it with the actual databases table
			this._databasesContainer.removeItem(this._connectToServerLoading);
			this._databasesContainer.addItem(this._databasesTableLoading, { CSSStyles: { 'margin-bottom': '20px' } });
		} else {
			// If we don't have an endpoint then there's no point in showing the connect button - but the logic
			// to display text informing the user of this is already handled by the handleMiaaConfigUpdated
			if (this._miaaModel?.config?.status.primaryEndpoint) {
				this._connectToServerLoading.loading = false;
				this._connectToServerButton.enabled = true;
			}
		}
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
				displayName: loc.externalEndpoint,
				value: this._instanceProperties.externalEndpoint
			},
			{
				displayName: loc.compute,
				value: loc.numVCores(this._instanceProperties.vCores)
			}
		];

		this._propertiesLoading.loading =
			!this._controllerModel.registrationsLastUpdated &&
			!this._miaaModel.configLastUpdated &&
			!this._miaaModel.databasesLastUpdated;
	}

	private refreshDashboardLinks(): void {
		if (this._miaaModel.config) {
			const kibanaUrl = this._miaaModel.config.status.logSearchDashboard ?? '';
			this._kibanaLink.label = kibanaUrl;
			this._kibanaLink.url = kibanaUrl;
			this._kibanaLoading!.loading = false;

			const grafanaUrl = this._miaaModel.config.status.metricsDashboard ?? '';
			this._grafanaLink.label = grafanaUrl;
			this._grafanaLink.url = grafanaUrl;
			this._grafanaLoading!.loading = false;
		}
	}
}
