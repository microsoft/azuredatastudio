/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { createMigrationController, getMigrationControllerRegions, getMigrationController, getResourceGroups, getSubscriptions, Subscription, getMigrationControllerAuthKeys } from '../api/azure';
import { MigrationStateModel } from '../models/stateMachine';
import * as constants from '../models/strings';
import * as os from 'os';
import { azureResource } from 'azureResource';
import { IntergrationRuntimePage } from './integrationRuntimePage';

export class CreateMigrationControllerDialog {

	private migrationControllerSubscriptionDropdown!: azdata.DropDownComponent;
	private migrationControllerResourceGroupDropdown!: azdata.DropDownComponent;
	private migrationControllerRegionDropdown!: azdata.DropDownComponent;
	private migrationControllerNameText!: azdata.InputBoxComponent;
	private _formSubmitButton!: azdata.ButtonComponent;

	private _statusLoadingComponent!: azdata.LoadingComponent;
	private migrationControllerAuthKeyTable!: azdata.DeclarativeTableComponent;
	private _connectionStatus!: azdata.TextComponent;
	private _copyKey1Button!: azdata.ButtonComponent;
	private _copyKey2Button!: azdata.ButtonComponent;
	private _setupContainer!: azdata.FlexContainer;

	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;
	private _subscriptionMap: Map<string, Subscription> = new Map();

	constructor(private migrationStateModel: MigrationStateModel, private irPage: IntergrationRuntimePage) {
		this._dialogObject = azdata.window.createModelViewDialog(constants.IR_PAGE_TITLE, 'MigrationControllerDialog', 'wide');
	}

	initialize() {
		let tab = azdata.window.createTab('');
		this._dialogObject.registerCloseValidator(async () => {
			return true;
		});
		tab.registerContent((view: azdata.ModelView) => {
			this._view = view;

			this._formSubmitButton = view.modelBuilder.button().withProps({
				label: constants.SUBMIT,
				width: '80px'
			}).component();

			this._formSubmitButton.onDidClick(async (e) => {
				this._statusLoadingComponent.loading = true;
				this._formSubmitButton.enabled = false;

				const subscription = this._subscriptionMap.get((this.migrationControllerSubscriptionDropdown.value as azdata.CategoryValue).name)!;
				const resourceGroup = (this.migrationControllerResourceGroupDropdown.value as azdata.CategoryValue).name;
				const region = (this.migrationControllerRegionDropdown.value as azdata.CategoryValue).name;
				const controllerName = this.migrationControllerNameText.value;

				const formValidationErrors = this.validateCreateControllerForm(subscription, resourceGroup, region, controllerName);

				if (formValidationErrors.length > 0) {
					this.setDialogMessage(formValidationErrors);
					this._statusLoadingComponent.loading = false;
					this._formSubmitButton.enabled = true;
					return;
				}

				try {
					const createdController = await createMigrationController(this.migrationStateModel.azureAccount, subscription, resourceGroup, region, controllerName!);
					if (createdController.error) {
						this.setDialogMessage(`${createdController.error.code} : ${createdController.error.message}`);
						this._statusLoadingComponent.loading = false;
						this._formSubmitButton.enabled = true;
						return;
					}
					this._dialogObject.message = {
						text: ''
					};
					this.migrationStateModel.migrationController = createdController;
					await this.refreshAuthTable();
					await this.refreshStatus();
					this._setupContainer.display = 'inline';
					this._statusLoadingComponent.loading = false;
				} catch (e) {
					console.log(e);
					this._statusLoadingComponent.loading = false;
					this._formSubmitButton.enabled = true;
					return;
				}
			});

			this._statusLoadingComponent = view.modelBuilder.loadingComponent().withProps({
				loadingText: constants.CONTROLLER_DIALOG_CONTROLLER_CONTAINER_LOADING_HELP,
				loading: false
			}).component();

			const creationStatusContainer = this.createControllerStatus();

			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: this.migrationControllerDropdownsContainer()
					},
					{
						component: this._formSubmitButton
					},
					{
						component: this._statusLoadingComponent
					},
					{
						component: creationStatusContainer
					}
				],
				{
					horizontal: false
				}
			);

