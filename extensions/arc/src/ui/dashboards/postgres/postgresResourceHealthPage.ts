/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles, iconSize } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { PostgresModel } from '../../../models/postgresModel';

export type PodHealthModel = {
	condition: string,
	details: azdata.Component,
	lastUpdate: string
};

export enum PodConditionType {
	initialized = 'Initialized',
	ready = 'Ready',
	containersReady = 'ContainersReady',
	podScheduled = 'PodScheduled'
}

export class PostgresResourceHealthPage extends DashboardPage {
	private podSummaryContainer!: azdata.DivContainer;

	private podConditionsContainer!: azdata.DivContainer;
	private podConditionsLoading!: azdata.LoadingComponent;
	private podConditionsTable!: azdata.DeclarativeTableComponent;
	private podConditionsTableIndexes: Map<string, number[]> = new Map();

	private podDropDown!: azdata.DropDownComponent;
	private coordinatorPodName!: string;
	private coordinatorData: PodHealthModel[] = [];
	private podsData: PodHealthModel[] = [];

	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _postgresModel: PostgresModel) {
		super(modelView, dashboard);

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

		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.resourceHealth,
			CSSStyles: { ...cssStyles.title }
		}).component());

		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.resourceHealthDescription,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component());

		this.podSummaryContainer = this.modelView.modelBuilder.divContainer().component();

		this.refreshPodSummarySection();

		content.addItem(this.podSummaryContainer);

		// Pod Conditions
		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.podsPresent,
			CSSStyles: { ...cssStyles.title }
		}).component());

		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.podsUsedDescription,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px', 'margin-top': '10px' }
		}).component());

		this.podConditionsContainer = this.modelView.modelBuilder.divContainer().component();
		this.podConditionsTable = this.modelView.modelBuilder.declarativeTable().withProps({
			width: '100%',
			ariaLabel: loc.podConditionsTable,
			columns: [
				{
					displayName: loc.condition,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '20%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.details,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: '50%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: {
						...cssStyles.tableRow,
						'min-width': '150px'
					}
				},
				{
					displayName: loc.lastTransition,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '30%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			dataValues: this.createPodConditionsDataValues(this.coordinatorData)
		}).component();

		this.podDropDown = this.modelView.modelBuilder.dropDown().withProps({
			width: '150px',
			ariaLabel: loc.podsUsedDescriptionAria
		}).component();
		this.disposables.push(
			this.podDropDown.onValueChanged(() => {
				this.podConditionsTable.setFilter(this.podConditionsTableIndexes.get(String(this.podDropDown.value)));
			})
		);

		this.podConditionsContainer.addItem(this.podDropDown, { CSSStyles: { 'margin': '10px 0px 10px 0px' } });
		this.podConditionsContainer.addItem(this.podConditionsTable);
		this.podConditionsLoading = this.modelView.modelBuilder.loadingComponent()
			.withItem(this.podConditionsContainer)
			.withProps({
				loading: !this._postgresModel.configLastUpdated
			}).component();

		this.refreshPodConditions();

		content.addItem(this.podConditionsLoading, { CSSStyles: cssStyles.text });

		this.initialized = true;
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		// Refresh
		const refreshButton = this.modelView.modelBuilder.button().withProps({
			label: loc.refresh,
			iconPath: IconPathHelper.refresh
		}).component();

		this.disposables.push(
			refreshButton.onDidClick(async () => {
				refreshButton.enabled = false;
				try {
					this.podConditionsLoading!.loading = true;
					await this._postgresModel.refresh();
				} catch (error) {
					vscode.window.showErrorMessage(loc.refreshFailed(error));
				}
				finally {
					refreshButton.enabled = true;
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: refreshButton }
		]).component();
	}

	private createPodList(): string[] {
		const podStatus = this._postgresModel.config?.status.podsStatus;
		let podNames: string[] = [];

		podStatus?.forEach(p => {
			let podHealthModels: PodHealthModel[] = [];
			let indexes: number[] = [];


			p.conditions.forEach(c => {
				let message: string;
				let imageComponent = this.modelView.modelBuilder.image().withProps({
					width: iconSize,
					height: iconSize,
					iconHeight: '15px',
					iconWidth: '15px'
				}).component();

				if (c.status === 'False') {
					imageComponent.iconPath = IconPathHelper.fail;
					message = c.message ?? c.reason ?? '';
				} else {
					imageComponent.iconPath = IconPathHelper.success;

					if (c.type === PodConditionType.initialized) {
						message = loc.podInitialized;
					} else if (c.type === PodConditionType.ready) {
						message = loc.podReady;
					} else if (c.type === PodConditionType.containersReady) {
						message = loc.containerReady;
					} else if (c.type === PodConditionType.podScheduled) {
						message = loc.podScheduled;
					} else {
						message = c.message ?? c.reason ?? '';
					}
				}

				const conditionContainer = this.modelView.modelBuilder.flexContainer().withProps({
					CSSStyles: { 'alignItems': 'center', 'height': '15px' }
				}).component();
				conditionContainer.addItem(imageComponent, { CSSStyles: { 'margin-right': '0px' } });
				conditionContainer.addItem(this.modelView.modelBuilder.text().withProps({
					value: message,
				}).component());

				indexes.push(this.podsData.length);
				this.podsData.push({
					condition: c.type,
					details: conditionContainer,
					lastUpdate: c.lastTransitionTime
				});
			});

			if (p.role.toUpperCase() !== loc.coordinator.toUpperCase()) {
				podNames.push(p.name);
			} else {
				this.coordinatorData = podHealthModels;
				this.coordinatorPodName = p.name;
				podNames.unshift(p.name);
			}
			this.podConditionsTableIndexes.set(p.name, indexes);
		});

		this.podConditionsTable.setDataValues(this.createPodConditionsDataValues(this.podsData));

		return podNames;
	}

	private createPodConditionsDataValues(podInfo: PodHealthModel[]): azdata.DeclarativeTableCellValue[][] {
		let podDataValues: (string | azdata.Component)[][] = podInfo.map(p => [p.condition, p.details, p.lastUpdate]);
		return podDataValues.map(p => {
			return p.map((value): azdata.DeclarativeTableCellValue => {
				return { value: value };
			});
		});
	}

	private findPodIssues(): string[] {
		const podStatus = this._postgresModel.config?.status.podsStatus;
		let issueCount = 0;
		let podIssuesDetected: string[] = [];

		podStatus?.forEach(p => {
			p.conditions.forEach(c => {
				if (c.status === 'False') {
					issueCount++;
				}
			});

			if (issueCount > 0) {
				podIssuesDetected.push(loc.numberOfIssuesDetected(p.name, issueCount));
				issueCount = 0;
			}
		});

		return podIssuesDetected;
	}

	private refreshPodSummarySection(): void {
		let podSummaryTitle = this.modelView.modelBuilder.flexContainer().withProps({
			CSSStyles: { 'alignItems': 'center', 'height': '15px', 'margin-top': '20px' }
		}).component();
		if (!this._postgresModel.config) {
			podSummaryTitle.addItem(this.modelView.modelBuilder.loadingComponent().component(), { CSSStyles: { 'margin-right': '5px' } });
			podSummaryTitle.addItem(this.modelView.modelBuilder.text().withProps({
				value: loc.loading,
				CSSStyles: { ...cssStyles.title }
			}).component());
			this.podSummaryContainer.addItem(podSummaryTitle);
		} else {
			let components: azdata.Component[] = [];
			let imageComponent = this.modelView.modelBuilder.image().withProps({
				iconPath: IconPathHelper.success,
				width: iconSize,
				height: iconSize,
				iconHeight: '20px',
				iconWidth: '20px'
			}).component();

			let podIssues = this.findPodIssues();
			if (podIssues.length === 0) {
				imageComponent.iconPath = IconPathHelper.success;
				podSummaryTitle.addItem(imageComponent, { CSSStyles: { 'margin-right': '5px' } });
				podSummaryTitle.addItem(this.modelView.modelBuilder.text().withProps({
					value: loc.available,
					CSSStyles: { ...cssStyles.title, 'margin-left': '0px' }
				}).component());
				components.push(podSummaryTitle);
				components.push(this.modelView.modelBuilder.text().withProps({
					value: loc.noPodIssuesDetected,
					CSSStyles: { ...cssStyles.text, 'margin-top': '20px' }
				}).component());
			} else {
				imageComponent.iconPath = IconPathHelper.fail;
				podSummaryTitle.addItem(imageComponent, { CSSStyles: { 'margin-right': '5px' } });
				podSummaryTitle.addItem(this.modelView.modelBuilder.text().withProps({
					value: loc.issuesDetected,
					CSSStyles: { ...cssStyles.title }
				}).component());
				components.push(podSummaryTitle);
				components.push(this.modelView.modelBuilder.text().withProps({
					value: loc.podIssuesDetected,
					CSSStyles: { ...cssStyles.text, 'margin-top': '20px 0px 10px 0px' }
				}).component());
				components.push(...podIssues.map(i => {
					return this.modelView.modelBuilder.text().withProps({
						value: i,
						CSSStyles: { ...cssStyles.text, 'margin': '0px' }
					}).component();
				}));
			}
			this.podSummaryContainer.addItems(components);
		}
	}

	private refreshPodConditions(): void {
		if (this._postgresModel.config) {
			this.podConditionsTableIndexes = new Map();
			this.podsData = [];
			this.podDropDown.values = this.createPodList();
			this.podConditionsTable.setFilter(this.podConditionsTableIndexes.get(this.coordinatorPodName!));
			this.podConditionsLoading.loading = false;
		}
	}

	private handleConfigUpdated() {
		this.podSummaryContainer.clearItems();
		this.refreshPodSummarySection();
		this.refreshPodConditions();
	}
}
