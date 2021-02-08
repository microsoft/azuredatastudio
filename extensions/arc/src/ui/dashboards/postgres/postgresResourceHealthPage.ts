/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles, iconSize } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { ControllerModel } from '../../../models/controllerModel';
import { PostgresModel } from '../../../models/postgresModel';

export type PodStatusModel = {
	podName: azdata.Component,
	type: string,
	status: string
};

export class PostgresResourceHealthPage extends DashboardPage {

	private serverGroupNodesLoading!: azdata.LoadingComponent;
	private podStatusTable!: azdata.DeclarativeTableComponent;

	constructor(protected modelView: azdata.ModelView, private _controllerModel: ControllerModel, private _postgresModel: PostgresModel) {
		super(modelView);

		this.disposables.push(
			this._postgresModel.onConfigUpdated(() => this.eventuallyRunOnInitialized(() => this.handleConfigUpdated())));
	}

	protected get title(): string {
		return loc.resourceHealth;
	}

	protected get id(): string {
		return 'postgres-resource-health';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.health;
	}

	protected get container(): azdata.Component {
		const root = this.modelView.modelBuilder.divContainer().component();
		const content = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '10px 20px 0px 20px' } });

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.resourceHealth,
			CSSStyles: { ...cssStyles.title }
		}).component());

		const overviewBox = this.modelView.modelBuilder.divContainer().withProps({
			CSSStyles: { 'border': 'solid 1px #ccc', 'height': '300px', 'width': '400px', }
		}).component();

		content.addItem(overviewBox);









		// Server Group Nodes
		const titleCSS = { ...cssStyles.title, 'margin-block-start': '2em', 'margin-block-end': '0' };
		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
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
			data: []
		}).component();

		this.serverGroupNodesLoading = this.modelView.modelBuilder.loadingComponent()
			.withItem(this.podStatusTable)
			.withProperties<azdata.LoadingComponentProperties>({
				loading: !this._postgresModel.configLastUpdated
			}).component();

		content.addItem(this.serverGroupNodesLoading, { CSSStyles: cssStyles.text });

		this.initialized = true;
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		// Refresh
		const refreshButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.refresh,
			iconPath: IconPathHelper.refresh
		}).component();

		this.disposables.push(
			refreshButton.onDidClick(async () => {
				refreshButton.enabled = false;
				try {
					this.serverGroupNodesLoading!.loading = true;

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

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: refreshButton, toolbarSeparatorAfter: true }
		]).component();
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

	private refreshServerNodes(): void {
		if (this._postgresModel.config) {
			this.podStatusTable.data = this.getPodStatus().map(p => [p.podName, p.type, p.status]);
			this.serverGroupNodesLoading.loading = false;
		}
	}

	private handleConfigUpdated() {
		this.refreshServerNodes();
	}
}
