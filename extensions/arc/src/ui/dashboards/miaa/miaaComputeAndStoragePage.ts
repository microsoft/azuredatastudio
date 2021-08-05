/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azExt from 'az-ext';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { convertToGibibyteString } from '../../../common/utils';
import { MiaaModel } from '../../../models/miaaModel';

export class MiaaComputeAndStoragePage extends DashboardPage {

	private configurationContainer?: azdata.DivContainer;
	private coresLimitBox?: azdata.InputBoxComponent;
	private coresRequestBox?: azdata.InputBoxComponent;
	private memoryLimitBox?: azdata.InputBoxComponent;
	private memoryRequestBox?: azdata.InputBoxComponent;

	private discardButton?: azdata.ButtonComponent;
	private saveButton?: azdata.ButtonComponent;

	private saveArgs: {
		coresLimit?: string,
		coresRequest?: string,
		memoryLimit?: string,
		memoryRequest?: string
	} = {};

	private readonly _azApi: azExt.IExtension;

	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _miaaModel: MiaaModel) {
		super(modelView, dashboard);
		this._azApi = vscode.extensions.getExtension(azExt.extension.name)?.exports;

		this.initializeConfigurationBoxes();

		this.disposables.push(this._miaaModel.onConfigUpdated(
			() => this.eventuallyRunOnInitialized(() => this.handleServiceUpdated())));
	}

	protected get title(): string {
		return loc.computeAndStorage;
	}

	protected get id(): string {
		return 'miaa-compute-and-storage';
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
			value: loc.miaaComputeAndStorageDescriptionPartOne,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px', 'max-width': 'auto' }
		}).component();

		const memoryVCoreslink = this.modelView.modelBuilder.hyperlink().withProps({
			label: loc.scalingCompute,
			url: 'https://docs.microsoft.com/azure/azure-arc/data/configure-managed-instance',
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
				memoryVCoreslink,
				infoComputeStorage_p4,
				infoComputeStorage_p5,
				infoComputeStorage_p6
			], { CSSStyles: { 'margin-right': '5px' } }).component();
		content.addItem(computeInfoAndLinks, { CSSStyles: { 'min-height': '30px' } });

		this.configurationContainer = this.modelView.modelBuilder.divContainer().component();
		this.configurationContainer.addItems(this.createUserInputSection(), { CSSStyles: { 'min-height': '30px' } });
		content.addItem(this.configurationContainer, { CSSStyles: { 'margin-top': '30px' } });

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
				this.saveButton!.enabled = false;
				try {
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: loc.updatingInstance(this._miaaModel.info.name),
							cancellable: false
						},
						async (_progress, _token): Promise<void> => {
							try {
								await this._azApi.az.sql.miarc.edit(
									this._miaaModel.info.name, this.saveArgs, this._miaaModel.controllerModel.info.namespace, this._miaaModel.controllerModel.azAdditionalEnvVars);
							} catch (err) {
								this.saveButton!.enabled = true;
								throw err;
							}
							try {
								await this._miaaModel.refresh();
							} catch (error) {
								vscode.window.showErrorMessage(loc.refreshFailed(error));
							}
						}
					);

					vscode.window.showInformationMessage(loc.instanceUpdated(this._miaaModel.info.name));

					this.discardButton!.enabled = false;
				} catch (error) {
					vscode.window.showErrorMessage(loc.instanceUpdateFailed(this._miaaModel.info.name, error));
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
				this.discardButton!.enabled = false;
				try {
					this.editCores();
					this.editMemory();
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
		this.coresLimitBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			min: 1,
			inputType: 'number',
			placeHolder: loc.loading,
			ariaLabel: loc.coresLimit
		}).component();

		this.disposables.push(
			this.coresLimitBox.onTextChanged(() => {
				if (!(this.handleOnTextChanged(this.coresLimitBox!))) {
					this.saveArgs.coresLimit = undefined;
				} else {
					this.saveArgs.coresLimit = this.coresLimitBox!.value;
				}
			})
		);

		this.coresRequestBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			min: 1,
			inputType: 'number',
			placeHolder: loc.loading,
			ariaLabel: loc.coresRequest
		}).component();

		this.disposables.push(
			this.coresRequestBox.onTextChanged(() => {
				if (!(this.handleOnTextChanged(this.coresRequestBox!))) {
					this.saveArgs.coresRequest = undefined;
				} else {
					this.saveArgs.coresRequest = this.coresRequestBox!.value;
				}
			})
		);

		this.memoryLimitBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			min: 2,
			inputType: 'number',
			placeHolder: loc.loading,
			ariaLabel: loc.memoryLimit
		}).component();

		this.disposables.push(
			this.memoryLimitBox.onTextChanged(() => {
				if (!(this.handleOnTextChanged(this.memoryLimitBox!))) {
					this.saveArgs.memoryLimit = undefined;
				} else {
					this.saveArgs.memoryLimit = this.memoryLimitBox!.value + 'Gi';
				}
			})
		);

		this.memoryRequestBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			min: 2,
			inputType: 'number',
			placeHolder: loc.loading,
			ariaLabel: loc.memoryRequest
		}).component();

		this.disposables.push(
			this.memoryRequestBox.onTextChanged(() => {
				if (!(this.handleOnTextChanged(this.memoryRequestBox!))) {
					this.saveArgs.memoryRequest = undefined;
				} else {
					this.saveArgs.memoryRequest = this.memoryRequestBox!.value + 'Gi';
				}
			})
		);

	}

	private createUserInputSection(): azdata.Component[] {
		if (this._miaaModel.configLastUpdated) {
			this.editCores();
			this.editMemory();
		}

		return [
			this.createConfigurationSectionContainer(loc.coresRequest, this.coresRequestBox!),
			this.createConfigurationSectionContainer(loc.coresLimit, this.coresLimitBox!),
			this.createConfigurationSectionContainer(loc.memoryRequest, this.memoryRequestBox!),
			this.createConfigurationSectionContainer(loc.memoryLimit, this.memoryLimitBox!)

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
			value: `${key} :`,
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

	private editCores(): void {
		let currentCPUSize = this._miaaModel.config?.spec?.scheduling?.default?.resources?.requests?.cpu;

		if (!currentCPUSize) {
			currentCPUSize = '';
		}

		this.coresRequestBox!.placeHolder = currentCPUSize;
		this.coresRequestBox!.value = '';
		this.saveArgs.coresRequest = undefined;

		currentCPUSize = this._miaaModel.config?.spec?.scheduling?.default?.resources?.limits?.cpu;

		if (!currentCPUSize) {
			currentCPUSize = '';
		}

		this.coresLimitBox!.placeHolder = currentCPUSize;
		this.coresLimitBox!.value = '';
		this.saveArgs.coresLimit = undefined;
	}

	private editMemory(): void {
		let currentMemSizeConversion: string;
		let currentMemorySize = this._miaaModel.config?.spec?.scheduling?.default?.resources?.requests?.memory;

		if (!currentMemorySize) {
			currentMemSizeConversion = '';
		} else {
			currentMemSizeConversion = convertToGibibyteString(currentMemorySize);
		}

		this.memoryRequestBox!.placeHolder = currentMemSizeConversion!;
		this.memoryRequestBox!.value = '';

		this.saveArgs.memoryRequest = undefined;

		currentMemorySize = this._miaaModel.config?.spec?.scheduling?.default?.resources?.limits?.memory;

		if (!currentMemorySize) {
			currentMemSizeConversion = '';
		} else {
			currentMemSizeConversion = convertToGibibyteString(currentMemorySize);
		}

		this.memoryLimitBox!.placeHolder = currentMemSizeConversion!;
		this.memoryLimitBox!.value = '';

		this.saveArgs.memoryLimit = undefined;
	}

	private handleServiceUpdated() {
		this.editCores();
		this.editMemory();
	}
}
