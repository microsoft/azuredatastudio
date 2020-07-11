/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../../../localizedConstants';
import { DashboardPage } from '../../components/dashboardPage';
import { IconPathHelper, cssStyles, iconSize, ResourceType, Endpoints } from '../../../constants';
import { ControllerModel } from '../../../models/controllerModel';
import { resourceTypeToDisplayName, getResourceTypeIcon, getConnectionModeDisplayText, parseInstanceName } from '../../../common/utils';

export class ControllerDashboardOverviewPage extends DashboardPage {

	private _propertiesLoadingComponent!: azdata.LoadingComponent;
	private _arcResourcesLoadingComponent!: azdata.LoadingComponent;

	private _arcResourcesTable!: azdata.DeclarativeTableComponent;
	private _propertiesContainer!: azdata.PropertiesContainerComponent;

	private controllerProperties = {
		instanceName: '-',
		resourceGroupName: '-',
		location: '-',
		subscriptionId: '-',
		controllerEndpoint: '-',
		connectionMode: '-',
		instanceNamespace: '-',
	};

	constructor(modelView: azdata.ModelView, private _controllerModel: ControllerModel) {
		super(modelView);

		this.disposables.push(
			this._controllerModel.onRegistrationsUpdated(() => this.eventuallyRunOnInitialized(() => this.handleRegistrationsUpdated())),
			this._controllerModel.onEndpointsUpdated(() => this.eventuallyRunOnInitialized(() => this.handleEndpointsUpdated())));
	}

	public get title(): string {
		return loc.overview;
	}

	public get id(): string {
		return 'controller-overview';
	}

	public get icon(): { dark: string, light: string } {
		return IconPathHelper.properties;
	}

	protected async refresh(): Promise<void> {
		await this._controllerModel.refresh();
	}

