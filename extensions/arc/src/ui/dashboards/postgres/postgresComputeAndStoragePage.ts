/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azdataExt from 'azdata-ext';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { PostgresModel } from '../../../models/postgresModel';
import { convertToGibibyteString } from '../../../common/utils';

export type ConfigurationSpecModel = {
	workers?: number,
	workerCoresRequest?: string,
	workerCoresLimit?: string,
	workerMemoryRequest?: string,
	workerMemoryLimit?: string,
	coordinatorCoresRequest?: string,
	coordinatorCoresLimit?: string,
	coordinatorMemoryRequest?: string,
	coordinatorMemoryLimit?: string
};

export class PostgresComputeAndStoragePage extends DashboardPage {
	private workerContainer!: azdata.DivContainer;
	private workerContainerLoading!: azdata.LoadingComponent;
	private coordinatorContainer?: azdata.DivContainer;
	// private coordinatorContainerLoading!: azdata.LoadingComponent;

	private workerComponent!: azdata.SliderComponent;
	private workerCoresLimitComponent!: azdata.SliderComponent;
	private workerCoresRequestComponent!: azdata.SliderComponent;
	private workerMemoryLimitComponent!: azdata.SliderComponent;
	private workerMemoryRequestComponent!: azdata.SliderComponent;

	private coordinatorCoresLimitComponent!: azdata.SliderComponent;
	private coordinatorCoresRequestComponent!: azdata.SliderComponent;
	private coordinatorMemoryLimitComponent!: azdata.SliderComponent;
	private coordinatorMemoryRequestComponent!: azdata.SliderComponent;

	private currentConfiguration: ConfigurationSpecModel = {};
	private saveArgs: ConfigurationSpecModel = {};

	private discardButton!: azdata.ButtonComponent;
	private saveButton!: azdata.ButtonComponent;

	private readonly _azdataApi: azdataExt.IExtension;

	constructor(protected modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _postgresModel: PostgresModel) {
		super(modelView, dashboard);
		this._azdataApi = vscode.extensions.getExtension(azdataExt.extension.name)?.exports;

		this.initializeConfigurationBoxes();

		this.disposables.push(this._postgresModel.onConfigUpdated(
			() => this.eventuallyRunOnInitialized(() => this.handleServiceUpdated())));
	}

	protected get title(): string {
		return loc.computeAndStorage;
	}

	protected get id(): string {
		return 'postgres-compute-and-storage';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.computeStorage;
	}

