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

	private podOverviewLoading!: azdata.LoadingComponent;
	private podOverviewTable!: azdata.DeclarativeTableComponent;

	private availablePodsContainer!: azdata.DivContainer;
	private podConditionsContainer!: azdata.DivContainer;
	private podConditionsLoading!: azdata.LoadingComponent;
	private podConditionsTable!: azdata.DeclarativeTableComponent;

	private pods: Map<string, PodHealthModel[]> = new Map();

	private podDropDown!: azdata.DropDownComponent;
	//private coordinatorPodName?: string;

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

		overviewBox.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.podOverview,
			CSSStyles: { ...cssStyles.title, 'margin': '10px 20px 20px 20px' }
		}).component());

		this.podOverviewTable = this.modelView.modelBuilder.declarativeTable().component();

		this.podOverviewLoading = this.modelView.modelBuilder.loadingComponent()
			.withItem(this.podOverviewTable)
			.withProperties<azdata.LoadingComponentProperties>({
				loading: !this._postgresModel.configLastUpdated
			}).component();

		overviewBox.addItem(this.podOverviewLoading, { CSSStyles: cssStyles.text });

		content.addItem(overviewBox);

		this.availablePodsContainer = this.modelView.modelBuilder.divContainer().component();

		this.availablePodsContainer.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.availablePods,
			CSSStyles: { ...cssStyles.title }
		}).component());

		// Pod Conditions
		this.podConditionsContainer = this.modelView.modelBuilder.divContainer().component();
		//const titleCSS = { ...cssStyles.title, 'margin-block-start': '2em', 'margin-block-end': '0' };
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
			data: []
		}).component();

		this.podDropDown = this.modelView.modelBuilder.dropDown().withProps({ width: '150px' }).component();
		this.disposables.push(
			this.podDropDown.onValueChanged(() => {
				this.podConditionsTable.data = this.pods.get(String(this.podDropDown.value))?.map(p => [p.condition, p.details, p.lastUpdate]);
			})
		);

		this.podConditionsContainer.addItem(this.podDropDown);
		this.podConditionsContainer.addItem(this.podConditionsTable);


		this.podConditionsLoading = this.modelView.modelBuilder.loadingComponent().withItem(this.podConditionsContainer).component();

		// this.availablePodsContainer.addItem(this.podConditionsLoading, { CSSStyles: cssStyles.text });

		this.selectComponent();

		content.addItem(this.availablePodsContainer, { CSSStyles: cssStyles.text });

		this.initialized = true;
		return root;
	}

	private selectComponent(): void {
		if (!this._postgresModel.configLastUpdated) {
			this.availablePodsContainer.addItem(this.podConditionsLoading, { CSSStyles: cssStyles.text });
		} else {
			this.podConditionsLoading.loading = false;
			this.podDropDown.values = this.getPods();
			this.availablePodsContainer.addItem(this.podConditionsContainer);
		}
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

	private getPods(): string[] {
		const podStatus = this._postgresModel.config?.status.podsStatus;
		let podNames: string[] = [];

		podStatus?.forEach(p => {
			let podHealthModels: PodHealthModel[] = [];

			if (p.role.toUpperCase() !== loc.coordinator.toUpperCase()) {
				podNames.push(p.name);
			} else {
				//this.coordinatorPodName = p.name;
				podNames.unshift(p.name);
			}

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

				podHealthModels.push({
					condition: c.type,
					details: condtionContainer,
					lastUpdate: c.lastTransitionTime
				});
			});
			this.pods.set(p.name, podHealthModels);
		});

		return podNames;
	}

	private refreshPodcondtions(): void {
		if (this._postgresModel.config) {
			this.podDropDown.values = this.getPods();
			//this.podConditionsTable.data = this.pods.get(this.coordinatorPodName!)?.map(p => [p.condition, p.details, p.lastUpdate]);
			this.podConditionsLoading.loading = false;
		}
	}

	private handleConfigUpdated() {
		this.refreshPodcondtions();
	}
}