	public get container(): azdata.Component {
		// Create loaded components
		this._propertiesContainer = this.modelView.modelBuilder.propertiesContainer().component();
		this._propertiesLoadingComponent = this.modelView.modelBuilder.loadingComponent().component();

		this._arcResourcesLoadingComponent = this.modelView.modelBuilder.loadingComponent().component();
		this._arcResourcesTable = this.modelView.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			data: [],
			columns: [
				{
					displayName: '',
					valueType: azdata.DeclarativeDataType.component,
					width: iconSize,
					isReadOnly: true,
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.name,
					valueType: azdata.DeclarativeDataType.component,
					width: '33%',
					isReadOnly: true,
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}, {
					displayName: loc.type,
					valueType: azdata.DeclarativeDataType.string,
					width: '33%',
					isReadOnly: true,
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}, {
					displayName: loc.compute,
					valueType: azdata.DeclarativeDataType.string,
					width: '34%',
					isReadOnly: true,
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			width: '100%',
			ariaLabel: loc.arcResources
		}).component();

		// Update loaded components with data
		this.handleRegistrationsUpdated();
		this.handleEndpointsUpdated();

		// Assign the loading component after it has data
		this._propertiesLoadingComponent.component = this._propertiesContainer;
		this._arcResourcesLoadingComponent.component = this._arcResourcesTable;

		// Assemble the container
		const rootContainer = this.modelView.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.component();

		const contentContainer = this.modelView.modelBuilder.divContainer().component();
		rootContainer.addItem(contentContainer, { CSSStyles: { 'margin': '10px 20px 0px 20px' } });

		// Properties
		contentContainer.addItem(this._propertiesLoadingComponent);

		// Resources
		const arcResourcesTitle = this.modelView.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: loc.arcResources })
			.component();

		contentContainer.addItem(arcResourcesTitle, {
			CSSStyles: cssStyles.title
		});

		contentContainer.addItem(this._arcResourcesLoadingComponent);
		this.initialized = true;
		return rootContainer;
	}

	public get toolbarContainer(): azdata.ToolbarContainer {

		const newInstance = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.newInstance,
			iconPath: IconPathHelper.add
		}).component();

		this.disposables.push(
			newInstance.onDidClick(async () => {
				await vscode.commands.executeCommand('azdata.resource.deploy', 'arc.sql', ['arc.sql', 'arc.postgres']);
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
					this._propertiesLoadingComponent!.loading = true;
					this._arcResourcesLoadingComponent!.loading = true;
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
				const r = this._controllerModel.controllerRegistration;
				if (r) {
					vscode.env.openExternal(vscode.Uri.parse(
						`https://portal.azure.com/#resource/subscriptions/${r.subscriptionId}/resourceGroups/${r.resourceGroupName}/providers/Microsoft.AzureData/${ResourceType.dataControllers}/${r.instanceName}`));
				} else {
					vscode.window.showErrorMessage(loc.couldNotFindRegistration(this._controllerModel.namespace, 'controller'));
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems(
			[
				{ component: newInstance },
				{ component: refreshButton, toolbarSeparatorAfter: true },
				{ component: openInAzurePortalButton }
			]
		).component();
	}

	private handleRegistrationsUpdated(): void {
		const reg = this._controllerModel.controllerRegistration;
		this.controllerProperties.instanceName = reg?.instanceName || this.controllerProperties.instanceName;
		this.controllerProperties.resourceGroupName = reg?.resourceGroupName || this.controllerProperties.resourceGroupName;
		this.controllerProperties.location = reg?.region || this.controllerProperties.location;
		this.controllerProperties.subscriptionId = reg?.subscriptionId || this.controllerProperties.subscriptionId;
		this.controllerProperties.connectionMode = getConnectionModeDisplayText(reg?.connectionMode) || this.controllerProperties.connectionMode;
		this.controllerProperties.instanceNamespace = reg?.instanceNamespace || this.controllerProperties.instanceNamespace;
		this.refreshDisplayedProperties();

		this._arcResourcesTable.data = this._controllerModel.registrations
			.filter(r => r.instanceType !== ResourceType.dataControllers && !r.isDeleted)
			.map(r => {
				const iconPath = getResourceTypeIcon(r.instanceType ?? '');
				const imageComponent = this.modelView.modelBuilder.image()
					.withProperties<azdata.ImageComponentProperties>({
						width: iconSize,
						height: iconSize,
						iconPath: iconPath,
						iconHeight: iconSize,
						iconWidth: iconSize
					}).component();
				const nameLink = this.modelView.modelBuilder.hyperlink()
					.withProperties<azdata.HyperlinkComponentProperties>({
						label: r.instanceName || '',
						url: ''
					}).component();
				nameLink.onDidClick(async () => {
					await this._controllerModel.treeDataProvider.openResourceDashboard(this._controllerModel, r.instanceType || '', r.instanceNamespace || '', parseInstanceName(r.instanceName));
				});
				return [imageComponent, nameLink, resourceTypeToDisplayName(r.instanceType), loc.numVCores(r.vCores)];
			});
		this._arcResourcesLoadingComponent.loading = !this._controllerModel.registrationsLastUpdated;
	}

	private handleEndpointsUpdated(): void {
		const controllerEndpoint = this._controllerModel.getEndpoint(Endpoints.controller);
		this.controllerProperties.controllerEndpoint = controllerEndpoint?.endpoint || this.controllerProperties.controllerEndpoint;
		this.refreshDisplayedProperties();
	}

	private refreshDisplayedProperties(): void {
		this._propertiesContainer.propertyItems = [
			{
				displayName: loc.name,
				value: this.controllerProperties.instanceName
			},
			{
				displayName: loc.resourceGroup,
				value: this.controllerProperties.resourceGroupName
			},
			{
				displayName: loc.region,
				value: this.controllerProperties.location
			},
			{
				displayName: loc.subscriptionId,
				value: this.controllerProperties.subscriptionId
			},
			{
				displayName: loc.type,
				value: loc.dataControllersType
			},
			{
				displayName: loc.controllerEndpoint,
				value: this.controllerProperties.controllerEndpoint
			},
			{
				displayName: loc.connectionMode,
				value: this.controllerProperties.connectionMode
			},
			{
				displayName: loc.namespace,
				value: this.controllerProperties.instanceNamespace
			}
		];

		this._propertiesLoadingComponent.loading = !this._controllerModel.registrationsLastUpdated && !this._controllerModel.endpointsLastUpdated;
	}
}
