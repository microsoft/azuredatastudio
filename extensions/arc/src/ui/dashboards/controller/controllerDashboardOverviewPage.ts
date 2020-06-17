/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../../../localizedConstants';
import { DashboardPage } from '../../components/dashboardPage';
import { IconPathHelper, cssStyles } from '../../../constants';
import { ControllerModel } from '../../../models/controllerModel';
import { resourceTypeToDisplayName, ResourceType, getAzurecoreApi } from '../../../common/utils';
import { RegistrationResponse } from '../../../controller/generated/v1/model/registrationResponse';

export class ControllerDashboardOverviewPage extends DashboardPage {

	private _arcResourcesTable!: azdata.DeclarativeTableComponent;
	private _propertiesContainer!: azdata.PropertiesContainerComponent;

	constructor(modelView: azdata.ModelView, private _controllerModel: ControllerModel) {
		super(modelView);
		this._controllerModel.onRegistrationsUpdated((_: RegistrationResponse[]) => {
			this.eventuallyRunOnInitialized(() => {
				this.handleRegistrationsUpdated().catch(e => console.log(e));
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

		contentContainer.addItem(this._propertiesContainer);

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

		contentContainer.addItem(arcResourcesTableContainer);
		this.initialized = true;
		return rootContainer;
	}

	public get toolbarContainer(): azdata.ToolbarContainer {

		const createNewButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.createNew,
			iconPath: IconPathHelper.add
		}).component();

		const deleteButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.deleteText,
			iconPath: IconPathHelper.delete
		}).component();

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
				{ component: createNewButton },
				{ component: deleteButton, toolbarSeparatorAfter: true },
				{ component: openInAzurePortalButton }
			]
		).component();
	}

	private async handleRegistrationsUpdated(): Promise<void> {
		const reg = this._controllerModel.controllerRegistration;
		if (reg) {
			this._propertiesContainer.propertyItems = [
				{
					displayName: loc.name,
					value: reg.instanceName || '-'
				},
				{
					displayName: loc.resourceGroup,
					value: reg.resourceGroupName || '-'
				},
				{
					displayName: loc.region,
					value: (await getAzurecoreApi()).getRegionDisplayName(reg.location) || '-'
				},
				{
					displayName: loc.subscriptionId,
					value: reg.subscriptionId || '-'
				},
				{
					displayName: loc.type,
					value: loc.dataControllersType
				},
				{
					displayName: loc.coordinatorEndpoint,
					value: '-'
				},
				{
					displayName: loc.connectionMode,
					value: reg.connectionMode || '-'
				},
				{
					displayName: loc.namespace,
					value: reg.instanceNamespace || '-'
				}
			];
		}

		this._arcResourcesTable.data = this._controllerModel.registrations
			.filter(r => r.instanceType !== ResourceType.dataControllers)
			.map(r => [r.instanceName, resourceTypeToDisplayName(r.instanceType), r.vCores]);
	}
}
