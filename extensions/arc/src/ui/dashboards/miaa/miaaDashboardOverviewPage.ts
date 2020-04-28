/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { DashboardPage } from '../../components/dashboardPage';
import { IconPathHelper } from '../../../constants';

export class MiaaDashboardOverviewPage extends DashboardPage {

	constructor(modelView: azdata.ModelView) {
		super(modelView);
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

	public get container(): azdata.Component {

		const rootContainer = this.modelView.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withProperties({ CSSStyles: { 'margin': '18px' } })
			.component();

		const propertiesContainer = this.modelView.modelBuilder.propertiesContainer().withProperties<azdata.PropertiesContainerComponentProperties>({
			propertyItems: [
				{
					displayName: loc.resourceGroup,
					value: 'contosoRG123'
				},
				{
					displayName: loc.region,
					value: 'West US'
				},
				{
					displayName: loc.subscription,
					value: 'contososub5678'
				},
				{
					displayName: loc.subscriptionId,
					value: '88abe223-c630-4f2c-8782-00bb5be874f6'
				},
				{
					displayName: loc.state,
					value: 'Connected'
				},
				{
					displayName: loc.adminUsername,
					value: 'cloudsa'
				},
				{
					displayName: loc.host,
					value: 'plainscluster.sqlarcdm.database.windows.net'
				}
			]
		}).component();

		rootContainer.addItem(propertiesContainer);

		const arcResourcesTitle = this.modelView.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: loc.arcResources })
			.component();

		rootContainer.addItem(arcResourcesTitle, {
			CSSStyles: {
				'font-size': '14px'
			}
		});

		const arcResourcesTable = this.modelView.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			data: [
				['postgresArc', 'PostgreSQL Server group - Azure Arc', '2 nodes, 4 vCores / 32 GiB RAM, 0.5 TiB storage'],
				['managedInstanceArc', 'SQL instance - Azure Arc', 'General Purpose Gen5 (32 GB, 4 vCores)'],
				['contosoInstanceArc', 'SQL instance - Azure Arc', 'General Purpose Gen5 (32 GB, 4 vCores)']
			],
			columns: [
				{
					displayName: loc.name,
					valueType: azdata.DeclarativeDataType.string,
					width: '33%',
					isReadOnly: true
				}, {
					displayName: loc.type,
					valueType: azdata.DeclarativeDataType.string,
					width: '33%',
					isReadOnly: true
				}, {
					displayName: loc.computeAndStorage,
					valueType: azdata.DeclarativeDataType.string,
					width: '34%',
					isReadOnly: true
				}
			],
			width: '100%',
			ariaLabel: loc.arcResources
		}).component();

		const arcResourcesTableContainer = this.modelView.modelBuilder.divContainer()
			.withItems([arcResourcesTable])
			.component();

		rootContainer.addItem(arcResourcesTableContainer);
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

		const resetPasswordButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.resetPassword,
			iconPath: IconPathHelper.edit
		}).component();

		const openInAzurePortalButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.openInAzurePortal,
			iconPath: IconPathHelper.openInTab
		}).component();

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems(
			[
				{ component: createNewButton },
				{ component: deleteButton },
				{ component: resetPasswordButton, toolbarSeparatorAfter: true },
				{ component: openInAzurePortalButton }
			]
		).component();
	}

}
