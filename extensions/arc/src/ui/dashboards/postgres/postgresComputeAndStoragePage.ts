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
	coresRequest: { w?: string, c?: string },
	coresLimit: { w?: string, c?: string },
	memoryRequest: { w?: string, c?: string },
	memoryLimit: { w?: string, c?: string }
};

export class PostgresComputeAndStoragePage extends DashboardPage {
	private workerContainer!: azdata.DivContainer;
	private coordinatorContainer!: azdata.DivContainer;

	private workerBox!: azdata.InputBoxComponent;
	private workerCoresLimitBox!: azdata.InputBoxComponent;
	private workerCoresRequestBox!: azdata.InputBoxComponent;
	private workerMemoryLimitBox!: azdata.InputBoxComponent;
	private workerMemoryRequestBox!: azdata.InputBoxComponent;

	private coordinatorCoresLimitBox!: azdata.InputBoxComponent;
	private coordinatorCoresRequestBox!: azdata.InputBoxComponent;
	private coordinatorMemoryLimitBox!: azdata.InputBoxComponent;
	private coordinatorMemoryRequestBox!: azdata.InputBoxComponent;

	private currentConfiguration: ConfigurationSpecModel = {
		coresRequest: {},
		coresLimit: {},
		memoryRequest: {},
		memoryLimit: {}
	};
	private saveArgs: ConfigurationSpecModel = {
		coresRequest: {},
		coresLimit: {},
		memoryRequest: {},
		memoryLimit: {}
	};

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

		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.computeAndStorage,
			CSSStyles: { ...cssStyles.title }
		}).component());

		const infoComputeStorage_p1 = this.modelView.modelBuilder.text().withProps({
			value: loc.postgresComputeAndStorageDescriptionPartOne,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px', 'max-width': 'auto' }
		}).component();
		const infoComputeStorage_p2 = this.modelView.modelBuilder.text().withProps({
			value: loc.postgresComputeAndStorageDescriptionPartTwo,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const workerNodeslink = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: loc.addingWorkerNodes,
			url: 'https://docs.microsoft.com/azure/azure-arc/data/scale-up-down-postgresql-hyperscale-server-group-using-cli',
			CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const infoComputeStorage_p3 = this.modelView.modelBuilder.text().withProps({
			value: loc.computeAndStorageDescriptionPartThree,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const memoryVCoreslink = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: loc.scalingCompute,
			url: 'https://docs.microsoft.com/azure/azure-arc/data/scale-up-down-postgresql-hyperscale-server-group-using-cli',
			CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const infoComputeStorage_p4 = this.modelView.modelBuilder.text().withProps({
			value: loc.computeAndStorageDescriptionPartFour,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const infoComputeStorage_p5 = this.modelView.modelBuilder.text().withProps({
			value: loc.computeAndStorageDescriptionPartFive,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const infoComputeStorage_p6 = this.modelView.modelBuilder.text().withProps({
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
		this.workerContainer = this.modelView.modelBuilder.divContainer().component();
		this.workerContainer.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.workerNodes,
			CSSStyles: { ...cssStyles.title, 'margin-top': '25px' }
		}).component());
		this.workerContainer.addItems(this.createUserInputWorkerSection(), { CSSStyles: { 'min-height': '30px' } });
		content.addItem(this.workerContainer, { CSSStyles: { 'min-height': '30px' } });

		// Coordinator node section
		this.coordinatorContainer = this.modelView.modelBuilder.divContainer().component();
		this.coordinatorContainer.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.coordinatorNode,
			CSSStyles: { ...cssStyles.title, 'margin-top': '25px' }
		}).component());
		this.coordinatorContainer.addItems(this.createUserInputCoordinatorSection(), { CSSStyles: { 'min-height': '30px' } });

		// TODO unhide once once ready to make azdata calls
		content.addItem(this.coordinatorContainer, { CSSStyles: { 'min-height': '30px' } });

		this.initialized = true;

		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		// Save Edits
		this.saveButton = this.modelView.modelBuilder.button().withProps({
			label: loc.saveText,
			iconPath: IconPathHelper.save,
			enabled: false
		}).component();

		this.disposables.push(
			this.saveButton.onDidClick(async () => {
				this.saveButton.enabled = false;
				try {
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: loc.updatingInstance(this._postgresModel.info.name),
							cancellable: false
						},
						async (_progress, _token): Promise<void> => {
							try {
								let cr = this.schedulingParamsToEdit(this.saveArgs.coresRequest.w, this.saveArgs.coresRequest.c);
								let cl = this.schedulingParamsToEdit(this.saveArgs.coresLimit.w, this.saveArgs.coresLimit.c);
								let mr = this.schedulingParamsToEdit(this.saveArgs.memoryRequest.w, this.saveArgs.memoryRequest.c);
								let ml = this.schedulingParamsToEdit(this.saveArgs.memoryLimit.w, this.saveArgs.memoryLimit.c);

								await this._azdataApi.azdata.arc.postgres.server.edit(
									this._postgresModel.info.name,
									{
										workers: this.saveArgs.workers,
										coresRequest: cr,
										coresLimit: cl,
										memoryRequest: mr,
										memoryLimit: ml
									},
									this._postgresModel.controllerModel.azdataAdditionalEnvVars);
							} catch (err) {
								// If an error occurs while editing the instance then re-enable the save button since
								// the edit wasn't successfully applied
								this.saveButton.enabled = true;
								throw err;
							}
							try {
								await this._postgresModel.refresh();
							} catch (error) {
								vscode.window.showErrorMessage(loc.refreshFailed(error));
							}
						}
					);

					vscode.window.showInformationMessage(loc.instanceUpdated(this._postgresModel.info.name));

					this.discardButton.enabled = false;

				} catch (error) {
					vscode.window.showErrorMessage(loc.instanceUpdateFailed(this._postgresModel.info.name, error));
				}
			}));

		// Discard
		this.discardButton = this.modelView.modelBuilder.button().withProps({
			label: loc.discardText,
			iconPath: IconPathHelper.discard,
			enabled: false
		}).component();

		this.disposables.push(
			this.discardButton.onDidClick(async () => {
				this.discardButton.enabled = false;
				try {
					this.workerBox.value = this.currentConfiguration.workers!.toString();
					this.workerCoresRequestBox.value = this.currentConfiguration.coresRequest.w;
					this.workerCoresLimitBox.value = this.currentConfiguration.coresLimit.w;
					this.workerMemoryRequestBox.value = this.currentConfiguration.memoryRequest.w;
					this.workerMemoryLimitBox.value = this.currentConfiguration.memoryLimit.w;
				} catch (error) {
					vscode.window.showErrorMessage(loc.pageDiscardFailed(error));
				} finally {
					this.saveButton.enabled = false;
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: this.saveButton },
			{ component: this.discardButton }
		]).component();
	}

	private schedulingParamsToEdit(worker: string | undefined, coordinator: string | undefined): string | undefined {
		if (worker && coordinator) {
			return `${worker},${coordinator}`;
		} else {
			return worker ?? coordinator ?? undefined;
		}
	}

	private initializeConfigurationBoxes(): void {
		// Worker node count
		this.workerBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			inputType: 'number',
			placeHolder: loc.loading,
			required: true
		}).component();

		this.disposables.push(
			this.workerBox.onTextChanged(() => {
				if (!this.saveValueToEdit(this.workerBox, this.currentConfiguration.workers!.toString())) {
					this.saveArgs.workers = undefined;
				} else {
					this.saveArgs.workers = parseInt(this.workerBox.value!);
				}
			})
		);

		// Worker nodes cores request
		this.workerCoresRequestBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			min: 1,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.workerCoresRequestBox.onTextChanged(() => {
				if (!(this.saveValueToEdit(this.workerCoresRequestBox, this.currentConfiguration.coresRequest.w!))) {
					this.saveArgs.coresRequest.w = undefined;
				} else if (this.workerCoresRequestBox.value === '') {
					this.saveArgs.coresRequest.w = 'w=""';
				} else {
					this.saveArgs.coresRequest.w = `w=${this.workerCoresRequestBox.value}`;
				}
			})
		);

		// Worker nodes cores limit
		this.workerCoresLimitBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			min: 1,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.workerCoresLimitBox.onTextChanged(() => {
				if (!(this.saveValueToEdit(this.workerCoresLimitBox, this.currentConfiguration.coresLimit.w!))) {
					this.saveArgs.coresLimit.w = undefined;
				} else if (this.workerCoresLimitBox.value === '') {
					this.saveArgs.coresLimit.w = 'w=""';
				} else {
					this.saveArgs.coresLimit.w = `w=${this.workerCoresLimitBox.value}`;
				}
			})
		);

		// Worker nodes memory request
		this.workerMemoryRequestBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			min: 0.25,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.workerMemoryRequestBox.onTextChanged(() => {
				if (!(this.saveValueToEdit(this.workerMemoryRequestBox, this.currentConfiguration.memoryRequest.w!))) {
					this.saveArgs.memoryRequest.w = undefined;
				} else if (this.workerMemoryRequestBox.value === '') {
					this.saveArgs.memoryRequest.w = 'w=""';
				} else {
					this.saveArgs.memoryRequest.w = `w=${this.workerMemoryRequestBox.value}Gi`;
				}
			})
		);

		// Worker nodes memory limit
		this.workerMemoryLimitBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			min: 0.25,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.workerMemoryLimitBox.onTextChanged(() => {
				if (!(this.saveValueToEdit(this.workerMemoryLimitBox, this.currentConfiguration.memoryLimit.w!))) {
					this.saveArgs.memoryLimit.w = undefined;
				} else if (this.workerMemoryLimitBox.value === '') {
					this.saveArgs.memoryLimit.w = 'w=""';
				} else {
					this.saveArgs.memoryLimit.w = `w=${this.workerMemoryLimitBox.value}Gi`;
				}
			})
		);

		// Coordinator node cores request
		this.coordinatorCoresRequestBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			min: 1,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.coordinatorCoresRequestBox.onTextChanged(() => {
				if (!(this.saveValueToEdit(this.coordinatorCoresRequestBox, this.currentConfiguration.coresRequest.c!))) {
					this.saveArgs.coresRequest.c = undefined;
				} else if (this.coordinatorCoresRequestBox.value === '') {
					this.saveArgs.coresRequest.c = 'c=""';
				} else {
					this.saveArgs.coresRequest.c = `c=${this.coordinatorCoresRequestBox.value}`;
				}
			})
		);

		// Coordinator node cores limit
		this.coordinatorCoresLimitBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			min: 1,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.coordinatorCoresLimitBox.onTextChanged(() => {
				if (!(this.saveValueToEdit(this.coordinatorCoresLimitBox, this.currentConfiguration.coresLimit.c!))) {
					this.saveArgs.coresLimit.c = undefined;
				} else if (this.coordinatorCoresLimitBox.value === '') {
					this.saveArgs.coresLimit.c = 'c=""';
				} else {
					this.saveArgs.coresLimit.c = `c=${this.coordinatorCoresLimitBox.value}`;
				}
			})
		);

		// Coordinator node memory request
		this.coordinatorMemoryRequestBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			min: 0.25,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.coordinatorMemoryRequestBox.onTextChanged(() => {
				if (!(this.saveValueToEdit(this.coordinatorMemoryRequestBox, this.currentConfiguration.memoryRequest.c!))) {
					this.saveArgs.memoryRequest.c = undefined;
				} else if (this.coordinatorMemoryRequestBox.value === '') {
					this.saveArgs.memoryRequest.c = 'c=""';
				} else {
					this.saveArgs.memoryRequest.c = `c=${this.coordinatorMemoryRequestBox.value}Gi`;
				}
			})
		);

		// Coordinator node memory limit
		this.coordinatorMemoryLimitBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			min: 0.25,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.coordinatorMemoryLimitBox.onTextChanged(() => {
				if (!(this.saveValueToEdit(this.coordinatorMemoryLimitBox, this.currentConfiguration.memoryLimit.c!))) {
					this.saveArgs.memoryLimit.c = undefined;
				} else if (this.coordinatorMemoryLimitBox.value === '') {
					this.saveArgs.memoryLimit.c = 'c=""';
				} else {
					this.saveArgs.memoryLimit.c = `c=${this.coordinatorMemoryLimitBox.value}Gi`;
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
			this.createConfigurationSectionContainer(loc.coresRequest, this.workerCoresRequestBox),
			this.createConfigurationSectionContainer(loc.coresLimit, this.workerCoresLimitBox),
			this.createConfigurationSectionContainer(loc.memoryRequest, this.workerMemoryRequestBox),
			this.createConfigurationSectionContainer(loc.memoryLimit, this.workerMemoryLimitBox)

		];
	}

	private createWorkerNodesSectionContainer(): azdata.FlexContainer {
		const inputFlex = { flex: '0 1 150px' };
		const keyFlex = { flex: `0 1 250px` };

		const flexContainer = this.modelView.modelBuilder.flexContainer().withLayout({
			flexWrap: 'wrap',
			alignItems: 'center'
		}).component();

		const keyComponent = this.modelView.modelBuilder.text().withProps({
			value: loc.workerNodeCount,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const keyContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		keyContainer.addItem(keyComponent, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '15px' } });

		const information = this.modelView.modelBuilder.button().withProps({
			iconPath: IconPathHelper.information,
			title: loc.workerNodesInformation,
			width: '15px',
			height: '15px',
			enabled: false
		}).component();

		keyContainer.addItem(information, { CSSStyles: { 'margin-left': '5px', 'margin-bottom': '15px' } });
		flexContainer.addItem(keyContainer, keyFlex);

		const inputContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		inputContainer.addItem(this.workerBox, { CSSStyles: { 'margin-bottom': '15px', 'min-width': '50px', 'max-width': '225px' } });

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
			this.createConfigurationSectionContainer(loc.coresRequest, this.coordinatorCoresRequestBox),
			this.createConfigurationSectionContainer(loc.coresLimit, this.coordinatorCoresLimitBox),
			this.createConfigurationSectionContainer(loc.memoryRequest, this.coordinatorMemoryRequestBox),
			this.createConfigurationSectionContainer(loc.memoryLimit, this.coordinatorMemoryLimitBox)

		];
	}

	private createConfigurationSectionContainer(key: string, input: azdata.Component): azdata.FlexContainer {
		const inputFlex = { flex: '0 1 150px' };
		const keyFlex = { flex: `0 1 250px` };

		const flexContainer = this.modelView.modelBuilder.flexContainer().withLayout({
			flexWrap: 'wrap',
			alignItems: 'center'
		}).component();

		const keyComponent = this.modelView.modelBuilder.text().withProps({
			value: key,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const keyContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		keyContainer.addItem(keyComponent, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '15px' } });
		flexContainer.addItem(keyContainer, keyFlex);

		const inputContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		inputContainer.addItem(input, { CSSStyles: { 'margin-bottom': '15px', 'min-width': '50px', 'max-width': '225px' } });

		flexContainer.addItem(inputContainer, inputFlex);

		return flexContainer;
	}

	/**
	 * A function that determines if an input box's value should be considered or not.
	 * Triggers the save and discard buttons to become enabled depending on the value change.
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
	private saveValueToEdit(component: azdata.InputBoxComponent, originalValue: string): boolean {
		if (component.value === originalValue) {
			return false;
		} else if ((!component.valid)) {
			return false;
		} else {
			this.saveButton.enabled = true;
			this.discardButton.enabled = true;
			return true;
		}
	}

	private editWorkerNodeCount(): void {
		// scale.shards was renamed to scale.workers. Check both for backwards compatibility.
		let scale = this._postgresModel.config?.spec.scale;
		this.currentConfiguration.workers = scale?.workers ?? scale?.shards ?? 0;

		this.workerBox.min = this.currentConfiguration.workers;
		this.workerBox.placeHolder = '';
		this.workerBox.value = this.currentConfiguration.workers.toString();
		this.saveArgs.workers = undefined;
	}

	private createCoresMemorySection(title: string, description: string): azdata.DivContainer {
		const titleFlex = { flex: `0 1 250px` };

		const flexContainer = this.modelView.modelBuilder.flexContainer().withLayout({
			flexWrap: 'wrap',
			alignItems: 'center'
		}).component();

		const titleComponent = this.modelView.modelBuilder.text().withProps({
			value: title,
			CSSStyles: { ...cssStyles.title, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const titleContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		titleContainer.addItem(titleComponent, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '15px' } });

		const information = this.modelView.modelBuilder.button().withProps({
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
		this.currentConfiguration.coresRequest.w = this._postgresModel.config?.spec.scheduling?.roles?.workers?.resources?.requests?.cpu ?? this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.cpu;
		if (!this.currentConfiguration.coresRequest.w) {
			this.currentConfiguration.coresRequest.w = '';
		}

		this.workerCoresRequestBox.placeHolder = '';
		this.workerCoresRequestBox.value = this.currentConfiguration.coresRequest.w;
		this.saveArgs.coresRequest.w = undefined;

		// Cores Limit
		this.currentConfiguration.coresLimit.w = this._postgresModel.config?.spec.scheduling?.roles?.workers?.resources?.limits?.cpu ?? this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.cpu;
		if (!this.currentConfiguration.coresLimit.w) {
			this.currentConfiguration.coresLimit.w = '';
		}

		this.workerCoresLimitBox.placeHolder = '';
		this.workerCoresLimitBox.value = this.currentConfiguration.coresLimit.w;
		this.saveArgs.coresLimit.w = undefined;
	}

	private editWorkerMemory(): void {
		//Memory Request
		let currentMemorySize = this._postgresModel.config?.spec.scheduling?.roles?.workers?.resources?.requests?.memory ?? this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.memory;
		if (!currentMemorySize) {
			this.currentConfiguration.memoryRequest.w = '';
		} else {
			this.currentConfiguration.memoryRequest.w = convertToGibibyteString(currentMemorySize);
		}

		this.workerMemoryRequestBox.placeHolder = '';
		this.workerMemoryRequestBox.value = this.currentConfiguration.memoryRequest.w;
		this.saveArgs.memoryRequest.w = undefined;

		//Memory Limit
		currentMemorySize = this._postgresModel.config?.spec.scheduling?.roles?.workers?.resources?.limits?.memory ?? this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.memory;
		if (!currentMemorySize) {
			this.currentConfiguration.memoryLimit.w = '';
		} else {
			this.currentConfiguration.memoryLimit.w = convertToGibibyteString(currentMemorySize);
		}

		this.workerMemoryLimitBox.placeHolder = '';
		this.workerMemoryLimitBox.value = this.currentConfiguration.memoryLimit.w;
		this.saveArgs.memoryLimit.w = undefined;
	}

	private editCoordinatorCores(): void {
		// TODO get current cpu size for coordinator
		this.currentConfiguration.coresRequest.c = this._postgresModel.config?.spec.scheduling?.roles?.coordinator?.resources?.requests?.cpu ?? this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.cpu;
		if (!this.currentConfiguration.coresRequest.c) {
			this.currentConfiguration.coresRequest.c = '';
		}

		this.coordinatorCoresRequestBox.placeHolder = '';
		this.coordinatorCoresRequestBox.value = this.currentConfiguration.coresRequest.c;
		this.saveArgs.coresRequest.c = undefined;

		// TODO get current cpu size for coordinator
		this.currentConfiguration.coresLimit.c = this._postgresModel.config?.spec.scheduling?.roles?.coordinator?.resources?.limits?.cpu ?? this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.cpu;
		if (!this.currentConfiguration.coresLimit.c) {
			this.currentConfiguration.coresLimit.c = '';
		}

		this.coordinatorCoresLimitBox.placeHolder = '';
		this.coordinatorCoresLimitBox.value = this.currentConfiguration.coresLimit.c;
		this.saveArgs.coresLimit.c = undefined;
	}

	private editCoordinatorMemory(): void {
		// TODO get current memory size for coordinator
		let currentMemorySize = this._postgresModel.config?.spec.scheduling?.roles?.coordinator?.resources?.requests?.memory ?? this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.memory;
		if (!currentMemorySize) {
			this.currentConfiguration.coresRequest.c = '';
		} else {
			this.currentConfiguration.coresRequest.c = convertToGibibyteString(currentMemorySize);
		}

		this.coordinatorMemoryRequestBox.placeHolder = '';
		this.coordinatorMemoryRequestBox.value = this.currentConfiguration.memoryRequest.c;
		this.saveArgs.memoryRequest.c = undefined;

		// TODO get current memory size for coordinator
		currentMemorySize = this._postgresModel.config?.spec.scheduling?.roles?.coordinator?.resources?.limits?.memory ?? this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.memory;
		if (!currentMemorySize) {
			this.currentConfiguration.coresLimit.c = '';
		} else {
			this.currentConfiguration.coresLimit.c = convertToGibibyteString(currentMemorySize);
		}

		this.coordinatorMemoryLimitBox.placeHolder = '';
		this.coordinatorMemoryLimitBox.value = this.currentConfiguration.memoryLimit.c;
		this.saveArgs.memoryLimit.c = undefined;
	}

	private handleServiceUpdated(): void {
		this.editWorkerNodeCount();
		this.editWorkerCores();
		this.editWorkerMemory();
		this.editCoordinatorCores();
		this.editCoordinatorMemory();
	}
}