	protected get container(): azdata.Component {
		const root = this.modelView.modelBuilder.divContainer().component();
		const content = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '20px' } });

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.computeAndStorage,
			CSSStyles: { ...cssStyles.title }
		}).component());

		const infoComputeStorage_p1 = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.postgresComputeAndStorageDescriptionPartOne,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px', 'max-width': 'auto' }
		}).component();
		const infoComputeStorage_p2 = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.postgresComputeAndStorageDescriptionPartTwo,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const workerNodeslink = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: loc.addingWorkerNodes,
			url: 'https://docs.microsoft.com/azure/azure-arc/data/scale-up-down-postgresql-hyperscale-server-group-using-cli',
			CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const infoComputeStorage_p3 = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.computeAndStorageDescriptionPartThree,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const memoryVCoreslink = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: loc.scalingCompute,
			url: 'https://docs.microsoft.com/azure/azure-arc/data/scale-up-down-postgresql-hyperscale-server-group-using-cli',
			CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const infoComputeStorage_p4 = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.computeAndStorageDescriptionPartFour,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const infoComputeStorage_p5 = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.computeAndStorageDescriptionPartFive,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const infoComputeStorage_p6 = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.computeAndStorageDescriptionPartSix,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const computeInfoAndLinks = this.modelView.modelBuilder.flexContainer()
			.withLayout({ flexWrap: 'wrap' })
			.withItems([
				infoComputeStorage_p1,
				infoComputeStorage_p2,
				workerNodeslink,
				infoComputeStorage_p3,
				memoryVCoreslink,
				infoComputeStorage_p4,
				infoComputeStorage_p5,
				infoComputeStorage_p6
			], { CSSStyles: { 'margin-right': '5px' } })
			.component();
		content.addItem(computeInfoAndLinks, { CSSStyles: { 'min-height': '30px' } });

		// Worker nodes section
		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.workerNodes,
			CSSStyles: { ...cssStyles.title, 'margin-top': '25px' }
		}).component());

		this.workerContainer = this.modelView.modelBuilder.divContainer().component();
		this.workerContainer.addItems(this.createUserInputWorkerSection(), { CSSStyles: { 'min-height': '30px' } });

		this.workerContainerLoading = this.modelView.modelBuilder.loadingComponent()
			.withItem(this.workerContainer)
			.withProperties<azdata.LoadingComponentProperties>({
				loading: !this._postgresModel.configLastUpdated
			}).component();
		content.addItem(this.workerContainerLoading, { CSSStyles: cssStyles.text });

		// Coordinator node section
		// TODO unhide once once ready to make azdata calls
		/* this.coordinatorContainer.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.coordinatorNode,
			CSSStyles: { ...cssStyles.title, 'margin-top': '25px' }
		}).component()); */

		this.coordinatorContainer = this.modelView.modelBuilder.divContainer().component();
		this.coordinatorContainer.addItems(this.createUserInputCoordinatorSection(), { CSSStyles: { 'min-height': '30px' } });

		/* this.coordinatorContainerLoading = this.modelView.modelBuilder.loadingComponent()
			.withItem(this.workerContainer)
			.withProperties<azdata.LoadingComponentProperties>({
				loading: !this._postgresModel.configLastUpdated
			}).component();
		content.addItem(this.workerContainerLoading, { CSSStyles: cssStyles.text }); */

		this.initialized = true;
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		// Save Edits
		this.saveButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.saveText,
			iconPath: IconPathHelper.save,
			enabled: false
		}).component();

		this.disposables.push(
			this.saveButton.onDidClick(async () => {
				this.saveButton!.enabled = false;
				try {
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: loc.updatingInstance(this._postgresModel.info.name),
							cancellable: false
						},
						async (_progress, _token): Promise<void> => {
							let session: azdataExt.AzdataSession | undefined = undefined;
							try {
								session = await this._postgresModel.controllerModel.acquireAzdataSession();
								await this._azdataApi.azdata.arc.postgres.server.edit(
									this._postgresModel.info.name,
									{
										workers: this.saveArgs.workers,
										coresRequest: this.saveArgs.workerCoresRequest,
										coresLimit: this.saveArgs.workerCoresLimit,
										memoryRequest: this.saveArgs.workerMemoryRequest,
										memoryLimit: this.saveArgs.workerMemoryLimit
									},
									this._postgresModel.engineVersion,
									this._postgresModel.controllerModel.azdataAdditionalEnvVars,
									session
								);
								/* TODO add second edit call for coordinator configuration
									await this._azdataApi.azdata.arc.postgres.server.edit(
										this._postgresModel.info.name,
										{
										coresRequest: this.saveArgs.coordinatorCoresRequest,
										coresLimit: this.saveArgs.coordinatorCoresLimit,
										memoryRequest: this.saveArgs.coordinatorMemoryRequest,
										memoryLimit: this.saveArgs.coordinatorMemoryLimit
										},
										this._postgresModel.engineVersion,
										this._postgresModel.controllerModel.azdataAdditionalEnvVars,
										session
									);
								*/
							} catch (err) {
								// If an error occurs while editing the instance then re-enable the save button since
								// the edit wasn't successfully applied
								this.saveButton!.enabled = true;
								throw err;
							} finally {
								session?.dispose();
							}
							try {
								await this._postgresModel.refresh();
							} catch (error) {
								vscode.window.showErrorMessage(loc.refreshFailed(error));
							}
						}
					);

					vscode.window.showInformationMessage(loc.instanceUpdated(this._postgresModel.info.name));

					this.discardButton!.enabled = false;

				} catch (error) {
					vscode.window.showErrorMessage(loc.instanceUpdateFailed(this._postgresModel.info.name, error));
				}
			}));

		// Discard
		this.discardButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.discardText,
			iconPath: IconPathHelper.discard,
			enabled: false
		}).component();

		this.disposables.push(
			this.discardButton.onDidClick(async () => {
				this.discardButton!.enabled = false;
				try {
					this.workerComponent.value = this.currentConfiguration.workers!;
					this.workerCoresRequestComponent.value = parseInt(this.currentConfiguration.workerCoresRequest!);
					this.workerCoresLimitComponent.value = parseInt(this.currentConfiguration.workerCoresLimit!);
					this.workerMemoryRequestComponent.value = parseInt(this.currentConfiguration.workerMemoryRequest!);
					this.workerMemoryLimitComponent.value = parseInt(this.currentConfiguration.workerMemoryLimit!);
				} catch (error) {
					vscode.window.showErrorMessage(loc.pageDiscardFailed(error));
				} finally {
					this.saveButton!.enabled = false;
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: this.saveButton },
			{ component: this.discardButton }
		]).component();
	}

	private initializeConfigurationBoxes(): void {
		// Worker node count
		this.workerComponent = this.modelView.modelBuilder.slider().withProps({
			min: 0
		}).component();

		this.disposables.push(
			this.workerComponent.onChanged(() => {
				if (!this.saveValueToEdit(this.workerComponent, this.currentConfiguration.workers!.toString())) {
					this.saveArgs.workers = undefined;
				} else {
					this.saveArgs.workers = this.workerComponent.value!;
				}
			})
		);

		// Worker nodes cores request
		this.workerCoresRequestComponent = this.modelView.modelBuilder.slider().withProps({
			min: 1,
			max: 64
		}).component();

		this.disposables.push(
			this.workerCoresRequestComponent.onChanged(() => {
				if (!(this.saveValueToEdit(this.workerCoresRequestComponent, this.currentConfiguration.workerCoresRequest!))) {
					this.saveArgs.workerCoresRequest = undefined;
				} else if (this.workerMemoryRequestComponent.value) {
					this.saveArgs.workerCoresRequest = '""';
				} else {
					this.saveArgs.workerCoresRequest = this.workerCoresRequestComponent.value!.toString();
				}
			})
		);

		// Worker nodes cores limit
		this.workerCoresLimitComponent = this.modelView.modelBuilder.slider().withProps({
			min: 1,
			max: 64
		}).component();

		this.disposables.push(
			this.workerCoresLimitComponent.onChanged(() => {
				if (!(this.saveValueToEdit(this.workerCoresLimitComponent, this.currentConfiguration.workerCoresLimit!))) {
					this.saveArgs.workerCoresLimit = undefined;
				} else if (this.workerMemoryRequestComponent.value) {
					this.saveArgs.workerCoresLimit = '""';
				} else {
					this.saveArgs.workerCoresLimit = this.workerCoresLimitComponent.value!.toString();
				}
			})
		);

		// Worker nodes memory request
		this.workerMemoryRequestComponent = this.modelView.modelBuilder.slider().withProps({
			min: 0.25,
			max: 16384
		}).component();

		this.disposables.push(
			this.workerMemoryRequestComponent.onChanged(() => {
				if (!(this.saveValueToEdit(this.workerMemoryRequestComponent, this.currentConfiguration.workerMemoryRequest!))) {
					this.saveArgs.workerMemoryRequest = undefined;
				} else if (this.workerMemoryRequestComponent.value) {
					this.saveArgs.workerMemoryRequest = '""';
				} else {
					this.saveArgs.workerMemoryRequest = this.workerMemoryRequestComponent.value + 'Gi';
				}
			})
		);

		// Worker nodes memory limit
		this.workerMemoryLimitComponent = this.modelView.modelBuilder.slider().withProps({
			min: 0.25,
			max: 16384
		}).component();

		this.disposables.push(
			this.workerMemoryLimitComponent.onChanged(() => {
				if (!(this.saveValueToEdit(this.workerMemoryLimitComponent, this.currentConfiguration.workerMemoryLimit!))) {
					this.saveArgs.workerMemoryLimit = undefined;
				} else if (this.workerMemoryLimitComponent.value) {
					this.saveArgs.workerMemoryLimit = '""';
				} else {
					this.saveArgs.workerMemoryLimit = this.workerMemoryLimitComponent.value + 'Gi';
				}
			})
		);

		// Coordinator node cores request
		this.coordinatorCoresRequestComponent = this.modelView.modelBuilder.slider().withProps({
			min: 1,
			max: 64
		}).component();

		this.disposables.push(
			this.coordinatorCoresRequestComponent.onChanged(() => {
				if (!(this.saveValueToEdit(this.coordinatorCoresRequestComponent, this.currentConfiguration.coordinatorCoresRequest!))) {
					this.saveArgs.coordinatorCoresRequest = undefined;
				} else if (this.coordinatorCoresRequestComponent.value) {
					this.saveArgs.coordinatorCoresRequest = '""';
				} else {
					this.saveArgs.coordinatorCoresRequest = this.coordinatorCoresRequestComponent.value!.toString();
				}
			})
		);

		// Coordinator node cores limit
		this.coordinatorCoresLimitComponent = this.modelView.modelBuilder.slider().withProps({
			min: 1,
			max: 64
		}).component();

		this.disposables.push(
			this.coordinatorCoresLimitComponent.onChanged(() => {
				if (!(this.saveValueToEdit(this.coordinatorCoresLimitComponent, this.currentConfiguration.coordinatorCoresLimit!))) {
					this.saveArgs.coordinatorCoresLimit = undefined;
				} else if (this.coordinatorCoresLimitComponent.value) {
					this.saveArgs.coordinatorCoresLimit = '""';
				} else {
					this.saveArgs.coordinatorCoresLimit = this.coordinatorCoresLimitComponent!.value!.toString();
				}
			})
		);

		// Coordinator node memory request
		this.coordinatorMemoryRequestComponent = this.modelView.modelBuilder.slider().withProps({
			min: 0.25,
			max: 16384
		}).component();

		this.disposables.push(
			this.coordinatorMemoryRequestComponent.onChanged(() => {
				if (!(this.saveValueToEdit(this.coordinatorMemoryRequestComponent, this.currentConfiguration.coordinatorMemoryRequest!))) {
					this.saveArgs.coordinatorMemoryRequest = undefined;
				} else if (this.coordinatorMemoryRequestComponent.value) {
					this.saveArgs.coordinatorMemoryRequest = '""';
				} else {
					this.saveArgs.coordinatorMemoryRequest = this.coordinatorMemoryRequestComponent.value + 'Gi';
				}
			})
		);

		// Coordinator node memory limit
		this.coordinatorMemoryLimitComponent = this.modelView.modelBuilder.slider().withProps({
			min: 0.25,
			max: 16384
		}).component();

		this.disposables.push(
			this.coordinatorMemoryLimitComponent.onChanged(() => {
				if (!(this.saveValueToEdit(this.coordinatorMemoryLimitComponent, this.currentConfiguration.coordinatorMemoryLimit!))) {
					this.saveArgs.coordinatorMemoryLimit = undefined;
				} else if (this.coordinatorMemoryLimitComponent.value) {
					this.saveArgs.coordinatorMemoryLimit = '""';
				} else {
					this.saveArgs.coordinatorMemoryLimit = this.coordinatorMemoryLimitComponent.value + 'Gi';
				}
			})
		);
	}

	private createUserInputWorkerSection(): azdata.Component[] {
		if (this._postgresModel.configLastUpdated) {
			this.editWorkerNodeCount();
			this.editWorkerCores();
			this.editWorkerMemory();
		}

		return [
			this.createWorkerNodesSectionContainer(),
			this.createCoresMemorySection(loc.configurationPerNode, loc.postgresConfigurationInformation),	// use loc.workerNodesConfigurationInformation when coordinator section is included
			this.createConfigurationSectionContainer(loc.coresRequest, this.workerCoresRequestComponent!),
			this.createConfigurationSectionContainer(loc.coresLimit, this.workerCoresLimitComponent!),
			this.createConfigurationSectionContainer(loc.memoryRequest, this.workerMemoryRequestComponent!),
			this.createConfigurationSectionContainer(loc.memoryLimit, this.workerMemoryLimitComponent!)

		];
	}

	private createWorkerNodesSectionContainer(): azdata.FlexContainer {
		const inputFlex = { flex: '0 1 500px' };
		const keyFlex = { flex: `0 1 250px` };

		const flexContainer = this.modelView.modelBuilder.flexContainer().withLayout({
			flexWrap: 'wrap',
			alignItems: 'center'
		}).component();

		const keyComponent = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.workerNodeCount,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const keyContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		keyContainer.addItem(keyComponent, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '15px' } });

		const information = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			iconPath: IconPathHelper.information,
			title: loc.workerNodesInformation,
			width: '15px',
			height: '15px',
			enabled: false
		}).component();

		keyContainer.addItem(information, { CSSStyles: { 'margin-left': '5px', 'margin-bottom': '15px' } });
		flexContainer.addItem(keyContainer, keyFlex);

		const inputContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		inputContainer.addItem(this.workerComponent!, { CSSStyles: { 'margin-bottom': '15px', 'min-width': '100px', 'max-width': '350px' } });
		flexContainer.addItem(inputContainer, inputFlex);

		return flexContainer;
	}

	private createUserInputCoordinatorSection(): azdata.Component[] {
		if (this._postgresModel.configLastUpdated) {
			this.editCoordinatorCores();
			this.editCoordinatorMemory();
		}

		return [
			this.createCoresMemorySection(loc.configuration, loc.coordinatorNodeConfigurationInformation),
			this.createConfigurationSectionContainer(loc.coresRequest, this.coordinatorCoresRequestComponent!),
			this.createConfigurationSectionContainer(loc.coresLimit, this.coordinatorCoresLimitComponent!),
			this.createConfigurationSectionContainer(loc.memoryRequest, this.coordinatorMemoryRequestComponent!),
			this.createConfigurationSectionContainer(loc.memoryLimit, this.coordinatorMemoryLimitComponent!)

		];
	}

	private createConfigurationSectionContainer(key: string, input: azdata.Component): azdata.FlexContainer {
		const inputFlex = { flex: '0 1 500px' };
		const keyFlex = { flex: `0 1 250px` };

		const flexContainer = this.modelView.modelBuilder.flexContainer().withLayout({
			flexWrap: 'wrap',
			alignItems: 'center'
		}).component();

		const keyComponent = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: key,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const keyContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		keyContainer.addItem(keyComponent, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '15px' } });
		flexContainer.addItem(keyContainer, keyFlex);

		const inputContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		inputContainer.addItem(input, { CSSStyles: { 'margin-bottom': '15px', 'min-width': '100px', 'max-width': '350px' } });

		flexContainer.addItem(inputContainer, inputFlex);

		return flexContainer;
	}

	/**
	 * A function that determines if an input box's value should be considered or not.
	 * Tiggers the save and discard buttons to become enabled depnding on the value change.
	 *
	 * If new value is the same as value found in config, do not consider this new value for editing.
	 * If new value is invalid, do not consider this new value for editing and enable discard button.
	 * If value is valid and not equal to original value found in config, add this new value to be considered
	 * for editing and enable save/discard buttons.
	 *
	 * @param component The input box that had an onTextChanged event triggered.
	 * @param originalValue The value that was contained in the input box before user interaction.
	 * @return A boolean that reads true if the new value should be taken in for editing or not.
	 */
	private saveValueToEdit(component: azdata.SliderComponent, originalValue: string): boolean {
		if (component.value?.toString() === originalValue) {
			return false;
		} else if ((!component.valid)) {
			return false;
		} else {
			this.saveButton!.enabled = true;
			this.discardButton!.enabled = true;
			return true;
		}
	}

	private editWorkerNodeCount(): void {
		// scale.shards was renamed to scale.workers. Check both for backwards compatibility.
		let scale = this._postgresModel.config?.spec.scale;
		this.currentConfiguration.workers = scale?.workers ?? scale?.shards ?? 0;

		this.workerComponent.min = this.currentConfiguration.workers;
		this.workerComponent.value = this.currentConfiguration.workers;
		this.saveArgs.workers = undefined;
	}

	private createCoresMemorySection(title: string, description: string): azdata.DivContainer {
		const titleFlex = { flex: `0 1 250px` };

		const flexContainer = this.modelView.modelBuilder.flexContainer().withLayout({
			flexWrap: 'wrap',
			alignItems: 'center'
		}).component();

		const titleComponent = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: title,
			CSSStyles: { ...cssStyles.title, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const titleContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		titleContainer.addItem(titleComponent, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '15px' } });

		const information = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			iconPath: IconPathHelper.information,
			title: description,
			width: '15px',
			height: '15px',
			enabled: false
		}).component();

		titleContainer.addItem(information, { CSSStyles: { 'margin-left': '5px', 'margin-bottom': '15px' } });
		flexContainer.addItem(titleContainer, titleFlex);

		let configurationSection = this.modelView.modelBuilder.divContainer().component();
		configurationSection.addItem(flexContainer);

		return configurationSection;
	}

	private editWorkerCores(): void {
		//Cores Request
		this.currentConfiguration.workerCoresRequest = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.cpu;
		if (!this.currentConfiguration.workerCoresRequest) {
			this.currentConfiguration.workerCoresRequest = '';
		}

		this.workerCoresRequestComponent.value = parseInt(this.currentConfiguration.workerCoresRequest);
		this.saveArgs.workerCoresRequest = undefined;

		// Cores Limit
		this.currentConfiguration.workerCoresLimit = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.cpu;
		if (!this.currentConfiguration.workerCoresLimit) {
			this.currentConfiguration.workerCoresLimit = '';
		}

		this.workerCoresLimitComponent.value = parseInt(this.currentConfiguration.workerCoresLimit);
		this.saveArgs.workerCoresLimit = undefined;
	}

	private editWorkerMemory(): void {
		//Memory Request
		let currentMemorySize = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.memory;
		if (!currentMemorySize) {
			this.currentConfiguration.workerMemoryRequest = '';
		} else {
			this.currentConfiguration.workerMemoryRequest = convertToGibibyteString(currentMemorySize);
		}

		this.workerMemoryRequestComponent.value = parseInt(this.currentConfiguration.workerMemoryRequest);
		this.saveArgs.workerMemoryRequest = undefined;

		//Memory Limit
		currentMemorySize = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.memory;
		if (!currentMemorySize) {
			this.currentConfiguration.workerMemoryLimit = '';
		} else {
			this.currentConfiguration.workerMemoryLimit = convertToGibibyteString(currentMemorySize);
		}

		this.workerMemoryLimitComponent.value = parseInt(this.currentConfiguration.workerMemoryLimit);
		this.saveArgs.workerMemoryLimit = undefined;
	}

	private editCoordinatorCores(): void {
		// TODO get current cpu size for coordinator
		this.currentConfiguration.coordinatorCoresRequest = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.cpu;
		if (!this.currentConfiguration.coordinatorCoresRequest) {
			this.currentConfiguration.coordinatorCoresRequest = '';
		}

		this.coordinatorCoresRequestComponent.value = parseInt(this.currentConfiguration.coordinatorCoresRequest);
		this.saveArgs.coordinatorCoresRequest = undefined;

		// TODO get current cpu size for coordinator
		this.currentConfiguration.coordinatorCoresLimit = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.cpu;
		if (!this.currentConfiguration.coordinatorCoresLimit) {
			this.currentConfiguration.coordinatorCoresLimit = '';
		}

		this.coordinatorCoresLimitComponent.value = parseInt(this.currentConfiguration.coordinatorCoresLimit);
		this.saveArgs.coordinatorCoresLimit = undefined;
	}

	private editCoordinatorMemory(): void {
		// TODO get current memory size for coordinator
		let currentMemorySize = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.memory;
		if (!currentMemorySize) {
			this.currentConfiguration.coordinatorMemoryRequest = '';
		} else {
			this.currentConfiguration.coordinatorMemoryRequest = convertToGibibyteString(currentMemorySize);
		}

		this.coordinatorMemoryRequestComponent.value = parseInt(this.currentConfiguration.coordinatorMemoryRequest);
		this.saveArgs.coordinatorMemoryRequest = undefined;

		// TODO get current memory size for coordinator
		currentMemorySize = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.memory;
		if (!currentMemorySize) {
			this.currentConfiguration.coordinatorCoresLimit = '';
		} else {
			this.currentConfiguration.coordinatorCoresLimit = convertToGibibyteString(currentMemorySize);
		}

		this.coordinatorMemoryLimitComponent.value = parseInt(this.currentConfiguration.coordinatorMemoryLimit!);
		this.saveArgs.coordinatorMemoryLimit = undefined;
	}

	private handleServiceUpdated(): void {
		this.editWorkerNodeCount();
		this.editWorkerCores();
		this.editWorkerMemory();
		this.workerContainerLoading.loading = false;
		/* TODO perform once Coordinator section is in view
		this.coordinatorContainerLoading.loading = false;
		this.editCoordinatorCores();
		this.editCoordinatorMemory(); */
	}
}
