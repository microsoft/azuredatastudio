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
import { resourceTypeToDisplayName, getAzurecoreApi, getResourceTypeIcon, getConnectionModeDisplayText } from '../../../common/utils';
import { RegistrationResponse } from '../../../controller/generated/v1/model/registrationResponse';
import { EndpointModel } from '../../../controller/generated/v1/api';

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

	private _endpointsRetrieved = false;
	private _registrationsRetrieved = false;

	constructor(modelView: azdata.ModelView, private _controllerModel: ControllerModel) {
		super(modelView);
		this._controllerModel.onRegistrationsUpdated((_: RegistrationResponse[]) => {
			this.eventuallyRunOnInitialized(() => {
				this.handleRegistrationsUpdated().catch(e => console.log(e));
			});
		});
		this._controllerModel.onEndpointsUpdated(endpoints => {
			this.eventuallyRunOnInitialized(() => {
				this.handleEndpointsUpdated(endpoints);
			});
		});
		this.refresh().catch(e => {
			console.log(e);
		});
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

		const rootContainer = this.modelView.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.component();

		const contentContainer = this.modelView.modelBuilder.divContainer().component();
		rootContainer.addItem(contentContainer, { CSSStyles: { 'margin': '10px 20px 0px 20px' } });

		this._propertiesContainer = this.modelView.modelBuilder.propertiesContainer().component();
		this._propertiesLoadingComponent = this.modelView.modelBuilder.loadingComponent().withItem(this._propertiesContainer).component();

		contentContainer.addItem(this._propertiesLoadingComponent);

		const arcResourcesTitle = this.modelView.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: loc.arcResources })
			.component();

		contentContainer.addItem(arcResourcesTitle, {
			CSSStyles: cssStyles.title
		});

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
					valueType: azdata.DeclarativeDataType.string,
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
					displayName: loc.computeAndStorage,
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

		const arcResourcesTableContainer = this.modelView.modelBuilder.divContainer()
			.withItems([this._arcResourcesTable])
			.component();

		this._arcResourcesLoadingComponent = this.modelView.modelBuilder.loadingComponent().withItem(arcResourcesTableContainer).component();

		contentContainer.addItem(this._arcResourcesLoadingComponent);
		this.initialized = true;
		return rootContainer;
	}

	public get toolbarContainer(): azdata.ToolbarContainer {

		const createNewButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.createNew,
			iconPath: IconPathHelper.add
		}).component();

		createNewButton.onDidClick(async () => {
			await vscode.commands.executeCommand('azdata.resource.deploy');
		});

		const openInAzurePortalButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.openInAzurePortal,
			iconPath: IconPathHelper.openInTab
		}).component();

		openInAzurePortalButton.onDidClick(async () => {
			const r = this._controllerModel.controllerRegistration;
			if (r) {
				vscode.env.openExternal(vscode.Uri.parse(
					`https://portal.azure.com/#resource/subscriptions/${r.subscriptionId}/resourceGroups/${r.resourceGroupName}/providers/Microsoft.AzureData/${ResourceType.dataControllers}/${r.instanceName}`));
			} else {
				vscode.window.showErrorMessage(loc.couldNotFindControllerResource);
			}
		});

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems(
			[
				{ component: createNewButton, toolbarSeparatorAfter: true },
				{ component: openInAzurePortalButton }
			]
		).component();
	}

	private async handleRegistrationsUpdated(): Promise<void> {
		const reg = this._controllerModel.controllerRegistration;
		this.controllerProperties.instanceName = reg?.instanceName || this.controllerProperties.instanceName;
		this.controllerProperties.resourceGroupName = reg?.resourceGroupName || this.controllerProperties.resourceGroupName;
		this.controllerProperties.location = (await getAzurecoreApi()).getRegionDisplayName(reg?.location) || this.controllerProperties.location;
		this.controllerProperties.subscriptionId = reg?.subscriptionId || this.controllerProperties.subscriptionId;
		this.controllerProperties.connectionMode = getConnectionModeDisplayText(reg?.connectionMode) || this.controllerProperties.connectionMode;
		this.controllerProperties.instanceNamespace = reg?.instanceNamespace || this.controllerProperties.instanceNamespace;
		this._registrationsRetrieved = true;
		this.refreshDisplayedProperties();

		this._arcResourcesTable.data = this._controllerModel.registrations
			.filter(r => r.instanceType !== ResourceType.dataControllers)
			.map(r => {
				const iconPath = getResourceTypeIcon(r.instanceType ?? '');
				const imageComponent = this.modelView.modelBuilder.image()
					.withProperties<azdata.ImageComponentProperties>({
						width: iconSize,
						height: iconSize,
						iconPath: iconPath,
						iconHeight: iconSize,
						iconWidth: iconSize
					})
					.component();
				return [imageComponent, r.instanceName, resourceTypeToDisplayName(r.instanceType), r.vCores];
			});
		this._arcResourcesLoadingComponent.loading = false;
	}

	private handleEndpointsUpdated(endpoints: EndpointModel[]): void {
		const controllerEndpoint = endpoints.find(endpoint => endpoint.name === Endpoints.controller);
		this.controllerProperties.controllerEndpoint = controllerEndpoint?.endpoint || this.controllerProperties.controllerEndpoint;
		this._endpointsRetrieved = true;
		this.refreshDisplayedProperties();
	}

	private refreshDisplayedProperties(): void {
		// Only update once we've retrieved all the necessary properties
		if (this._endpointsRetrieved && this._registrationsRetrieved) {
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
			this._propertiesLoadingComponent.loading = false;
		}

	}
}
