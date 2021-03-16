/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { createSqlMigrationService, getSqlMigrationServiceRegions, getSqlMigrationService, getResourceGroups, getSqlMigrationServiceAuthKeys, getSqlMigrationServiceMonitoringData, SqlMigrationService } from '../../api/azure';
import { MigrationStateModel } from '../../models/stateMachine';
import * as constants from '../../constants/strings';
import * as os from 'os';
import { azureResource } from 'azureResource';
import { IntergrationRuntimePage } from '../../wizard/integrationRuntimePage';
import { IconPathHelper } from '../../constants/iconPathHelper';

export class CreateSqlMigrationServiceDialog {

	private migrationServiceSubscriptionDropdown!: azdata.DropDownComponent;
	private migrationServiceResourceGroupDropdown!: azdata.DropDownComponent;
	private migrationServiceRegionDropdown!: azdata.DropDownComponent;
	private migrationServiceNameText!: azdata.InputBoxComponent;
	private _formSubmitButton!: azdata.ButtonComponent;

	private _statusLoadingComponent!: azdata.LoadingComponent;
	private migrationServiceAuthKeyTable!: azdata.DeclarativeTableComponent;
	private _connectionStatus!: azdata.InfoBoxComponent;
	private _copyKey1Button!: azdata.ButtonComponent;
	private _copyKey2Button!: azdata.ButtonComponent;
	private _refreshKey1Button!: azdata.ButtonComponent;
	private _refreshKey2Button!: azdata.ButtonComponent;
	private _setupContainer!: azdata.FlexContainer;

	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;

	private createdMigrationService!: SqlMigrationService;
	private createdMigrationServiceNodeNames!: string[];

	constructor(private migrationStateModel: MigrationStateModel, private irPage: IntergrationRuntimePage) {
		this._dialogObject = azdata.window.createModelViewDialog(constants.IR_PAGE_TITLE, 'MigrationServiceDialog', 'medium');
	}

	initialize() {
		let tab = azdata.window.createTab('');
		this._dialogObject.registerCloseValidator(async () => {
			return true;
		});
		tab.registerContent((view: azdata.ModelView) => {
			this._view = view;

			this._formSubmitButton = view.modelBuilder.button().withProps({
				label: constants.CREATE,
				width: '80px'
			}).component();

			this._formSubmitButton.onDidClick(async (e) => {
				this._statusLoadingComponent.loading = true;
				this._formSubmitButton.enabled = false;

				const subscription = this.migrationStateModel._targetSubscription;
				const resourceGroup = (this.migrationServiceResourceGroupDropdown.value as azdata.CategoryValue).name;
				const region = (this.migrationServiceRegionDropdown.value as azdata.CategoryValue).name;
				const serviceName = this.migrationServiceNameText.value;

				const formValidationErrors = this.validateCreateServiceForm(subscription, resourceGroup, region, serviceName);

				if (formValidationErrors.length > 0) {
					this.setDialogMessage(formValidationErrors);
					this._statusLoadingComponent.loading = false;
					this._formSubmitButton.enabled = true;
					return;
				}

				try {
					this.createdMigrationService = await createSqlMigrationService(this.migrationStateModel._azureAccount, subscription, resourceGroup, region, serviceName!);
					if (this.createdMigrationService.error) {
						this.setDialogMessage(`${this.createdMigrationService.error.code} : ${this.createdMigrationService.error.message}`);
						this._statusLoadingComponent.loading = false;
						this._formSubmitButton.enabled = true;
						return;
					}
					this._dialogObject.message = {
						text: ''
					};
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
				loadingText: constants.LOADING_MIGRATION_SERVICES,
				loading: false
			}).component();

			const creationStatusContainer = this.createServiceStatus();

			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: this.migrationServiceDropdownContainer()
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
		});
		this._dialogObject.okButton.onClick((e) => {
			this.irPage.populateMigrationService(this.createdMigrationService, this.createdMigrationServiceNodeNames);
		});
	}

	private migrationServiceDropdownContainer(): azdata.FlexContainer {
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
			value: constants.CREATE_SERVICE_FORM_HEADING
		}).component();