			const form = formBuilder.withLayout({ width: '100%' }).component();

			return view.initializeModel(form).then(() => {
				this.populateSubscriptions();
			});
		});

		this._dialogObject.content = [tab];
		this._dialogObject.okButton.enabled = false;
		azdata.window.openDialog(this._dialogObject);
		this._dialogObject.cancelButton.onClick((e) => {
			this.migrationStateModel.migrationController = undefined;
		});
		this._dialogObject.okButton.onClick((e) => {
			this.irPage.populateMigrationController();
		});
	}

	private migrationControllerDropdownsContainer(): azdata.FlexContainer {
		const dialogDescription = this._view.modelBuilder.text().withProps({
			value: constants.IR_PAGE_DESCRIPTION,
			links: [
				{
					text: constants.LEARN_MORE,
					url: 'https://www.microsoft.com' // TODO: add a proper link to the docs.
				}
			]
		}).component();

		const formHeading = this._view.modelBuilder.text().withProps({
			value: constants.CONTROLLER_DIALOG_CREATE_CONTROLLER_FORM_HEADING
		}).component();

		const subscriptionDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.SUBSCRIPTION
		}).component();

		this.migrationControllerSubscriptionDropdown = this._view.modelBuilder.dropDown().withProps({
			required: true
		}).component();

		this.migrationControllerSubscriptionDropdown.onValueChanged((e) => {
			if (this.migrationControllerSubscriptionDropdown.value) {
				this.populateResourceGroups();
			}
		});

		const resourceGroupDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.RESOURCE_GROUP
		}).component();

		this.migrationControllerResourceGroupDropdown = this._view.modelBuilder.dropDown().withProps({
			required: true
		}).component();

		const controllerNameLabel = this._view.modelBuilder.text().withProps({
			value: constants.NAME
		}).component();

		this.migrationControllerNameText = this._view.modelBuilder.inputBox().component();

		const regionsDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.REGION
		}).component();

		this.migrationControllerRegionDropdown = this._view.modelBuilder.dropDown().withProps({
			required: true,
			values: getMigrationControllerRegions()
		}).component();

		const flexContainer = this._view.modelBuilder.flexContainer().withItems([
			dialogDescription,
			formHeading,
			subscriptionDropdownLabel,
			this.migrationControllerSubscriptionDropdown,
			resourceGroupDropdownLabel,
			this.migrationControllerResourceGroupDropdown,
			controllerNameLabel,
			this.migrationControllerNameText,
			regionsDropdownLabel,
			this.migrationControllerRegionDropdown
		]).withLayout({
			flexFlow: 'column'
		}).component();
		return flexContainer;
	}

	private validateCreateControllerForm(subscription: azureResource.AzureResourceSubscription, resourceGroup: string | undefined, region: string | undefined, controllerName: string | undefined): string {
		const errors: string[] = [];
		if (!subscription) {
			errors.push(constants.INVALID_SUBSCRIPTION_ERROR);
		}
		if (!resourceGroup) {
			errors.push(constants.INVALID_RESOURCE_GROUP_ERROR);
		}
		if (!region) {
			errors.push(constants.INVALID_REGION_ERROR);
		}
		if (!controllerName || controllerName.length === 0) {
			errors.push(constants.INVALID_CONTROLLER_NAME_ERROR);
		}
		return errors.join(os.EOL);
	}

	private async populateSubscriptions(): Promise<void> {
		this.migrationControllerSubscriptionDropdown.loading = true;
		this.migrationControllerResourceGroupDropdown.loading = true;
		const subscriptions = await getSubscriptions(this.migrationStateModel.azureAccount);

		let subscriptionDropdownValues: azdata.CategoryValue[] = [];
		if (subscriptions && subscriptions.length > 0) {

			subscriptions.forEach((subscription) => {
				this._subscriptionMap.set(subscription.id, subscription);
				subscriptionDropdownValues.push({
					name: subscription.id,
					displayName: subscription.name + ' - ' + subscription.id,
				});
			});


		} else {
			subscriptionDropdownValues = [
				{
					displayName: constants.NO_SUBSCRIPTIONS_FOUND,
					name: ''
				}
			];
		}

		this.migrationControllerSubscriptionDropdown.values = subscriptionDropdownValues;
		this.migrationControllerSubscriptionDropdown.loading = false;
		this.populateResourceGroups();
	}

	private async populateResourceGroups(): Promise<void> {
		this.migrationControllerResourceGroupDropdown.loading = true;
		let subscription = this._subscriptionMap.get((this.migrationControllerSubscriptionDropdown.value as azdata.CategoryValue).name)!;
		const resourceGroups = await getResourceGroups(this.migrationStateModel.azureAccount, subscription);
		let resourceGroupDropdownValues: azdata.CategoryValue[] = [];
		if (resourceGroups && resourceGroups.length > 0) {
			resourceGroups.forEach((resourceGroup) => {
				resourceGroupDropdownValues.push({
					name: resourceGroup.name,
					displayName: resourceGroup.name
				});
			});
		} else {
			resourceGroupDropdownValues = [
				{
					displayName: constants.RESOURCE_GROUP_NOT_FOUND,
					name: ''
				}
			];
		}
		this.migrationControllerResourceGroupDropdown.values = resourceGroupDropdownValues;
		this.migrationControllerResourceGroupDropdown.loading = false;
	}

	private createControllerStatus(): azdata.FlexContainer {

		const informationTextBox = this._view.modelBuilder.text().withProps({
			value: constants.CONTROLLER_DIALOG_CONTROLLER_CONTAINER_DESCRIPTION
		}).component();

		const expressSetupTitle = this._view.modelBuilder.text().withProps({
			value: constants.CONTROLLER_OPTION1_HEADING,
			CSSStyles: {
				'font-weight': 'bold'
			}
		}).component();

		const expressSetupLink = this._view.modelBuilder.hyperlink().withProps({
			label: constants.CONTROLLER_OPTION1_SETUP_LINK_TEXT,
			url: ''
		}).component();

		expressSetupLink.onDidClick((e) => {
			vscode.window.showInformationMessage(constants.FEATURE_NOT_AVAILABLE);
		});

		const manualSetupTitle = this._view.modelBuilder.text().withProps({
			value: constants.CONTROLLER_OPTION2_HEADING,
			CSSStyles: {
				'font-weight': 'bold'
			}
		}).component();

		const manualSetupButton = this._view.modelBuilder.hyperlink().withProps({
			label: constants.CONTROLLER_OPTION2_STEP1,
			url: 'https://www.microsoft.com/download/details.aspx?id=39717'
		}).component();

		const manualSetupSecondDescription = this._view.modelBuilder.text().withProps({
			value: constants.CONTROLLER_OPTION2_STEP2
		}).component();

		const connectionStatusTitle = this._view.modelBuilder.text().withProps({
			value: constants.CONTROLLER_CONNECTION_STATUS,
			CSSStyles: {
				'font-weight': 'bold'
			}
		}).component();

		this._connectionStatus = this._view.modelBuilder.text().withProps({
			value: ''
		}).component();

		const refreshButton = this._view.modelBuilder.button().withProps({
			label: constants.REFRESH,
		}).component();

		const refreshLoadingIndicator = this._view.modelBuilder.loadingComponent().withProps({
			loading: false
		}).component();

		refreshButton.onDidClick(async (e) => {
			refreshLoadingIndicator.loading = true;
			try {
				await this.refreshStatus();
			} catch (e) {
				console.log(e);
			}
			refreshLoadingIndicator.loading = false;
		});

		const connectionStatusContainer = this._view.modelBuilder.flexContainer().withItems(
			[
				this._connectionStatus,
				refreshButton,
				refreshLoadingIndicator
			]
		).component();


		this.migrationControllerAuthKeyTable = this._view.modelBuilder.declarativeTable().withProps({
			columns: [
				{
					displayName: constants.NAME,
					valueType: azdata.DeclarativeDataType.string,
					width: '100px',
					isReadOnly: true,
				},
				{
					displayName: constants.AUTH_KEY_COLUMN_HEADER,
					valueType: azdata.DeclarativeDataType.string,
					width: '300px',
					isReadOnly: true,
				},
				{
					displayName: '',
					valueType: azdata.DeclarativeDataType.component,
					width: '100px',
					isReadOnly: true,
				}
			],
			CSSStyles: {
				'margin-top': '25px'
			}
		}).component();

		const refreshKeyButton = this._view.modelBuilder.button().withProps({
			label: constants.REFRESH_KEYS,
			CSSStyles: {
				'margin-top': '10px'
			},
			width: '100px'
		}).component();

		refreshKeyButton.onDidClick(async (e) => {
			this.refreshAuthTable();

		});

		this._setupContainer = this._view.modelBuilder.flexContainer().withItems(
			[
				informationTextBox,
				expressSetupTitle,
				expressSetupLink,
				manualSetupTitle,
				manualSetupButton,
				manualSetupSecondDescription,
				refreshKeyButton,
				this.migrationControllerAuthKeyTable,
				connectionStatusTitle,
				connectionStatusContainer
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		this._setupContainer.display = 'none';
		return this._setupContainer;
	}

	private async refreshStatus(): Promise<void> {
		const subscription = this._subscriptionMap.get((this.migrationControllerSubscriptionDropdown.value as azdata.CategoryValue).name)!;
		const resourceGroup = (this.migrationControllerResourceGroupDropdown.value as azdata.CategoryValue).name;
		const region = (this.migrationControllerRegionDropdown.value as azdata.CategoryValue).name;
		const controllerStatus = await getMigrationController(this.migrationStateModel.azureAccount, subscription, resourceGroup, region, this.migrationStateModel.migrationController!.name);
		if (controllerStatus) {
			const state = controllerStatus.properties.integrationRuntimeState;

			if (state === 'Online') {
				this._connectionStatus.value = constants.CONTRLLER_READY(this.migrationStateModel.migrationController!.name, os.hostname());
				this._dialogObject.okButton.enabled = true;
			} else {
				this._connectionStatus.value = constants.CONTRLLER_NOT_READY(this.migrationStateModel.migrationController!.name);
				this._dialogObject.okButton.enabled = false;
			}
		}

	}
	private async refreshAuthTable(): Promise<void> {
		const subscription = this._subscriptionMap.get((this.migrationControllerSubscriptionDropdown.value as azdata.CategoryValue).name)!;
		const resourceGroup = (this.migrationControllerResourceGroupDropdown.value as azdata.CategoryValue).name;
		const region = (this.migrationControllerRegionDropdown.value as azdata.CategoryValue).name;
		const keys = await getMigrationControllerAuthKeys(this.migrationStateModel.azureAccount, subscription, resourceGroup, region, this.migrationStateModel.migrationController!.name);

		this._copyKey1Button = this._view.modelBuilder.button().withProps({
			label: constants.COPY_KEY
		}).component();

		this._copyKey1Button.onDidClick((e) => {
			vscode.env.clipboard.writeText(<string>this.migrationControllerAuthKeyTable.dataValues![0][1].value);
			vscode.window.showInformationMessage(constants.CONTROLLER_KEY_COPIED_HELP);
		});

		this._copyKey2Button = this._view.modelBuilder.button().withProps({
			label: constants.COPY_KEY
		}).component();

		this._copyKey2Button.onDidClick((e) => {
			vscode.env.clipboard.writeText(<string>this.migrationControllerAuthKeyTable.dataValues![1][1].value);
			vscode.window.showInformationMessage(constants.CONTROLLER_KEY_COPIED_HELP);
		});

		this.migrationControllerAuthKeyTable.updateProperties({
			dataValues: [
				[
					{
						value: constants.CONTROLELR_KEY1_LABEL
					},
					{
						value: keys.keyName1
					},
					{
						value: this._copyKey1Button
					}
				],
				[
					{
						value: constants.CONTROLELR_KEY2_LABEL
					},
					{
						value: keys.keyName2
					},
					{
						value: this._copyKey2Button
					}
				]
			]
		});

	}

	private setDialogMessage(message: string, level: azdata.window.MessageLevel = azdata.window.MessageLevel.Error): void {
		this._dialogObject.message = {
			text: message,
			level: level
		};
	}
}
