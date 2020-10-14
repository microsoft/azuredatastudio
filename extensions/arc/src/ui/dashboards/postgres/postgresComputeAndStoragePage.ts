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

export class PostgresComputeAndStoragePage extends DashboardPage {
	private workerContainer?: azdata.DivContainer;
	//private coordinatorContainer?: azdata.DivContainer;

	private workerBox?: azdata.InputBoxComponent;
	private vCoresMaxBox?: azdata.InputBoxComponent;
	private vCoresMinBox?: azdata.InputBoxComponent;
	private memoryMaxBox?: azdata.InputBoxComponent;
	private memoryMinBox?: azdata.InputBoxComponent;

	private discardButton?: azdata.ButtonComponent;
	private saveButton?: azdata.ButtonComponent;

	private saveArgs?: {
		workers?: number,
		coresLimit?: string,
		coresRequest?: string,
		memoryLimit?: string,
		memoryRequest?: string
	};

	private readonly _azdataApi: azdataExt.IExtension;

	constructor(protected modelView: azdata.ModelView, private _postgresModel: PostgresModel) {
		super(modelView);
		this._azdataApi = vscode.extensions.getExtension(azdataExt.extension.name)?.exports;

		this.saveArgs = {};

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
			value: loc.computeAndStorageDescriptionPartOne,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px', 'max-width': 'auto' }
		}).component();
		const infoComputeStorage_p2 = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.computeAndStorageDescriptionPartTwo,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const workerNodeslink = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: loc.addingWokerNodes,
			url: 'https://docs.microsoft.com/en-us/azure/azure-arc/data/scale-up-down-postgresql-hyperscale-server-group-using-cli',
			CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const infoComputeStorage_p3 = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.computeAndStorageDescriptionPartThree,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const memoryVCoreslink = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: loc.scalingCompute,
			url: 'https://docs.microsoft.com/en-us/azure/azure-arc/data/scale-up-down-postgresql-hyperscale-server-group-using-cli',
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

		const computeInfoAndLinks = this.modelView.modelBuilder.flexContainer().withLayout({ flexWrap: 'wrap' }).component();
		computeInfoAndLinks.addItem(infoComputeStorage_p1, { CSSStyles: { 'margin-right': '5px' } });
		computeInfoAndLinks.addItem(infoComputeStorage_p2, { CSSStyles: { 'margin-right': '5px' } });
		computeInfoAndLinks.addItem(workerNodeslink, { CSSStyles: { 'margin-right': '5px' } });
		computeInfoAndLinks.addItem(infoComputeStorage_p3, { CSSStyles: { 'margin-right': '5px' } });
		computeInfoAndLinks.addItem(memoryVCoreslink, { CSSStyles: { 'margin-right': '5px' } });
		computeInfoAndLinks.addItem(infoComputeStorage_p4, { CSSStyles: { 'margin-right': '5px' } });
		computeInfoAndLinks.addItem(infoComputeStorage_p5, { CSSStyles: { 'margin-right': '5px' } });
		computeInfoAndLinks.addItem(infoComputeStorage_p6, { CSSStyles: { 'margin-right': '5px' } });
		content.addItem(computeInfoAndLinks, { CSSStyles: { 'min-height': '30px' } });

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.workerNodes,
			CSSStyles: { ...cssStyles.title, 'margin-top': '25px' }
		}).component());

		this.workerContainer = this.modelView.modelBuilder.divContainer().component();
		this.workerContainer.addItems(this.updateUserInputSection(), { CSSStyles: { 'min-height': '30px' } });
		content.addItem(this.workerContainer, { CSSStyles: { 'min-height': '30px' } });

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
						(_progress, _token) => {
							return this._azdataApi.azdata.arc.postgres.server.edit(
								this._postgresModel.info.name, this.saveArgs!);
						}
					);

					await Promise.
						all([
							this._postgresModel.refresh()
						]);

					vscode.window.showInformationMessage(loc.instanceUpdated(this._postgresModel.info.name));

				} catch (error) {
					vscode.window.showErrorMessage(loc.instanceUpdateFailed(this._postgresModel.info.name, error));
				} finally {
					this.discardButton!.enabled = false;
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
					this.saveArgs!.workers = undefined;
					this.saveArgs!.coresLimit = undefined;
					this.saveArgs!.coresRequest = undefined;
					this.saveArgs!.memoryLimit = undefined;
					this.saveArgs!.memoryRequest = undefined;
					this.workerContainer!.clearItems();
					this.workerContainer!.addItems(this.updateUserInputSection(), { CSSStyles: { 'min-height': '30px' } });

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

	private initializeConfigurationBoxes() {
		this.workerBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false,
			validationErrorMessage: loc.workerValidationErrorMessage,
			inputType: 'number'
		}).component();

		this.vCoresMaxBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false,
			min: 1,
			validationErrorMessage: loc.vCoresValidationErrorMessage,
			inputType: 'number'
		}).component();

		this.vCoresMinBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false,
			min: 1,
			validationErrorMessage: 'Valid Cpu resource quantities are strictly positive and limit is greater than 0.',
			inputType: 'number'
		}).component();

		this.memoryMaxBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false,
			min: 0.25,
			validationErrorMessage: loc.memoryMaxValidationErrorMessage,
			inputType: 'number'
		}).component();

		this.memoryMinBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false,
			min: 0.25,
			validationErrorMessage: loc.memoryMinValidationErrorMessage,
			inputType: 'number'
		}).component();

	}

	private updateUserInputSection(): azdata.Component[] {
		if (!this._postgresModel.configLastUpdated) {
			return [this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
				value: loc.loading,
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
			}).component()];
		} else {

			this.initializeConfigurationBoxes();
			this.editWorkerNodeCount();
			this.editVCores(loc.vCoresMin);
			this.editVCores(loc.vCoresMax);
			this.editMemory(loc.memoryMin);
			this.editMemory(loc.memoryMax);

			return [
				this.workerNodesSectionContainer(),
				this.vCoreMemorySection(),
				this.configurationSectionContainer(loc.vCoresMin, this.vCoresMinBox!, '40px'),
				this.configurationSectionContainer(loc.vCoresMax, this.vCoresMaxBox!, '40px'),
				this.configurationSectionContainer(loc.memoryMin, this.memoryMinBox!, '40px'),
				this.configurationSectionContainer(loc.memoryMax, this.memoryMaxBox!, '20px')

			];

		}


	}

	private workerNodesSectionContainer(): azdata.FlexContainer {
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
			width: '12px',
			height: '12px',
			enabled: false
		}).component();

		keyContainer.addItem(information, { CSSStyles: { 'margin-left': '5px', 'margin-bottom': '15px' } });
		flexContainer.addItem(keyContainer, keyFlex);

		const inputContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		inputContainer.addItem(this.workerBox!, { CSSStyles: { 'margin-bottom': '15px', 'min-width': '50px', 'max-width': '225px' } });

		flexContainer!.addItem(inputContainer, inputFlex);

		return flexContainer;
	}

	private configurationSectionContainer(key: string, input: azdata.Component, nestingLineHeight: string): azdata.FlexContainer {
		const inputFlex = { flex: '0 1 150px' };
		const keyFlex = { flex: `0 1 200px` };
		const bottomLineFlex = { flex: `0 1 45px` };

		const flexContainer = this.modelView.modelBuilder.flexContainer().withLayout({
			flexWrap: 'nowrap',
			alignItems: 'center'
		}).component();

		const leftLine = this.modelView.modelBuilder.divContainer().withProperties({
			CSSStyles: { 'max-height': nestingLineHeight, 'min-height': nestingLineHeight, 'max-width': '1px', 'border-left-style': 'solid', 'border-left-color': '#ccc' }
		}).component();

		flexContainer!.addItem(leftLine, { CSSStyles: { 'align-self': 'flex-start' } });

		const bottomLine = this.modelView.modelBuilder.divContainer().withProperties({
			CSSStyles: { 'margin-right': '5px', 'min-width': '5px', 'border-bottom-style': 'solid', 'border-bottom-color': '#ccc' }
		}).component();

		flexContainer!.addItem(bottomLine, bottomLineFlex);

		const keyComponent = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: key,
			CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'min-width': '100px', 'margin-bottom': '10px', 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		flexContainer!.addItem(keyComponent, keyFlex);

		const inputContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		inputContainer.addItem(input, { CSSStyles: { 'margin-bottom': '10px', 'min-width': '50px', 'max-width': '225px' } });

		flexContainer!.addItem(inputContainer, inputFlex);

		return flexContainer;
	}

	private handleOnTextChanged(component: azdata.InputBoxComponent, currentValue: string): boolean {
		if (component.value === currentValue) {
			return false;
		} else if ((!component.value) || (!component.valid)) {
			this.discardButton!.enabled = true;
			return false;
		} else {
			this.saveButton!.enabled = true;
			this.discardButton!.enabled = true;
			return true;
		}

	}

	private editWorkerNodeCount() {
		let currentShards = this._postgresModel.config?.spec.scale.shards;
		let currentNodeCount = currentShards!.toString();

		this.workerBox!.value = currentNodeCount;
		this.workerBox!.min = currentShards;

		this.disposables.push(
			this.workerBox!.onTextChanged(() => {
				if (!(this.handleOnTextChanged(this.workerBox!, currentNodeCount))) {
					this.saveArgs!.workers = undefined;
				} else {
					this.saveArgs!.workers = parseInt(this.workerBox!.value!);
				}
			})
		);
	}

	private vCoreMemorySection(): azdata.DivContainer {
		const titleFlex = { flex: `0 1 250px` };

		const flexContainer = this.modelView.modelBuilder.flexContainer().withLayout({
			flexWrap: 'wrap',
			alignItems: 'center'
		}).component();

		const titleComponent = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.configurationPerNode,
			CSSStyles: { ...cssStyles.title, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const titleContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		titleContainer.addItem(titleComponent, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '15px' } });

		const information = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			iconPath: IconPathHelper.information,
			title: loc.configurationInformation,
			width: '12px',
			height: '12px',
			enabled: false
		}).component();

		titleContainer.addItem(information, { CSSStyles: { 'margin-left': '5px', 'margin-bottom': '15px' } });
		flexContainer.addItem(titleContainer, titleFlex);

		let configurationSection = this.modelView.modelBuilder.divContainer().component();
		configurationSection.addItem(flexContainer);

		return configurationSection;
	}

	private editVCores(type: string) {
		let currentCPUSize: string | undefined;
		if (type === loc.vCoresMax) {
			currentCPUSize = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.cpu;

			if (!currentCPUSize) {
				currentCPUSize = '0';
			}

			this.vCoresMaxBox!.value = currentCPUSize;

			this.disposables.push(
				this.vCoresMaxBox!.onTextChanged(() => {
					if (!(this.handleOnTextChanged(this.vCoresMaxBox!, currentCPUSize!))) {
						this.saveArgs!.coresRequest = undefined;
					} else {
						this.saveArgs!.coresRequest = this.vCoresMaxBox!.value;
					}
				})
			);
		} else if (type === loc.vCoresMin) {
			currentCPUSize = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.cpu;

			if (!currentCPUSize) {
				currentCPUSize = '0';
			}

			this.vCoresMinBox!.value = currentCPUSize;

			this.disposables.push(
				this.vCoresMinBox!.onTextChanged(() => {
					if (!(this.handleOnTextChanged(this.vCoresMinBox!, currentCPUSize!))) {
						this.saveArgs!.coresLimit = undefined;
					} else {
						this.saveArgs!.coresLimit = this.vCoresMinBox!.value;
					}
				})
			);
		}
	}

	private editMemory(type: string) {
		let currentMemorySize: string | undefined;
		let currentMemSizeConversion: string;

		if (type === loc.memoryMax) {
			currentMemorySize = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.memory;

			if (!currentMemorySize) {
				currentMemorySize = '0';
			} else {
				currentMemSizeConversion = this.gibibyteConversion(currentMemorySize);
			}

			this.memoryMaxBox!.value = currentMemSizeConversion!;

			this.disposables.push(
				this.memoryMaxBox!.onTextChanged(() => {
					if (!(this.handleOnTextChanged(this.memoryMaxBox!, currentMemSizeConversion!))) {
						this.saveArgs!.memoryRequest = undefined;
					} else {
						this.saveArgs!.memoryRequest = this.memoryMaxBox!.value + 'Gi';
					}
				})
			);
		} else if (type === loc.memoryMin) {
			currentMemorySize = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.memory;

			if (!currentMemorySize) {
				currentMemorySize = '0';
			} else {
				currentMemSizeConversion = this.gibibyteConversion(currentMemorySize);
			}

			this.memoryMinBox!.value = currentMemSizeConversion!;

			this.disposables.push(
				this.memoryMinBox!.onTextChanged(() => {
					if (!(this.handleOnTextChanged(this.memoryMinBox!, currentMemSizeConversion!))) {
						this.saveArgs!.memoryLimit = undefined;
					} else {
						this.saveArgs!.memoryLimit = this.memoryMinBox!.value + 'Gi';
					}
				})
			);
		}
	}

	private gibibyteConversion(value: string): string {
		let gtoGIConversion;
		let floatValue = parseFloat(value);

		let splitValue = value.split(String(floatValue));
		let unit = splitValue[1];

		if (unit === 'm') {
			floatValue = (floatValue * Math.pow(10, 3)) / Math.pow(1024, 3);
		} else if (unit === 'K') {
			gtoGIConversion = 1000 / 1024;
			floatValue = (floatValue * gtoGIConversion) / Math.pow(1024, 2);
		} else if (unit === 'M') {
			gtoGIConversion = Math.pow(1000, 2) / Math.pow(1024, 2);
			floatValue = (floatValue * gtoGIConversion) / 1024;
		} else if (unit === 'G') {
			gtoGIConversion = Math.pow(1000, 3) / Math.pow(1024, 3);
			floatValue = floatValue * gtoGIConversion;
		} else if (unit === 'T') {
			gtoGIConversion = Math.pow(1000, 4) / Math.pow(1024, 4);
			floatValue = (floatValue * gtoGIConversion) * 1024;
		} else if (unit === 'P') {
			gtoGIConversion = Math.pow(1000, 5) / Math.pow(1024, 5);
			floatValue = (floatValue * gtoGIConversion) * Math.pow(1024, 2);
		} else if (unit === 'E') {
			gtoGIConversion = Math.pow(1000, 6) / Math.pow(1024, 6);
			floatValue = (floatValue * gtoGIConversion) * Math.pow(1024, 3);
		}

		if (unit === '') {
			floatValue = floatValue / Math.pow(1024, 3);
		} else if (unit === 'Ki') {
			floatValue = floatValue / Math.pow(1024, 2);
		} else if (unit === 'Mi') {
			floatValue = floatValue / 1024;
		} else if (unit === 'Ti') {
			floatValue = floatValue * 1024;
		} else if (unit === 'Pi') {
			floatValue = floatValue * Math.pow(1024, 2);
		} else if (unit === 'Ei') {
			floatValue = floatValue * Math.pow(1024, 3);
		}

		return String(floatValue);
	}

	/* private getCordinatorConfiguration(): azdata.Component[] {
		const endpoint = this._postgresModel.endpoint;
		if (!endpoint) {
			return [];
		}
		else {

			return [
				this.configurationSectionContainer(loc.vCoresMax, this.getVCores(loc.vCoresMax), '40px'),
				this.configurationSectionContainer(loc.vCoresMin, this.getVCores(loc.vCoresMin), '40px'),
				this.configurationSectionContainer(loc.memoryMax, this.getMemory(loc.memoryMax), '40px'),
				this.configurationSectionContainer(loc.memoryMin, this.getMemory(loc.memoryMin), '40px'),
				this.configurationSectionContainer(loc.dataStorage, this.getStorage(loc.dataStorage), '40px'),
				this.configurationSectionContainer(loc.logsStorage, this.getStorage(loc.logsStorage), '40px'),
				this.configurationSectionContainer(loc.backupsStorage, this.getStorage(loc.backupsStorage), '40px')
			];

		}

	}

	private getVCores(type: string): azdata.InputBoxComponent {
		let coresSize: string | undefined;

		if (type === loc.memoryMax) {
			coresSize = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.cpu;
		}
		else if (type === loc.memoryMin) {
			coresSize = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.cpu;
		}


		if (!coresSize) {
			coresSize = '0';
		}

		return this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: coresSize,
			readOnly: true

		}).component();
	}

	private getMemory(type: string): azdata.InputBoxComponent {
		let memorySize: string | undefined;

		if (type === loc.memoryMax) {
			memorySize = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.memory;
		}
		else if (type === loc.memoryMin) {
			memorySize = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.memory;
		}


		if (!memorySize) {
			memorySize = '0';
		}

		return this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: this.gibibyteConversion(memorySize),
			readOnly: true
		}).component();
	}

	private getStorage(type: string): azdata.InputBoxComponent {
		let storageSize: string | undefined;
		if (type === loc.dataStorage) {
			storageSize = this._postgresModel.config?.spec.storage.data.size;
		}
		else if (type === loc.logsStorage) {
			storageSize = this._postgresModel.config?.spec.storage.logs.size;
		}
		else if (type === loc.backupsStorage) {
			storageSize = this._postgresModel.config?.spec.storage.backups.size;
		}

		if (!storageSize) {
			storageSize = '0';
		}

		return this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: this.gibibyteConversion(storageSize),
			readOnly: true
		}).component();
	} */

	private handleServiceUpdated() {
		this.saveArgs!.workers = undefined;
		this.saveArgs!.coresLimit = undefined;
		this.saveArgs!.coresRequest = undefined;
		this.saveArgs!.memoryLimit = undefined;
		this.saveArgs!.memoryRequest = undefined;
		this.workerContainer?.clearItems();
		this.workerContainer?.addItems(this.updateUserInputSection(), { CSSStyles: { 'min-height': '30px' } });
	}
}