		const subscriptionDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.SUBSCRIPTION
		}).component();

		this.migrationServiceSubscriptionDropdown = this._view.modelBuilder.dropDown().withProps({
			required: true,
			enabled: false
		}).component();

		this.migrationServiceSubscriptionDropdown.onValueChanged((e) => {
			if (this.migrationServiceSubscriptionDropdown.value) {
				this.populateResourceGroups();
			}
		});

		const resourceGroupDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.RESOURCE_GROUP
		}).component();

		this.migrationServiceResourceGroupDropdown = this._view.modelBuilder.dropDown().withProps({
			required: true
		}).component();

		const migrationServiceNameLabel = this._view.modelBuilder.text().withProps({
			value: constants.NAME
		}).component();

		this.migrationServiceNameText = this._view.modelBuilder.inputBox().component();

		const regionsDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.REGION
		}).component();

		this.migrationServiceRegionDropdown = this._view.modelBuilder.dropDown().withProps({
			required: true,
			values: getSqlMigrationServiceRegions()
		}).component();

		const flexContainer = this._view.modelBuilder.flexContainer().withItems([
			dialogDescription,
			formHeading,
			subscriptionDropdownLabel,
			this.migrationServiceSubscriptionDropdown,
			resourceGroupDropdownLabel,
			this.migrationServiceResourceGroupDropdown,
			migrationServiceNameLabel,
			this.migrationServiceNameText,
			regionsDropdownLabel,
			this.migrationServiceRegionDropdown
		]).withLayout({
			flexFlow: 'column'
		}).component();
		return flexContainer;
	}

	private validateCreateServiceForm(subscription: azureResource.AzureResourceSubscription, resourceGroup: string | undefined, region: string | undefined, migrationServiceName: string | undefined): string {
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
		if (!migrationServiceName || migrationServiceName.length === 0) {
			errors.push(constants.INVALID_SERVICE_NAME_ERROR);
		}
		return errors.join(os.EOL);
	}

	private async populateSubscriptions(): Promise<void> {
		this.migrationServiceSubscriptionDropdown.loading = true;
		this.migrationServiceResourceGroupDropdown.loading = true;


		this.migrationServiceSubscriptionDropdown.values = [
			{
				displayName: this.migrationStateModel._targetSubscription.name,
				name: ''
			}
		];
		this.migrationServiceSubscriptionDropdown.loading = false;
		this.populateResourceGroups();
	}

	private async populateResourceGroups(): Promise<void> {
		this.migrationServiceResourceGroupDropdown.loading = true;
		let subscription = this.migrationStateModel._targetSubscription;
		const resourceGroups = await getResourceGroups(this.migrationStateModel._azureAccount, subscription);
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
		this.migrationServiceResourceGroupDropdown.values = resourceGroupDropdownValues;
		this.migrationServiceResourceGroupDropdown.loading = false;
	}

	private createServiceStatus(): azdata.FlexContainer {

		const setupIRHeadingText = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_CONTAINER_HEADING,
			CSSStyles: {
				'font-weight': 'bold'
			}
		}).component();

		const setupIRdescription = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_CONTAINER_DESCRIPTION,
		}).component();

		const irSetupStep1Text = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_STEP1,
			links: [
				{
					text: constants.SERVICE_STEP1_LINK,
					url: 'https://www.microsoft.com/download/details.aspx?id=39717'
				}
			]
		}).component();

		const irSetupStep2Text = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_STEP2
		}).component();

		const irSetupStep3Text = this._view.modelBuilder.hyperlink().withProps({
			label: constants.SERVICE_STEP3,
			url: '',
			CSSStyles: {
				'margin-top': '10px',
				'margin-bottom': '10px'
			}
		}).component();

		irSetupStep3Text.onDidClick(async (e) => {
			refreshLoadingIndicator.loading = true;
			this._connectionStatus.updateCssStyles({
				'display': 'none'
			});
			try {
				await this.refreshStatus();
			} catch (e) {
				console.log(e);
			}
			this._connectionStatus.updateCssStyles({
				'display': 'inline'
			});
			refreshLoadingIndicator.loading = false;
		});


		this._connectionStatus = this._view.modelBuilder.infoBox().component();

		this._connectionStatus.CSSStyles = {
			'width': '350px'
		};

		const refreshLoadingIndicator = this._view.modelBuilder.loadingComponent().withProps({
			loading: false
		}).component();


		this.migrationServiceAuthKeyTable = this._view.modelBuilder.declarativeTable().withProps({
			columns: [
				{
					displayName: constants.NAME,
					valueType: azdata.DeclarativeDataType.string,
					width: '50px',
					isReadOnly: true,
					rowCssStyles: {
						'text-align': 'center'
					}
				},
				{
					displayName: constants.AUTH_KEY_COLUMN_HEADER,
					valueType: azdata.DeclarativeDataType.string,
					width: '500px',
					isReadOnly: true,
					rowCssStyles: {
						overflow: 'scroll'
					}
				},
				{
					displayName: '',
					valueType: azdata.DeclarativeDataType.component,
					width: '15px',
					isReadOnly: true,
				},
				{
					displayName: '',
					valueType: azdata.DeclarativeDataType.component,
					width: '15px',
					isReadOnly: true,
				}
			],
			CSSStyles: {
				'margin-top': '5px'
			}
		}).component();

		this._setupContainer = this._view.modelBuilder.flexContainer().withItems(
			[
				setupIRHeadingText,
				setupIRdescription,
				irSetupStep1Text,
				irSetupStep2Text,
				this.migrationServiceAuthKeyTable,
				irSetupStep3Text,
				this._connectionStatus,
				refreshLoadingIndicator
			], {
			CSSStyles: {
				'margin-bottom': '5px'
			}
		}
		).withLayout({
			flexFlow: 'column'
		}).component();

		this._setupContainer.display = 'none';
		return this._setupContainer;
	}

	private async refreshStatus(): Promise<void> {
		const subscription = this.migrationStateModel._targetSubscription;
		const resourceGroup = (this.migrationServiceResourceGroupDropdown.value as azdata.CategoryValue).name;
		const region = (this.migrationServiceRegionDropdown.value as azdata.CategoryValue).name;
		const migrationServiceStatus = await getSqlMigrationService(this.migrationStateModel._azureAccount, subscription, resourceGroup, region, this.createdMigrationService!.name);
		const migrationServiceMonitoringStatus = await getSqlMigrationServiceMonitoringData(this.migrationStateModel._azureAccount, subscription, resourceGroup, region, this.createdMigrationService!.name);
		this.createdMigrationServiceNodeNames = migrationServiceMonitoringStatus.nodes.map((node) => {
			return node.nodeName;
		});
		if (migrationServiceStatus) {
			const state = migrationServiceStatus.properties.integrationRuntimeState;

			if (state === 'Online') {
				this._connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
					text: constants.SERVICE_READY(this.createdMigrationService!.name, this.createdMigrationServiceNodeNames.join(', ')),
					style: 'success'
				});
				this._dialogObject.okButton.enabled = true;
			} else {
				this._connectionStatus.text = constants.SERVICE_NOT_READY(this.createdMigrationService!.name);
				this._connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
					text: constants.SERVICE_NOT_READY(this.createdMigrationService!.name),
					style: 'warning'
				});
				this._dialogObject.okButton.enabled = false;
			}
		}

	}
	private async refreshAuthTable(): Promise<void> {
		const subscription = this.migrationStateModel._targetSubscription;
		const resourceGroup = (this.migrationServiceResourceGroupDropdown.value as azdata.CategoryValue).name;
		const region = (this.migrationServiceRegionDropdown.value as azdata.CategoryValue).name;
		const keys = await getSqlMigrationServiceAuthKeys(this.migrationStateModel._azureAccount, subscription, resourceGroup, region, this.createdMigrationService!.name);

		this._copyKey1Button = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.copy
		}).component();

		this._copyKey1Button.onDidClick((e) => {
			vscode.env.clipboard.writeText(<string>this.migrationServiceAuthKeyTable.dataValues![0][1].value);
			vscode.window.showInformationMessage(constants.SERVICE_KEY_COPIED_HELP);
		});

		this._copyKey2Button = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.copy
		}).component();

		this._copyKey2Button.onDidClick((e) => {
			vscode.env.clipboard.writeText(<string>this.migrationServiceAuthKeyTable.dataValues![1][1].value);
			vscode.window.showInformationMessage(constants.SERVICE_KEY_COPIED_HELP);
		});

		this._refreshKey1Button = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh
		}).component();

		this._refreshKey1Button.onDidClick((e) => {//TODO: add refresh logic
		});

		this._refreshKey2Button = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh
		}).component();

		this._refreshKey2Button.onDidClick((e) => { //TODO: add refresh logic
		});

		this.migrationServiceAuthKeyTable.updateProperties({
			dataValues: [
				[
					{
						value: constants.SERVICE_KEY1_LABEL
					},
					{
						value: keys.authKey1
					},
					{
						value: this._copyKey1Button
					},
					{
						value: this._refreshKey1Button
					}
				],
				[
					{
						value: constants.SERVICE_KEY2_LABEL
					},
					{
						value: keys.authKey2
					},
					{
						value: this._copyKey2Button
					},
					{
						value: this._refreshKey2Button
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
