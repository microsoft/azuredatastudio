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

	private discardButton!: azdata.ButtonComponent;
	private saveButton!: azdata.ButtonComponent;

	private saveWorkerArgs: {
		workers?: number,
		coresLimit?: string,
		coresRequest?: string,
		memoryLimit?: string,
		memoryRequest?: string
	} = {};

	private saveCoordinatorArgs: {
		coresLimit?: string,
		coresRequest?: string,
		memoryLimit?: string,
		memoryRequest?: string
	} = {};

	private readonly _azdataApi: azdataExt.IExtension;

	constructor(protected modelView: azdata.ModelView, private _postgresModel: PostgresModel) {
		super(modelView);
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
		this.workerContainer = this.modelView.modelBuilder.divContainer().component();
		this.workerContainer.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.workerNodes,
			CSSStyles: { ...cssStyles.title, 'margin-top': '25px' }
		}).component());
		this.workerContainer.addItems(this.createUserInputWorkerSection(), { CSSStyles: { 'min-height': '30px' } });
		content.addItem(this.workerContainer, { CSSStyles: { 'min-height': '30px' } });

		// Coordinator node section
		this.coordinatorContainer = this.modelView.modelBuilder.divContainer().component();
		this.coordinatorContainer.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.coordinatorNode,
			CSSStyles: { ...cssStyles.title, 'margin-top': '25px' }
		}).component());
		this.coordinatorContainer.addItems(this.createUserInputCoordinatorSection(), { CSSStyles: { 'min-height': '30px' } });

		// TODO unhide once once ready to make azdata calls
		// content.addItem(this.coordinatorContainer, { CSSStyles: { 'min-height': '30px' } });

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
									this.saveWorkerArgs,
									this._postgresModel.engineVersion,
									this._postgresModel.controllerModel.azdataAdditionalEnvVars,
									session
								);
								/* TODO add second edit call for coordinator configuration
									await this._azdataApi.azdata.arc.postgres.server.edit(
										this._postgresModel.info.name,
										this.saveCoordinatorArgs,
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
							await this._postgresModel.refresh();
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
					this.handleServiceUpdated();
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
		this.workerBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false,
			validationErrorMessage: loc.workerValidationErrorMessage,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.workerBox.onTextChanged(() => {
				if (!(this.handleOnTextChanged(this.workerBox!))) {
					this.saveWorkerArgs.workers = undefined;
				} else {
					this.saveWorkerArgs.workers = parseInt(this.workerBox!.value!);
				}
			})
		);

		this.workerCoresLimitBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false,
			min: 1,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.workerCoresLimitBox.onTextChanged(() => {
				if (!(this.handleOnTextChanged(this.workerCoresLimitBox!))) {
					this.saveWorkerArgs.coresLimit = undefined;
				} else {
					this.saveWorkerArgs.coresLimit = this.workerCoresLimitBox!.value;
				}
			})
		);

		this.coordinatorCoresLimitBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false,
			min: 1,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.coordinatorCoresLimitBox.onTextChanged(() => {
				if (!(this.handleOnTextChanged(this.coordinatorCoresLimitBox!))) {
					this.saveCoordinatorArgs.coresLimit = undefined;
				} else {
					this.saveCoordinatorArgs.coresLimit = this.coordinatorCoresLimitBox!.value;
				}
			})
		);

		this.workerCoresRequestBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false,
			min: 1,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.workerCoresRequestBox.onTextChanged(() => {
				if (!(this.handleOnTextChanged(this.workerCoresRequestBox!))) {
					this.saveWorkerArgs.coresRequest = undefined;
				} else {
					this.saveWorkerArgs.coresRequest = this.workerCoresRequestBox!.value;
				}
			})
		);

		this.coordinatorCoresRequestBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false,
			min: 1,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.coordinatorCoresRequestBox.onTextChanged(() => {
				if (!(this.handleOnTextChanged(this.coordinatorCoresRequestBox!))) {
					this.saveCoordinatorArgs.coresRequest = undefined;
				} else {
					this.saveCoordinatorArgs.coresRequest = this.coordinatorCoresRequestBox!.value;
				}
			})
		);

		this.workerMemoryLimitBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false,
			min: 0.25,
			validationErrorMessage: loc.memoryLimitValidationErrorMessage,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.workerMemoryLimitBox.onTextChanged(() => {
				if (!(this.handleOnTextChanged(this.workerMemoryLimitBox!))) {
					this.saveWorkerArgs.memoryLimit = undefined;
				} else {
					this.saveWorkerArgs.memoryLimit = this.workerMemoryLimitBox!.value + 'Gi';
				}
			})
		);

		this.coordinatorMemoryLimitBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false,
			min: 0.25,
			validationErrorMessage: loc.memoryLimitValidationErrorMessage,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.coordinatorMemoryLimitBox.onTextChanged(() => {
				if (!(this.handleOnTextChanged(this.coordinatorMemoryLimitBox!))) {
					this.saveCoordinatorArgs.memoryLimit = undefined;
				} else {
					this.saveCoordinatorArgs.memoryLimit = this.coordinatorMemoryLimitBox!.value + 'Gi';
				}
			})
		);

		this.workerMemoryRequestBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false,
			min: 0.25,
			validationErrorMessage: loc.memoryRequestValidationErrorMessage,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.workerMemoryRequestBox.onTextChanged(() => {
				if (!(this.handleOnTextChanged(this.workerMemoryRequestBox!))) {
					this.saveWorkerArgs.memoryRequest = undefined;
				} else {
					this.saveWorkerArgs.memoryRequest = this.workerMemoryRequestBox!.value + 'Gi';
				}
			})
		);

		this.coordinatorMemoryRequestBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false,
			min: 0.25,
			validationErrorMessage: loc.memoryRequestValidationErrorMessage,
			inputType: 'number',
			placeHolder: loc.loading
		}).component();

		this.disposables.push(
			this.coordinatorMemoryRequestBox.onTextChanged(() => {
				if (!(this.handleOnTextChanged(this.coordinatorMemoryRequestBox!))) {
					this.saveCoordinatorArgs.memoryRequest = undefined;
				} else {
					this.saveCoordinatorArgs.memoryRequest = this.coordinatorMemoryRequestBox!.value + 'Gi';
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
			this.createConfigurationSectionContainer(loc.coresRequest, this.workerCoresRequestBox!),
			this.createConfigurationSectionContainer(loc.coresLimit, this.workerCoresLimitBox!),
			this.createConfigurationSectionContainer(loc.memoryRequest, this.workerMemoryRequestBox!),
			this.createConfigurationSectionContainer(loc.memoryLimit, this.workerMemoryLimitBox!)

		];
	}

	private createWorkerNodesSectionContainer(): azdata.FlexContainer {
		const inputFlex = { flex: '0 1 150px' };
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
		inputContainer.addItem(this.workerBox!, { CSSStyles: { 'margin-bottom': '15px', 'min-width': '50px', 'max-width': '225px' } });

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
			this.createConfigurationSectionContainer(loc.coresRequest, this.coordinatorCoresRequestBox!),
			this.createConfigurationSectionContainer(loc.coresLimit, this.coordinatorCoresLimitBox!),
			this.createConfigurationSectionContainer(loc.memoryRequest, this.coordinatorMemoryRequestBox!),
			this.createConfigurationSectionContainer(loc.memoryLimit, this.coordinatorMemoryLimitBox!)

		];
	}

	private createConfigurationSectionContainer(key: string, input: azdata.Component): azdata.FlexContainer {
		const inputFlex = { flex: '0 1 150px' };
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
		inputContainer.addItem(input, { CSSStyles: { 'margin-bottom': '15px', 'min-width': '50px', 'max-width': '225px' } });

		flexContainer.addItem(inputContainer, inputFlex);

		return flexContainer;
	}

	private handleOnTextChanged(component: azdata.InputBoxComponent): boolean {
		if ((!component.value)) {
			// if there is no text found in the inputbox component return false
			return false;
		} else if ((!component.valid)) {
			// if value given by user is not valid enable discard button for user
			// to clear all inputs and return false
			this.discardButton!.enabled = true;
			return false;
		} else {
			// if a valid value has been entered into the input box, enable save and discard buttons
			// so that user could choose to either edit instance or clear all inputs
			// return true
			this.saveButton!.enabled = true;
			this.discardButton!.enabled = true;
			return true;
		}
	}

	private editWorkerNodeCount(): void {
		// scale.shards was renamed to scale.workers. Check both for backwards compatibility.
		let scale = this._postgresModel.config?.spec.scale;
		let currentWorkers = scale?.workers ?? scale?.shards ?? 0;

		this.workerBox!.min = currentWorkers;
		this.workerBox!.placeHolder = currentWorkers.toString();
		this.workerBox!.value = '';

		this.saveWorkerArgs.workers = undefined;
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
		let currentCPUSize = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.cpu;

		if (!currentCPUSize) {
			currentCPUSize = '';
		}

		this.workerCoresRequestBox!.validationErrorMessage = loc.validationMin(this.workerCoresRequestBox!.min!);
		this.workerCoresRequestBox!.placeHolder = currentCPUSize;
		this.workerCoresRequestBox!.value = '';
		this.saveWorkerArgs.coresRequest = undefined;

		currentCPUSize = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.cpu;

		if (!currentCPUSize) {
			currentCPUSize = '';
		}

		this.workerCoresLimitBox!.validationErrorMessage = loc.validationMin(this.workerCoresLimitBox!.min!);
		this.workerCoresLimitBox!.placeHolder = currentCPUSize;
		this.workerCoresLimitBox!.value = '';
		this.saveWorkerArgs.coresLimit = undefined;
	}

	private editCoordinatorCores(): void {
		// TODO get current cpu size for coordinator
		let currentCPUSize = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.cpu;

		if (!currentCPUSize) {
			currentCPUSize = '';
		}

		this.coordinatorCoresRequestBox!.validationErrorMessage = loc.validationMin(this.coordinatorCoresRequestBox!.min!);
		this.coordinatorCoresRequestBox!.placeHolder = currentCPUSize;
		this.coordinatorCoresRequestBox!.value = '';
		this.saveCoordinatorArgs.coresRequest = undefined;

		// TODO get current cpu size for coordinator
		currentCPUSize = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.cpu;

		if (!currentCPUSize) {
			currentCPUSize = '';
		}

		this.coordinatorCoresLimitBox!.validationErrorMessage = loc.validationMin(this.coordinatorCoresLimitBox!.min!);
		this.coordinatorCoresLimitBox!.placeHolder = currentCPUSize;
		this.coordinatorCoresLimitBox!.value = '';
		this.saveCoordinatorArgs.coresLimit = undefined;
	}

	private editWorkerMemory(): void {
		let currentMemSizeConversion: string;
		let currentMemorySize = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.memory;

		if (!currentMemorySize) {
			currentMemSizeConversion = '';
		} else {
			currentMemSizeConversion = convertToGibibyteString(currentMemorySize);
		}

		this.workerMemoryRequestBox!.placeHolder = currentMemSizeConversion!;
		this.workerMemoryRequestBox!.value = '';

		this.saveWorkerArgs.memoryRequest = undefined;

		currentMemorySize = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.memory;

		if (!currentMemorySize) {
			currentMemSizeConversion = '';
		} else {
			currentMemSizeConversion = convertToGibibyteString(currentMemorySize);
		}

		this.workerMemoryLimitBox!.placeHolder = currentMemSizeConversion!;
		this.workerMemoryLimitBox!.value = '';

		this.saveWorkerArgs.memoryLimit = undefined;
	}

	private editCoordinatorMemory(): void {
		let currentMemSizeConversion: string;
		// TODO get current memory size for coordinator
		let currentMemorySize = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.memory;

		if (!currentMemorySize) {
			currentMemSizeConversion = '';
		} else {
			currentMemSizeConversion = convertToGibibyteString(currentMemorySize);
		}

		this.coordinatorMemoryRequestBox!.placeHolder = currentMemSizeConversion!;
		this.coordinatorMemoryRequestBox!.value = '';

		this.saveCoordinatorArgs.memoryRequest = undefined;

		// TODO get current memory size for coordinator
		currentMemorySize = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.memory;

		if (!currentMemorySize) {
			currentMemSizeConversion = '';
		} else {
			currentMemSizeConversion = convertToGibibyteString(currentMemorySize);
		}

		this.coordinatorMemoryLimitBox!.placeHolder = currentMemSizeConversion!;
		this.coordinatorMemoryLimitBox!.value = '';

		this.saveCoordinatorArgs.memoryLimit = undefined;
	}

	private handleServiceUpdated(): void {
		this.editWorkerNodeCount();
		this.editWorkerCores();
		this.editWorkerMemory();
		/* TODO perform once Coordinator section is in view
		this.editCoordinatorCores();
		this.editCoordinatorMemory(); */
	}
}
