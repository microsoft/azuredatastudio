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
import { PostgresModel } from '../../../models/postgresModel';
import { convertToGibibyteString } from '../../../common/utils';

export type RoleSpecifier = {
	coordinator?: string
};

export type ConfigurationSpecModel = {
	workers?: number,
	coresRequest?: RoleSpecifier,
	coresLimit?: RoleSpecifier,
	memoryRequest?: RoleSpecifier,
	memoryLimit?: RoleSpecifier
};

export class PostgresComputeAndStoragePage extends DashboardPage {
	private userInputContainer!: azdata.DivContainer;

	private coordinatorCoresLimitBox!: azdata.InputBoxComponent;
	private coordinatorCoresRequestBox!: azdata.InputBoxComponent;
	private coordinatorMemoryLimitBox!: azdata.InputBoxComponent;
	private coordinatorMemoryRequestBox!: azdata.InputBoxComponent;

	private currentConfiguration: ConfigurationSpecModel = {};
	private saveArgs: ConfigurationSpecModel = {};

	private discardButton!: azdata.ButtonComponent;
	private saveButton!: azdata.ButtonComponent;

	private readonly _azApi: azExt.IExtension;

	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _postgresModel: PostgresModel) {
		super(modelView, dashboard);
		this._azApi = vscode.extensions.getExtension(azExt.extension.name)?.exports;

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

		const infoComputeStorage_p3 = this.modelView.modelBuilder.text().withProps({
			value: loc.computeAndStorageDescriptionPartThree,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const memoryVCoreslink = this.modelView.modelBuilder.hyperlink().withProps({
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
				infoComputeStorage_p3,
				memoryVCoreslink,
				infoComputeStorage_p4,
				infoComputeStorage_p5,
				infoComputeStorage_p6
			], { CSSStyles: { 'margin-right': '5px' } })
			.component();
		content.addItem(computeInfoAndLinks, { CSSStyles: { 'min-height': '30px' } });

		// User input section
		this.userInputContainer = this.modelView.modelBuilder.divContainer().component();
		this.userInputContainer.addItems(this.createUserInputWorkerSection(), { CSSStyles: { 'min-height': '30px' } });
		content.addItem(this.userInputContainer, { CSSStyles: { 'min-height': '30px' } });

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
								await this._azApi.az.postgres.serverarc.update(
									this._postgresModel.info.name,
									{
										coresRequest: this.schedulingParamsToEdit(this.saveArgs.coresRequest!),
										coresLimit: this.schedulingParamsToEdit(this.saveArgs.coresLimit!),
										memoryRequest: this.schedulingParamsToEdit(this.saveArgs.memoryRequest!),
										memoryLimit: this.schedulingParamsToEdit(this.saveArgs.memoryLimit!)
									},
									this._postgresModel.controllerModel.info.namespace,
									this._postgresModel.controllerModel.azAdditionalEnvVars);
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
					this.coordinatorCoresRequestBox.value = this.currentConfiguration.coresRequest!.coordinator;
					this.coordinatorCoresLimitBox.value = this.currentConfiguration.coresLimit!.coordinator;
					this.coordinatorMemoryRequestBox.value = this.currentConfiguration.memoryRequest!.coordinator;
					this.coordinatorMemoryLimitBox.value = this.currentConfiguration.memoryLimit!.coordinator;
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

	private schedulingParamsToEdit(arg: RoleSpecifier): string | undefined {
		// A comma-separated list of roles with values can be specified in format <role>=<value>.
		if (arg.coordinator) {
			return `"${arg.coordinator}"`;
		} else {
			return arg.coordinator ?? undefined;
		}
	}

	private initializeConfigurationBoxes(): void {
		// Coordinator node cores request
		this.coordinatorCoresRequestBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			min: 1,
			inputType: 'number',
			placeHolder: loc.loading,
			ariaLabel: loc.coresRequest
		}).component();

		this.disposables.push(
			this.coordinatorCoresRequestBox.onTextChanged(() => {
				if (!(this.saveValueToEdit(this.coordinatorCoresRequestBox, this.currentConfiguration.coresRequest!.coordinator!))) {
					this.saveArgs.coresRequest!.coordinator = undefined;
				} else if (this.coordinatorCoresRequestBox.value === '') {
					this.saveArgs.coresRequest!.coordinator = 'c=';
				} else {
					this.saveArgs.coresRequest!.coordinator = `c=${this.coordinatorCoresRequestBox.value}`;
				}
			})
		);

		// Coordinator node cores limit
		this.coordinatorCoresLimitBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			min: 1,
			inputType: 'number',
			placeHolder: loc.loading,
			ariaLabel: loc.coresLimit
		}).component();

		this.disposables.push(
			this.coordinatorCoresLimitBox.onTextChanged(() => {
				if (!(this.saveValueToEdit(this.coordinatorCoresLimitBox, this.currentConfiguration.coresLimit!.coordinator!))) {
					this.saveArgs.coresLimit!.coordinator = undefined;
				} else if (this.coordinatorCoresLimitBox.value === '') {
					this.saveArgs.coresLimit!.coordinator = 'c=';
				} else {
					this.saveArgs.coresLimit!.coordinator = `c=${this.coordinatorCoresLimitBox.value}`;
				}
			})
		);

		// Coordinator node memory request
		this.coordinatorMemoryRequestBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			min: 0.25,
			inputType: 'number',
			placeHolder: loc.loading,
			ariaLabel: loc.memoryRequest
		}).component();

		this.disposables.push(
			this.coordinatorMemoryRequestBox.onTextChanged(() => {
				if (!(this.saveValueToEdit(this.coordinatorMemoryRequestBox, this.currentConfiguration.memoryRequest!.coordinator!))) {
					this.saveArgs.memoryRequest!.coordinator = undefined;
				} else if (this.coordinatorMemoryRequestBox.value === '') {
					this.saveArgs.memoryRequest!.coordinator = 'c=';
				} else {
					this.saveArgs.memoryRequest!.coordinator = `c=${this.coordinatorMemoryRequestBox.value}Gi`;
				}
			})
		);

		// Coordinator node memory limit
		this.coordinatorMemoryLimitBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			min: 0.25,
			inputType: 'number',
			placeHolder: loc.loading,
			ariaLabel: loc.memoryLimit
		}).component();

		this.disposables.push(
			this.coordinatorMemoryLimitBox.onTextChanged(() => {
				if (!(this.saveValueToEdit(this.coordinatorMemoryLimitBox, this.currentConfiguration.memoryLimit!.coordinator!))) {
					this.saveArgs.memoryLimit!.coordinator = undefined;
				} else if (this.coordinatorMemoryLimitBox.value === '') {
					this.saveArgs.memoryLimit!.coordinator = 'c=';
				} else {
					this.saveArgs.memoryLimit!.coordinator = `c=${this.coordinatorMemoryLimitBox.value}Gi`;
				}
			})
		);
	}

	private createUserInputWorkerSection(): azdata.Component[] {
		if (this._postgresModel.configLastUpdated) {
			this.refreshCoresRequest();
			this.refreshCoresLimit();
			this.refreshMemoryRequest();
			this.refreshMemoryLimit();
		}

		return [
			this.createCoresMemorySection(loc.configuration),
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
			this.discardButton.enabled = true;
			return false;
		} else {
			this.saveButton.enabled = true;
			this.discardButton.enabled = true;
			return true;
		}
	}

	private createCoresMemorySection(title: string): azdata.DivContainer {
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
		titleContainer.addItem(titleComponent, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '15px', 'margin-top': '15px' } });

		flexContainer.addItem(titleContainer, titleFlex);

		let configurationSection = this.modelView.modelBuilder.divContainer().component();
		configurationSection.addItem(flexContainer);

		return configurationSection;
	}

	private refreshCoresRequest(): void {
		// Coordinator
		let coordinatorCR = this._postgresModel.config?.spec.scheduling?.roles?.coordinator?.resources?.requests?.cpu ?? this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.cpu;
		if (!coordinatorCR) {
			coordinatorCR = '';
		}

		this.coordinatorCoresRequestBox.placeHolder = '';
		this.coordinatorCoresRequestBox.value = coordinatorCR;

		// Update saved current configuration
		this.currentConfiguration.coresRequest = {
			coordinator: coordinatorCR
		};

		// Discard argument changes
		this.saveArgs.coresRequest = {};
	}

	private refreshCoresLimit(): void {
		// Coordinator
		let coordinatorCL = this._postgresModel.config?.spec.scheduling?.roles?.coordinator?.resources?.limits?.cpu ?? this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.cpu;
		if (!coordinatorCL) {
			coordinatorCL = '';
		}

		this.coordinatorCoresLimitBox.placeHolder = '';
		this.coordinatorCoresLimitBox.value = coordinatorCL;

		// Update saved current configuration
		this.currentConfiguration.coresLimit = {
			coordinator: coordinatorCL
		};

		// Discard argument changes
		this.saveArgs.coresLimit = {};
	}

	private refreshMemoryRequest(): void {
		// Coordinator
		let currentCoordinatorMemoryRequest = this._postgresModel.config?.spec.scheduling?.roles?.coordinator?.resources?.requests?.memory ?? this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.memory;
		let coordinatorMR = '';
		if (currentCoordinatorMemoryRequest) {
			coordinatorMR = convertToGibibyteString(currentCoordinatorMemoryRequest);
		}

		this.coordinatorMemoryRequestBox.placeHolder = '';
		this.coordinatorMemoryRequestBox.value = coordinatorMR;

		// Update saved current configuration
		this.currentConfiguration.memoryRequest = {
			coordinator: coordinatorMR
		};

		// Discard argument changes
		this.saveArgs.memoryRequest = {};
	}

	private refreshMemoryLimit(): void {
		// Coordinator
		let currentCoordinatorMemoryLimit = this._postgresModel.config?.spec.scheduling?.roles?.coordinator?.resources?.limits?.memory ?? this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.memory;
		let coordinatorML = '';
		if (currentCoordinatorMemoryLimit) {
			coordinatorML = convertToGibibyteString(currentCoordinatorMemoryLimit);
		}

		this.coordinatorMemoryLimitBox.placeHolder = '';
		this.coordinatorMemoryLimitBox.value = coordinatorML;

		// Update saved current configuration
		this.currentConfiguration.memoryLimit = {
			coordinator: coordinatorML
		};

		// Discard argument changes
		this.saveArgs.memoryLimit = {};
	}

	private handleServiceUpdated(): void {
		this.refreshCoresRequest();
		this.refreshCoresLimit();
		this.refreshMemoryRequest();
		this.refreshMemoryLimit();
	}
}
