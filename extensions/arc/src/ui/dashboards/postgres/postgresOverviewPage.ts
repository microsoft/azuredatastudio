/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azdataExt from 'azdata-ext';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles, iconSize } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { ControllerModel } from '../../../models/controllerModel';
import { PostgresModel } from '../../../models/postgresModel';
import { promptAndConfirmPassword, promptForInstanceDeletion } from '../../../common/utils';
import { ResourceType } from 'arc';

export type PodStatusModel = {
	podName: azdata.Component,
	type: string,
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

	private podStatusTable!: azdata.DeclarativeTableComponent;
	private podStatusData: PodStatusModel[] = [];

	private readonly _azdataApi: azdataExt.IExtension;

	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _controllerModel: ControllerModel, private _postgresModel: PostgresModel) {
		super(modelView, dashboard);
		this._azdataApi = vscode.extensions.getExtension(azdataExt.extension.name)?.exports;

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
			CSSStyles: titleCSS
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

		// Server Group Nodes
		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.serverGroupNodes,
			CSSStyles: titleCSS
		}).component());



		this.podStatusTable = this.modelView.modelBuilder.declarativeTable().withProps({
			width: '100%',
			columns: [
				{
					displayName: loc.name,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: '35%',
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
					displayName: loc.type,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '35%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.status,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '30%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			dataValues: this.createPodStatusDataValues()
		}).component();



		this.serverGroupNodesLoading = this.modelView.modelBuilder.loadingComponent()
			.withItem(this.podStatusTable)
			.withProps({
				loading: !this._postgresModel.configLastUpdated
			}).component();

		this.refreshServerNodes();

		content.addItem(this.serverGroupNodesLoading, { CSSStyles: cssStyles.text });

		this.initialized = true;
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		// Reset password
		const resetPasswordButton = this.modelView.modelBuilder.button().withProps({
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
							Object.assign({ 'AZDATA_PASSWORD': password }, this._controllerModel.azdataAdditionalEnvVars));
						vscode.window.showInformationMessage(loc.passwordReset);
					}
				} catch (error) {
					vscode.window.showErrorMessage(loc.passwordResetFailed(error));
				} finally {
					resetPasswordButton.enabled = true;
				}
			}));

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
								return await this._azdataApi.azdata.arc.postgres.server.delete(this._postgresModel.info.name, this._controllerModel.azdataAdditionalEnvVars, this._controllerModel.controllerContext);
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
			{ component: resetPasswordButton },
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
			{ displayName: loc.status, value: status ? `${status.state} (${status.readyPods} ${loc.podsReady})` : '-' },
			{ displayName: loc.postgresAdminUsername, value: 'postgres' },
			{ displayName: loc.postgresVersion, value: this._postgresModel.engineVersion ?? '-' },
			{ displayName: loc.nodeConfiguration, value: this._postgresModel.scaleConfiguration || '-' }
		];
	}

	private getPodStatus(): PodStatusModel[] {
		let podModels: PodStatusModel[] = [];
		const podStatus = this._postgresModel.config?.status.podsStatus;

		podStatus?.forEach(p => {
			// If a condition of the pod has a status of False, pod is not Ready
			const status = p.conditions.find(c => c.status === 'False') ? loc.notReady : loc.ready;

			const podLabelContainer = this.modelView.modelBuilder.flexContainer().withProps({
				CSSStyles: { 'alignItems': 'center', 'height': '15px' }
			}).component();

			const imageComponent = this.modelView.modelBuilder.image().withProps({
				iconPath: IconPathHelper.postgres,
				width: iconSize,
				height: iconSize,
				iconHeight: '15px',
				iconWidth: '15px'
			}).component();

			let podLabel = this.modelView.modelBuilder.text().withProps({
				value: p.name,
			}).component();

			if (p.role.toUpperCase() === loc.worker.toUpperCase()) {
				podLabelContainer.addItem(imageComponent, { CSSStyles: { 'margin-left': '15px', 'margin-right': '0px' } });
				podLabelContainer.addItem(podLabel);
				let pod: PodStatusModel = {
					podName: podLabelContainer,
					type: loc.worker,
					status: status
				};
				podModels.push(pod);
			} else {
				podLabelContainer.addItem(imageComponent, { CSSStyles: { 'margin-right': '0px' } });
				podLabelContainer.addItem(podLabel);
				let pod: PodStatusModel = {
					podName: podLabelContainer,
					type: loc.coordinator,
					status: status
				};
				podModels.unshift(pod);
			}
		});

		return podModels;
	}

	private createPodStatusDataValues(): azdata.DeclarativeTableCellValue[][] {
		let podDataValue: (string | azdata.Component)[][] = this.podStatusData.map(p => [p.podName, p.type, p.status]);
		return podDataValue.map(p => {
			return p.map((value): azdata.DeclarativeTableCellValue => {
				return { value: value };
			});
		});
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

	private refreshServerNodes(): void {
		if (this._postgresModel.config) {
			this.podStatusData = this.getPodStatus();
			this.podStatusTable.setDataValues(this.createPodStatusDataValues());
			this.serverGroupNodesLoading.loading = false;
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
		this.refreshServerNodes();
	}
}
