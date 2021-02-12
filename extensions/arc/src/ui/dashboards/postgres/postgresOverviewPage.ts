/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azdataExt from 'azdata-ext';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles, Endpoints } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { ControllerModel } from '../../../models/controllerModel';
import { PostgresModel } from '../../../models/postgresModel';
import { promptAndConfirmPassword, promptForInstanceDeletion } from '../../../common/utils';
import { ResourceType } from 'arc';

export class PostgresOverviewPage extends DashboardPage {

	private propertiesLoading?: azdata.LoadingComponent;
	private kibanaLoading?: azdata.LoadingComponent;
	private grafanaLoading?: azdata.LoadingComponent;

	private properties?: azdata.PropertiesContainerComponent;
	private kibanaLink?: azdata.HyperlinkComponent;
	private grafanaLink?: azdata.HyperlinkComponent;

	private readonly _azdataApi: azdataExt.IExtension;

	constructor(protected modelView: azdata.ModelView, private _controllerModel: ControllerModel, private _postgresModel: PostgresModel) {
		super(modelView);
		this._azdataApi = vscode.extensions.getExtension(azdataExt.extension.name)?.exports;

		this.disposables.push(
			this._controllerModel.onEndpointsUpdated(() => this.eventuallyRunOnInitialized(() => this.handleEndpointsUpdated())),
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
			.withProperties<azdata.PropertiesContainerComponentProperties>({
				propertyItems: this.getProperties()
			}).component();

		this.propertiesLoading = this.modelView.modelBuilder.loadingComponent()
			.withItem(this.properties)
			.withProperties<azdata.LoadingComponentProperties>({
				loading: !this._controllerModel.registrationsLastUpdated && !this._postgresModel.configLastUpdated
			}).component();

		content.addItem(this.propertiesLoading, { CSSStyles: cssStyles.text });

		// Service endpoints
		const titleCSS = { ...cssStyles.title, 'margin-block-start': '2em', 'margin-block-end': '0' };
		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.serviceEndpoints,
			CSSStyles: titleCSS
		}).component());

		this.kibanaLink = this.modelView.modelBuilder.hyperlink()
			.withProperties<azdata.HyperlinkComponentProperties>({
				label: this.getKibanaLink(),
				url: this.getKibanaLink()
			}).component();

		this.grafanaLink = this.modelView.modelBuilder.hyperlink()
			.withProperties<azdata.HyperlinkComponentProperties>({
				label: this.getGrafanaLink(),
				url: this.getGrafanaLink()
			}).component();

		this.kibanaLoading = this.modelView.modelBuilder.loadingComponent()
			.withItem(this.kibanaLink)
			.withProperties<azdata.LoadingComponentProperties>({
				loading: !this._controllerModel.endpointsLastUpdated
			}).component();

		this.grafanaLoading = this.modelView.modelBuilder.loadingComponent()
			.withItem(this.grafanaLink)
			.withProperties<azdata.LoadingComponentProperties>({
				loading: !this._controllerModel.endpointsLastUpdated
			}).component();

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
				[loc.kibanaDashboard, this.kibanaLoading, loc.kibanaDashboardDescription],
				[loc.grafanaDashboard, this.grafanaLoading, loc.grafanaDashboardDescription]]
		}).component();

		content.addItem(endpointsTable);
		this.initialized = true;
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		// Reset password
		const resetPasswordButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.resetPassword,
			iconPath: IconPathHelper.edit
		}).component();

		this.disposables.push(
			resetPasswordButton.onDidClick(async () => {
				resetPasswordButton.enabled = false;
				try {
					const password = await promptAndConfirmPassword(input => !input ? loc.enterANonEmptyPassword : '');
					if (password) {
						await this._azdataApi.azdata.arc.postgres.server.edit(
							this._postgresModel.info.name,
							{
								adminPassword: true,
								noWait: true
							},
							{ 'AZDATA_PASSWORD': password });
						vscode.window.showInformationMessage(loc.passwordReset);
					}
				} catch (error) {
					vscode.window.showErrorMessage(loc.passwordResetFailed(error));
				} finally {
					resetPasswordButton.enabled = true;
				}
			}));

		// Delete service
		const deleteButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.deleteText,
			iconPath: IconPathHelper.delete
		}).component();

		this.disposables.push(
			deleteButton.onDidClick(async () => {
				deleteButton.enabled = false;
				try {
					if (await promptForInstanceDeletion(this._postgresModel.info.name)) {
						await vscode.window.withProgress(
							{
								location: vscode.ProgressLocation.Notification,
								title: loc.deletingInstance(this._postgresModel.info.name),
								cancellable: false
							},
							(_progress, _token) => {
								return this._azdataApi.azdata.arc.postgres.server.delete(this._postgresModel.info.name);
							}
						);
						await this._controllerModel.refreshTreeNode();
						vscode.window.showInformationMessage(loc.instanceDeleted(this._postgresModel.info.name));
					}
				} catch (error) {
					vscode.window.showErrorMessage(loc.instanceDeletionFailed(this._postgresModel.info.name, error));
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
					this.propertiesLoading!.loading = true;
					this.kibanaLoading!.loading = true;
					this.grafanaLoading!.loading = true;

					await Promise.all([
						this._postgresModel.refresh(),
						this._controllerModel.refresh()
					]);
				} catch (error) {
					vscode.window.showErrorMessage(loc.refreshFailed(error));
				}
				finally {
					refreshButton.enabled = true;
				}
			}));

		// Open in Azure portal
		const openInAzurePortalButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.openInAzurePortal,
			iconPath: IconPathHelper.openInTab
		}).component();

		this.disposables.push(
			openInAzurePortalButton.onDidClick(async () => {
				const azure = this._controllerModel.controllerConfig?.spec.settings.azure;
				if (azure) {
					vscode.env.openExternal(vscode.Uri.parse(
						`https://portal.azure.com/#resource/subscriptions/${azure.subscription}/resourceGroups/${azure.resourceGroup}/providers/Microsoft.AzureData/${ResourceType.postgresInstances}/${this._postgresModel.info.name}`));
				} else {
					vscode.window.showErrorMessage(loc.couldNotFindControllerRegistration);
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: resetPasswordButton },
			{ component: deleteButton },
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
			{ displayName: loc.externalEndpoint, value: this._postgresModel.config?.status.externalEndpoint || '-' },
			{ displayName: loc.status, value: status ? `${status.state} (${status.readyPods} ${loc.podsReady})` : '-' },
			{ displayName: loc.postgresAdminUsername, value: 'postgres' },
			{ displayName: loc.postgresVersion, value: this._postgresModel.engineVersion ?? '-' },
			{ displayName: loc.nodeConfiguration, value: this._postgresModel.scaleConfiguration || '-' }
		];
	}

	private getKibanaLink(): string {
		const namespace = this._postgresModel.config?.metadata.namespace;
		const kibanaQuery = `kubernetes_namespace:"${namespace}" and custom_resource_name:"${this._postgresModel.info.name}"`;
		return `${this._controllerModel.getEndpoint(Endpoints.logsui)?.endpoint}/app/kibana#/discover?_a=(query:(language:kuery,query:'${kibanaQuery}'))`;

	}

	private getGrafanaLink(): string {
		const namespace = this._postgresModel.config?.metadata.namespace;
		const grafanaQuery = `var-Namespace=${namespace}&var-Name=${this._postgresModel.info.name}`;
		return `${this._controllerModel.getEndpoint(Endpoints.metricsui)?.endpoint}/d/postgres-metrics?${grafanaQuery}`;
	}

	private handleEndpointsUpdated() {
		this.kibanaLink!.label = this.getKibanaLink();
		this.kibanaLink!.url = this.getKibanaLink();
		this.kibanaLoading!.loading = false;

		this.grafanaLink!.label = this.getGrafanaLink();
		this.grafanaLink!.url = this.getGrafanaLink();
		this.grafanaLoading!.loading = false;
	}

	private handleRegistrationsUpdated() {
		this.properties!.propertyItems = this.getProperties();
		this.propertiesLoading!.loading = false;
	}

	private handleConfigUpdated() {
		this.properties!.propertyItems = this.getProperties();
		this.propertiesLoading!.loading = false;
	}
}
