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

export type PodHealthModel = {
	condition: string,
	details?: azdata.Component,
	lastUpdate: string
};

export class PostgresResourceHealthPage extends DashboardPage {
	private runningPodsLoading!: azdata.LoadingComponent;
	private pendingPodsLoading!: azdata.LoadingComponent;
	private runningPods!: azdata.TextComponent;
	private pendingPods!: azdata.TextComponent;

	private podConditionsContainer!: azdata.DivContainer;
	private podConditionsLoading!: azdata.LoadingComponent;
	private podConditionsTable!: azdata.DeclarativeTableComponent;
	private podConditionsTableIndexes: Map<string, number[]> = new Map();

	private podDropDown!: azdata.DropDownComponent;
	private coordinatorPodName!: string;
	private coordinatorData: PodHealthModel[] = [];
	private podsData: PodHealthModel[] = [];

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
			CSSStyles: { 'border': 'solid 1px #ccc', 'height': '200px', 'width': '300px', }
		}).component();

		overviewBox.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.podOverview,
			CSSStyles: { ...cssStyles.title, 'margin': '10px 20px 20px 20px' }
		}).component());

		this.runningPodsLoading = this.modelView.modelBuilder.loadingComponent().withProperties<azdata.LoadingComponentProperties>({
			loading: !this._postgresModel.configLastUpdated
		}).component();

		this.pendingPodsLoading = this.modelView.modelBuilder.loadingComponent().withProperties<azdata.LoadingComponentProperties>({
			loading: !this._postgresModel.configLastUpdated
		}).component();

		this.runningPods = this.modelView.modelBuilder.text().withProps({
			CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'font-size': '16px' }
		}).component();

		this.pendingPods = this.modelView.modelBuilder.text().withProps({
			CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'font-size': '16px' }
		}).component();

		this.refreshPodOverviewBox();

		this.runningPodsLoading.component = this.runningPods;
		this.pendingPodsLoading.component = this.pendingPods;

		const podOverviewTable = this.modelView.modelBuilder.declarativeTable().withProps({
			columns: [
				{
					displayName: '',
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: '20px',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: '',
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '230px',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			data: [
				[this.runningPodsLoading, loc.running],
				[this.pendingPodsLoading, loc.pending]]
		}).component();
		overviewBox.addItem(podOverviewTable, { CSSStyles: { 'margin': '10px 20px 20px 20px' } });
		content.addItem(overviewBox);

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.availablePods,
			CSSStyles: { ...cssStyles.title }
		}).component());

		// Pod Conditions
		this.podConditionsContainer = this.modelView.modelBuilder.divContainer().component();
		this.podConditionsTable = this.modelView.modelBuilder.declarativeTable().withProps({
			width: '100%',
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
						'overflow': 'hidden',
						'text-overflow': 'ellipsis',
						'white-space': 'nowrap',
						'max-width': '0'
					}
				},
				{
					displayName: loc.lastUpdated,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '30%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			data: [this.coordinatorData.map(p => [p.condition, p.details, p.lastUpdate])]
		}).component();

		this.podDropDown = this.modelView.modelBuilder.dropDown().withProps({ width: '150px' }).component();
		this.disposables.push(
			this.podDropDown.onValueChanged(() => {
				this.podConditionsTable.setFilter(this.podConditionsTableIndexes.get(String(this.podDropDown.value)));
			})
		);

		this.podConditionsContainer.addItem(this.podDropDown);
		this.podConditionsContainer.addItem(this.podConditionsTable);
		this.podConditionsLoading = this.modelView.modelBuilder.loadingComponent()
			.withItem(this.podConditionsContainer)
			.withProperties<azdata.LoadingComponentProperties>({
				loading: !this._postgresModel.configLastUpdated
			}).component();

		this.refreshPodCondtions();

		content.addItem(this.podConditionsLoading, { CSSStyles: cssStyles.text });

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
					this.podConditionsLoading!.loading = true;

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

	private getPodOverview(): void {
		const podStatus = this._postgresModel.config?.status.podsStatus;
		let runningPodCount = 0;
		let pendingPodCount = 0;

		podStatus?.forEach(p => {
			// If a condition of the pod has a status of False, pod is not Ready
			if (p.conditions.find(c => c.status === 'False') ? true : false) {
				pendingPodCount++;
			} else {
				runningPodCount++;
			}
		});

		this.runningPods.value = runningPodCount.toString();

		this.pendingPods.value = pendingPodCount.toString();
	}

	private getPods(): string[] {
		const podStatus = this._postgresModel.config?.status.podsStatus;
		let podNames: string[] = [];

		podStatus?.forEach(p => {
			let podHealthModels: PodHealthModel[] = [];
			let indexes: number[] = [];


			p.conditions.forEach(c => {
				const condtionContainer = this.modelView.modelBuilder.flexContainer().withProps({
					CSSStyles: { 'alignItems': 'center', 'height': '15px' }
				}).component();

				if (c.status === 'False') {
					const imageComponent = this.modelView.modelBuilder.image().withProps({
						iconPath: IconPathHelper.fail,
						width: iconSize,
						height: iconSize,
						iconHeight: '15px',
						iconWidth: '15px'
					}).component();
					condtionContainer.addItem(imageComponent, { CSSStyles: { 'margin-right': '0px' } });

					condtionContainer.addItem(this.modelView.modelBuilder.text().withProps({
						value: c.message,
					}).component());
				} else {
					const imageComponent = this.modelView.modelBuilder.image().withProps({
						iconPath: IconPathHelper.success,
						width: iconSize,
						height: iconSize,
						iconHeight: '15px',
						iconWidth: '15px'
					}).component();
					condtionContainer.addItem(imageComponent, { CSSStyles: { 'margin-right': '0px' } });

					if (c.type === 'Initialized') {
						condtionContainer.addItem(this.modelView.modelBuilder.text().withProps({
							value: loc.podInitialized,
						}).component());
					} else if (c.type === 'Ready') {
						condtionContainer.addItem(this.modelView.modelBuilder.text().withProps({
							value: loc.podReady,
						}).component());
					} else if (c.type === 'ContainersReady') {
						condtionContainer.addItem(this.modelView.modelBuilder.text().withProps({
							value: loc.containerReady,
						}).component());
					} else if (c.type === 'PodScheduled') {
						condtionContainer.addItem(this.modelView.modelBuilder.text().withProps({
							value: loc.podScheduled,
						}).component());
					}
				}

				indexes.push(this.podsData.length);
				this.podsData.push({
					condition: c.type,
					details: condtionContainer,
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

		this.podConditionsTable.data = this.podsData.map(p => [p.condition, p.details, p.lastUpdate]);

		return podNames;
	}

	private refreshPodOverviewBox(): void {
		if (this._postgresModel.config) {
			this.getPodOverview();
			this.runningPodsLoading.loading = false;
			this.pendingPodsLoading.loading = false;
		}
	}

	private refreshPodCondtions(): void {
		if (this._postgresModel.config) {
			this.podConditionsTableIndexes = new Map();
			this.podDropDown.values = this.getPods();
			this.podConditionsTable.setFilter(this.podConditionsTableIndexes.get(this.coordinatorPodName!));
			this.podConditionsLoading.loading = false;
		}
	}

	private handleConfigUpdated() {
		this.refreshPodOverviewBox();
		this.refreshPodCondtions();
	}
}
