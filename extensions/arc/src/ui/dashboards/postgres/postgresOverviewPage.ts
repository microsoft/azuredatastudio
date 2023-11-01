/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azExt from 'az-ext';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { ControllerModel } from '../../../models/controllerModel';
import { PostgresModel } from '../../../models/postgresModel';
import { promptForInstanceDeletion } from '../../../common/utils';
import { ResourceType } from 'arc';

export type PodStatusModel = {
	podName: azdata.Component,
	status: string
};

export class PostgresOverviewPage extends DashboardPage {

	private propertiesLoading!: azdata.LoadingComponent;
	private serverGroupNodesLoading!: azdata.LoadingComponent;
	private kibanaLoading!: azdata.LoadingComponent;
	private grafanaLoading!: azdata.LoadingComponent;

	private properties!: azdata.PropertiesContainerComponent;
	private kibanaLink!: azdata.HyperlinkComponent;
	private grafanaLink!: azdata.HyperlinkComponent;
	private deleteButton!: azdata.ButtonComponent;

	private readonly _azApi: azExt.IExtension;

	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _controllerModel: ControllerModel, private _postgresModel: PostgresModel) {
		super(modelView, dashboard);
		this._azApi = vscode.extensions.getExtension(azExt.extension.name)?.exports;

		this.disposables.push(
			this._controllerModel.onRegistrationsUpdated(() => this.eventuallyRunOnInitialized(() => this.handleRegistrationsUpdated())),
			this._postgresModel.onConfigUpdated(() => this.eventuallyRunOnInitialized(() => this.handleConfigUpdated())));
	}

	protected get title(): string {
		return loc.overview;
	}

	protected get id(): string {
		return 'postgres-overview';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.postgres;
	}

	protected get container(): azdata.Component {
		const root = this.modelView.modelBuilder.divContainer().component();
		const content = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '10px 20px 0px 20px' } });

		// Properties
		this.properties = this.modelView.modelBuilder.propertiesContainer()
			.withProps({
				propertyItems: this.getProperties()
			}).component();

		this.propertiesLoading = this.modelView.modelBuilder.loadingComponent()
			.withItem(this.properties)
			.withProps({
				loading: !this._controllerModel.registrationsLastUpdated && !this._postgresModel.configLastUpdated
			}).component();

		content.addItem(this.propertiesLoading, { CSSStyles: cssStyles.text });

		// Service endpoints
		const titleCSS = { ...cssStyles.title, 'margin-block-start': '2em', 'margin-block-end': '0' };
		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.serviceEndpoints,
			CSSStyles: titleCSS,
			headingLevel: 1
		}).component());

		this.kibanaLink = this.modelView.modelBuilder.hyperlink().component();

		this.grafanaLink = this.modelView.modelBuilder.hyperlink().component();

		this.kibanaLoading = this.modelView.modelBuilder.loadingComponent()
			.withProps(
				{ loading: !this._postgresModel?.configLastUpdated }
			)
			.component();

		this.grafanaLoading = this.modelView.modelBuilder.loadingComponent()
			.withProps(
				{ loading: !this._postgresModel?.configLastUpdated }
			)
			.component();

		this.refreshDashboardLinks();

		this.kibanaLoading.component = this.kibanaLink;
		this.grafanaLoading.component = this.grafanaLink;

		const endpointsTable = this.modelView.modelBuilder.declarativeTable().withProps({
			width: '100%',
			ariaLabel: loc.serviceEndpoints,
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
				[{ value: loc.kibanaDashboard }, { value: this.kibanaLoading }, { value: loc.kibanaDashboardDescription }],
				[{ value: loc.grafanaDashboard }, { value: this.grafanaLoading }, { value: loc.grafanaDashboardDescription }]]
		}).component();
		content.addItem(endpointsTable);

		this.initialized = true;
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		// Delete service
		this.deleteButton = this.modelView.modelBuilder.button().withProps({
			label: loc.deleteText,
			iconPath: IconPathHelper.delete
		}).component();

		this.disposables.push(
			this.deleteButton.onDidClick(async () => {
				this.deleteButton.enabled = false;
				try {
					if (await promptForInstanceDeletion(this._postgresModel.info.name)) {
						await vscode.window.withProgress(
							{
								location: vscode.ProgressLocation.Notification,
								title: loc.deletingInstance(this._postgresModel.info.name),
								cancellable: false
							},
							async (_progress, _token) => {
								return await this._azApi.az.postgres.serverarc.delete(this._postgresModel.info.name, this._postgresModel.controllerModel.info.namespace, this._controllerModel.azAdditionalEnvVars);
							}
						);
						await this._controllerModel.refreshTreeNode();
						vscode.window.showInformationMessage(loc.instanceDeleted(this._postgresModel.info.name));
						try {
							await this.dashboard.close();
						} catch (err) {
							// Failures closing the dashboard aren't something we need to show users
							console.log('Error closing Arc Postgres dashboard ', err);
						}

					}
				} catch (error) {
					vscode.window.showErrorMessage(loc.instanceDeletionFailed(this._postgresModel.info.name, error));
				} finally {
					this.deleteButton.enabled = true;
				}
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
					this.propertiesLoading!.loading = true;
					this.serverGroupNodesLoading!.loading = true;
					this.kibanaLoading!.loading = true;
					this.grafanaLoading!.loading = true;

					await Promise.all([
						this._postgresModel.refresh(),
						this._controllerModel.refresh(false, this._controllerModel.info.namespace)
					]);
				} catch (error) {
					vscode.window.showErrorMessage(loc.refreshFailed(error));
				}
				finally {
					refreshButton.enabled = true;
				}
			}));

		// Open in Azure portal
		const openInAzurePortalButton = this.modelView.modelBuilder.button().withProps({
			label: loc.openInAzurePortal,
			iconPath: IconPathHelper.openInTab
		}).component();

		this.disposables.push(
			openInAzurePortalButton.onDidClick(async () => {
				const azure = this._controllerModel.controllerConfig?.spec.settings.azure;
				if (azure) {
					vscode.env.openExternal(vscode.Uri.parse(
						`https://portal.azure.com/#resource/subscriptions/${azure.subscription}/resourceGroups/${azure.resourceGroup}/providers/Microsoft.AzureArcData/${ResourceType.postgresInstances}/${this._postgresModel.info.name}`));
				} else {
					vscode.window.showErrorMessage(loc.couldNotFindControllerRegistration);
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: this.deleteButton },
			{ component: refreshButton, toolbarSeparatorAfter: true },
			{ component: openInAzurePortalButton }
		]).component();
	}

	private getProperties(): azdata.PropertiesContainerItem[] {
		const status = this._postgresModel.config?.status;
		const azure = this._controllerModel.controllerConfig?.spec.settings.azure;

		return [
			{ displayName: loc.resourceGroup, value: azure?.resourceGroup || '-' },
			{ displayName: loc.dataController, value: this._controllerModel.controllerConfig?.metadata.name || '-' },
			{ displayName: loc.region, value: azure?.location || '-' },
			{ displayName: loc.namespace, value: this._postgresModel.config?.metadata.namespace || '-' },
			{ displayName: loc.subscriptionId, value: azure?.subscription || '-' },
			{ displayName: loc.externalEndpoint, value: this._postgresModel.config?.status.primaryEndpoint || '-' },
			{ displayName: loc.status, value: status ? `${status.state} (${status.readyPods} ${loc.podsReady})` : '-' }
		];
	}

	private refreshDashboardLinks(): void {
		if (this._postgresModel.config) {
			const kibanaUrl = this._postgresModel.config.status.logSearchDashboard ?? '';
			this.kibanaLink.label = kibanaUrl;
			this.kibanaLink.url = kibanaUrl;
			this.kibanaLoading.loading = false;

			const grafanaUrl = this._postgresModel.config.status.metricsDashboard ?? '';
			this.grafanaLink.label = grafanaUrl;
			this.grafanaLink.url = grafanaUrl;
			this.grafanaLoading.loading = false;
		}
	}

	private handleRegistrationsUpdated() {
		this.properties!.propertyItems = this.getProperties();
		this.propertiesLoading!.loading = false;
	}

	private handleConfigUpdated() {
		this.properties!.propertyItems = this.getProperties();
		this.propertiesLoading!.loading = false;
		this.refreshDashboardLinks();
	}
}
