/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceType } from 'arc';
import * as azdata from 'azdata';
import * as azurecore from 'azurecore';
import * as vscode from 'vscode';
import { getConnectionModeDisplayText, getResourceTypeIcon, resourceTypeToDisplayName } from '../../../common/utils';
import { cssStyles, IconPathHelper, controllerTroubleshootDocsUrl, iconSize } from '../../../constants';
import * as loc from '../../../localizedConstants';
import { ControllerModel } from '../../../models/controllerModel';
import { DashboardPage } from '../../components/dashboardPage';

export class ControllerDashboardOverviewPage extends DashboardPage {

	private _propertiesLoadingComponent!: azdata.LoadingComponent;
	private _arcResourcesLoadingComponent!: azdata.LoadingComponent;

	private _arcResourcesTable!: azdata.DeclarativeTableComponent;
	private _propertiesContainer!: azdata.PropertiesContainerComponent;

	private _openInAzurePortalButton!: azdata.ButtonComponent;

	private _azurecoreApi: azurecore.IExtension;

	private controllerProperties = {
		instanceName: '-',
		resourceGroupName: '-',
		location: '-',
		subscriptionId: '-',
		connectionMode: '-',
		instanceNamespace: '-',
		status: '-'
	};

	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _controllerModel: ControllerModel) {
		super(modelView, dashboard);

		this._azurecoreApi = vscode.extensions.getExtension(azurecore.extension.name)?.exports;

		this.disposables.push(
			this._controllerModel.onRegistrationsUpdated(() => this.eventuallyRunOnInitialized(() => this.handleRegistrationsUpdated())));
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
		await this._controllerModel.refresh(false, this._controllerModel.info.resourceGroup, this._controllerModel.info.namespace);
	}

	public get container(): azdata.Component {
		// Create loaded components
		this._propertiesContainer = this.modelView.modelBuilder.propertiesContainer().component();
		this._propertiesLoadingComponent = this.modelView.modelBuilder.loadingComponent().component();

		this._arcResourcesLoadingComponent = this.modelView.modelBuilder.loadingComponent().component();
		this._arcResourcesTable = this.modelView.modelBuilder.declarativeTable().withProps({
			dataValues: [],
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
					displayName: loc.state,
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
			.withProps({ value: loc.arcResources })
			.component();

		contentContainer.addItem(arcResourcesTitle, {
			CSSStyles: cssStyles.title
		});

		contentContainer.addItem(this._arcResourcesLoadingComponent);
		this.initialized = true;
		return rootContainer;
	}

	public get toolbarContainer(): azdata.ToolbarContainer {

		const newInstance = this.modelView.modelBuilder.button().withProps({
			label: loc.newInstance,
			iconPath: IconPathHelper.add
		}).component();

		this.disposables.push(
			newInstance.onDidClick(async () => {
				const node = this._controllerModel.treeDataProvider.getControllerNode(this._controllerModel);
				await vscode.commands.executeCommand('azdata.resource.deploy',
					'azure-sql-mi', // Default option
					['azure-sql-mi', 'arc-postgres'], // Type filter
					{ 'azure-sql-mi': { 'mi-type': ['arc-mi'] } }, // Options filter
					{ 'CONTROLLER_NAME': node?.label });
			}));

		// Refresh
		const refreshButton = this.modelView.modelBuilder.button().withProps({
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

		this._openInAzurePortalButton = this.modelView.modelBuilder.button().withProps({
			label: loc.openInAzurePortal,
			iconPath: IconPathHelper.openInTab,
			enabled: !!this._controllerModel.controllerConfig
		}).component();

		this.disposables.push(
			this._openInAzurePortalButton.onDidClick(async () => {
				const config = this._controllerModel.controllerConfig;
				if (config) {
					await vscode.env.openExternal(vscode.Uri.parse(
						`https://portal.azure.com/#resource/subscriptions/${config.spec.settings.azure.subscription}/resourceGroups/${config.spec.settings.azure.resourceGroup}/providers/Microsoft.AzureArcData/${ResourceType.dataControllers}/${config.metadata.name}`));
				} else {
					vscode.window.showErrorMessage(loc.couldNotFindControllerRegistration);
				}
			}));

		const troubleshootButton = this.modelView.modelBuilder.button().withProps({
			label: loc.troubleshoot,
			iconPath: IconPathHelper.wrench
		}).component();

		this.disposables.push(
			troubleshootButton.onDidClick(async () => {
				await vscode.env.openExternal(vscode.Uri.parse(controllerTroubleshootDocsUrl));
			})
		);

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems(
			[
				{ component: newInstance },
				{ component: refreshButton, toolbarSeparatorAfter: true },
				{ component: this._openInAzurePortalButton, toolbarSeparatorAfter: true },
				{ component: troubleshootButton }
			]
		).component();
	}

	private handleRegistrationsUpdated(): void {
		const config = this._controllerModel.controllerConfig;
		if (this._openInAzurePortalButton) {
			this._openInAzurePortalButton.enabled = !!config;
		}
		this.controllerProperties.instanceName = config?.metadata.name || this.controllerProperties.instanceName;
		this.controllerProperties.resourceGroupName = config?.spec.settings.azure.resourceGroup || this.controllerProperties.resourceGroupName;
		this.controllerProperties.location = this._azurecoreApi.getRegionDisplayName(config?.spec.settings.azure.location) || this.controllerProperties.location;
		this.controllerProperties.subscriptionId = config?.spec.settings.azure.subscription || this.controllerProperties.subscriptionId;
		this.controllerProperties.connectionMode = getConnectionModeDisplayText(config?.spec.settings.azure.connectionMode) || this.controllerProperties.connectionMode;
		this.controllerProperties.instanceNamespace = config?.metadata.namespace || this.controllerProperties.instanceNamespace;
		this.controllerProperties.status = config?.status.state || this.controllerProperties.status;
		this.refreshDisplayedProperties();

		let registrations: (string | azdata.ImageComponent | azdata.HyperlinkComponent)[][] = this._controllerModel.registrations
			.filter(r => r.instanceType !== ResourceType.dataControllers)
			.map(r => {
				const iconPath = getResourceTypeIcon(r.instanceType ?? '');
				const imageComponent = this.modelView.modelBuilder.image()
					.withProps({
						width: iconSize,
						height: iconSize,
						iconPath: iconPath,
						iconHeight: iconSize,
						iconWidth: iconSize
					}).component();

				const nameComponent = this.modelView.modelBuilder.hyperlink()
					.withProps({
						label: r.instanceName || '',
						url: ''
					}).component();

				this.disposables.push(nameComponent.onDidClick(async () => {
					await this._controllerModel.treeDataProvider.openResourceDashboard(this._controllerModel, r.instanceType || '', r.instanceName);
				}));

				return [imageComponent, nameComponent, resourceTypeToDisplayName(r.instanceType), r.state];
			});

		let registrationsData = registrations.map(r => {
			return r.map((value): azdata.DeclarativeTableCellValue => {
				return { value: value };
			});
		});
		this._arcResourcesTable.setDataValues(registrationsData);
		this._arcResourcesLoadingComponent.loading = !this._controllerModel.registrationsLastUpdated;
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
				displayName: loc.connectionMode,
				value: this.controllerProperties.connectionMode
			},
			{
				displayName: loc.namespace,
				value: this.controllerProperties.instanceNamespace
			},
			{
				displayName: loc.status,
				value: this.controllerProperties.status
			}
		];

		this._propertiesLoadingComponent.loading = !this._controllerModel.registrationsLastUpdated && !this._controllerModel.endpointsLastUpdated;
	}
}
