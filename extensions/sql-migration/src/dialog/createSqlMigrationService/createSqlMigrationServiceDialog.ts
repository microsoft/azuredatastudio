/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { createSqlMigrationService, getSqlMigrationService, getSqlMigrationServiceAuthKeys, getSqlMigrationServiceMonitoringData, SqlMigrationService } from '../../api/azure';
import { MigrationStateModel, NetworkContainerType } from '../../models/stateMachine';
import * as constants from '../../constants/strings';
import * as os from 'os';
import { azureResource } from 'azureResource';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { CreateResourceGroupDialog } from '../createResourceGroup/createResourceGroupDialog';
import * as EventEmitter from 'events';
import { clearDialogMessage } from '../../api/utils';

export class CreateSqlMigrationServiceDialog {

	private _model!: MigrationStateModel;

	private migrationServiceSubscription!: azdata.TextComponent;
	private migrationServiceResourceGroupDropdown!: azdata.DropDownComponent;
	private migrationServiceLocation!: azdata.InputBoxComponent;
	private migrationServiceNameText!: azdata.InputBoxComponent;
	private _formSubmitButton!: azdata.ButtonComponent;
	private _createResourceGroupLink!: azdata.HyperlinkComponent;

	private _statusLoadingComponent!: azdata.LoadingComponent;
	private _refreshLoadingComponent!: azdata.LoadingComponent;
	private migrationServiceAuthKeyTable!: azdata.DeclarativeTableComponent;
	private _connectionStatus!: azdata.InfoBoxComponent;
	private _copyKey1Button!: azdata.ButtonComponent;
	private _copyKey2Button!: azdata.ButtonComponent;
	private _refreshKey1Button!: azdata.ButtonComponent;
	private _refreshKey2Button!: azdata.ButtonComponent;
	private _setupContainer!: azdata.FlexContainer;
	private _resourceGroupPreset!: string;

	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;

	private _createdMigrationService!: SqlMigrationService;
	private _selectedResourceGroup!: string;
	private _testConnectionButton!: azdata.window.Button;

	private _doneButtonEvent: EventEmitter = new EventEmitter();
	private _isBlobContainerUsed: boolean = false;

	private irNodes: string[] = [];
	private _disposables: vscode.Disposable[] = [];

	public async createNewDms(migrationStateModel: MigrationStateModel, resourceGroupPreset: string): Promise<CreateSqlMigrationServiceDialogResult> {
		this._model = migrationStateModel;
		this._resourceGroupPreset = resourceGroupPreset;
		this._dialogObject = azdata.window.createModelViewDialog(constants.CREATE_MIGRATION_SERVICE_TITLE, 'MigrationServiceDialog', 'medium');
		let tab = azdata.window.createTab('');
		this._dialogObject.registerCloseValidator(async () => {
			return true;
		});
		tab.registerContent(async (view: azdata.ModelView) => {
			this._view = view;

			this._formSubmitButton = view.modelBuilder.button().withProps({
				label: constants.CREATE,
				width: '80px'
			}).component();

			this._disposables.push(this._formSubmitButton.onDidClick(async (e) => {
				this._dialogObject.message = {
					text: ''
				};
				this._statusLoadingComponent.loading = true;
				this.migrationServiceResourceGroupDropdown.loading = false;
				this.setFormEnabledState(false);


				const subscription = this._model._targetSubscription;
				const resourceGroup = (this.migrationServiceResourceGroupDropdown.value as azdata.CategoryValue)?.name;
				const location = this._model._targetServerInstance.location;
				const serviceName = this.migrationServiceNameText.value;

				const formValidationErrors = this.validateCreateServiceForm(subscription, resourceGroup, location, serviceName);

				if (formValidationErrors.length > 0) {
					this.setDialogMessage(formValidationErrors);
					this._statusLoadingComponent.loading = false;
					this.setFormEnabledState(true);
					return;
				}

				try {
					clearDialogMessage(this._dialogObject);
					this._selectedResourceGroup = resourceGroup;
					this._createdMigrationService = await createSqlMigrationService(this._model._azureAccount, subscription, resourceGroup, location, serviceName!, this._model._sessionId);
					if (this._createdMigrationService.error) {
						this.setDialogMessage(`${this._createdMigrationService.error.code} : ${this._createdMigrationService.error.message}`);
						this._statusLoadingComponent.loading = false;
						this.setFormEnabledState(true);
						return;
					}

					if (this._isBlobContainerUsed) {
						this._dialogObject.okButton.enabled = true;
						this._statusLoadingComponent.loading = false;
						this._setupContainer.display = 'none';
						this._dialogObject.message = {
							text: constants.DATA_MIGRATION_SERVICE_CREATED_SUCCESSFULLY,
							level: azdata.window.MessageLevel.Information
						};
					} else {
						await this.refreshStatus();
						await this.refreshAuthTable();
						this._setupContainer.display = 'inline';
						this._testConnectionButton.hidden = false;
						this._statusLoadingComponent.loading = false;
					}
				} catch (e) {
					console.log(e);
					this.setDialogMessage(e.message);
					this._statusLoadingComponent.loading = false;
					this.setFormEnabledState(true);
					return;
				}
			}));

			this._statusLoadingComponent = view.modelBuilder.loadingComponent().withProps({
				loadingText: constants.LOADING_MIGRATION_SERVICES,
				loading: false
			}).component();

			const creationStatusContainer = this.createServiceStatus();

			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: (await this.migrationServiceDropdownContainer())
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

			this._disposables.push(view.onClosed(e => {
				this._disposables.forEach(
					d => { try { d.dispose(); } catch { } });
			}));

			return view.initializeModel(form).then(() => {
				this.populateSubscriptions();
			});
		});

		this._testConnectionButton = azdata.window.createButton(constants.TEST_CONNECTION);
		this._testConnectionButton.hidden = true;
		this._disposables.push(this._testConnectionButton.onClick(async (e) => {
			this._refreshLoadingComponent.loading = true;
			this._connectionStatus.updateCssStyles({
				'display': 'none'
			});
			try {
				await this.refreshStatus();
			} catch (e) {
				vscode.window.showErrorMessage(e);
			}
			this._connectionStatus.updateCssStyles({
				'display': 'inline'
			});
			this._refreshLoadingComponent.loading = false;
		}));
		this._dialogObject.customButtons = [this._testConnectionButton];

		this._dialogObject.content = [tab];
		this._dialogObject.okButton.enabled = false;
		azdata.window.openDialog(this._dialogObject);
		this._disposables.push(this._dialogObject.cancelButton.onClick((e) => { }));
		this._disposables.push(this._dialogObject.okButton.onClick((e) => {
			this._doneButtonEvent.emit('done', this._createdMigrationService, this._selectedResourceGroup);
		}));

		this._isBlobContainerUsed = this._model._databaseBackup.networkContainerType === NetworkContainerType.BLOB_CONTAINER;

		return new Promise((resolve) => {
			this._doneButtonEvent.once('done', (createdDms: SqlMigrationService, selectedResourceGroup: string) => {
				azdata.window.closeDialog(this._dialogObject);
				resolve(
					{
						service: createdDms,
						resourceGroup: selectedResourceGroup
					});
			});
		});
	}

	private async migrationServiceDropdownContainer(): Promise<azdata.FlexContainer> {
		const dialogDescription = this._view.modelBuilder.text().withProps({
			value: constants.MIGRATION_SERVICE_DIALOG_DESCRIPTION,
			CSSStyles: {
				'font-size': '13px'
			}
		}).component();

		const subscriptionDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.SUBSCRIPTION,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold'
			}
		}).component();

		this.migrationServiceSubscription = this._view.modelBuilder.inputBox().withProps({
			required: true,
			enabled: false
		}).component();

		const resourceGroupDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.RESOURCE_GROUP,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold'
			}
		}).component();

		this.migrationServiceResourceGroupDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.RESOURCE_GROUP,
			required: true,
			editable: true,
			fireOnTextChange: true,
		}).component();

		const migrationServiceNameLabel = this._view.modelBuilder.text().withProps({
			value: constants.NAME,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold'
			}
		}).component();

		this._createResourceGroupLink = this._view.modelBuilder.hyperlink().withProps({
			label: constants.CREATE_NEW,
			url: ''
		}).component();

		this._disposables.push(this._createResourceGroupLink.onDidClick(async e => {
			const createResourceGroupDialog = new CreateResourceGroupDialog(this._model._azureAccount, this._model._targetSubscription, this._model._targetServerInstance.location);
			const createdResourceGroup = await createResourceGroupDialog.initialize();
			if (createdResourceGroup) {
				this.migrationServiceResourceGroupDropdown.loading = true;
				(<azdata.CategoryValue[]>this.migrationServiceResourceGroupDropdown.values).unshift({
					displayName: constants.NEW_RESOURCE_GROUP(createdResourceGroup.name),
					name: createdResourceGroup.name
				});
				this.migrationServiceResourceGroupDropdown.value = {
					displayName: createdResourceGroup.name,
					name: createdResourceGroup.name
				};
				this.migrationServiceResourceGroupDropdown.loading = false;
				this.migrationServiceResourceGroupDropdown.focus();
			}
		}));

		this.migrationServiceNameText = this._view.modelBuilder.inputBox().component();

		const locationDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.LOCATION,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold'
			}
		}).component();

		this.migrationServiceLocation = this._view.modelBuilder.inputBox().withProps({
			required: true,
			enabled: false,
			value: await this._model.getLocationDisplayName(this._model._targetServerInstance.location)
		}).component();

		const targetlabel = this._view.modelBuilder.text().withProps({
			value: constants.TARGET,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold'
			}
		}).component();

		const targetText = this._view.modelBuilder.inputBox().withProps({
			enabled: false,
			value: constants.AZURE_SQL
		}).component();

		const flexContainer = this._view.modelBuilder.flexContainer().withItems([
			dialogDescription,
			subscriptionDropdownLabel,
			this.migrationServiceSubscription,
			locationDropdownLabel,
			this.migrationServiceLocation,
			resourceGroupDropdownLabel,
			this.migrationServiceResourceGroupDropdown,
			this._createResourceGroupLink,
			migrationServiceNameLabel,
			this.migrationServiceNameText,
			targetlabel,
			targetText
		]).withLayout({
			flexFlow: 'column'
		}).component();
		return flexContainer;
	}

	private validateCreateServiceForm(subscription: azureResource.AzureResourceSubscription, resourceGroup: string | undefined, location: string | undefined, migrationServiceName: string | undefined): string {
		const errors: string[] = [];
		if (!subscription) {
			errors.push(constants.INVALID_SUBSCRIPTION_ERROR);
		}
		if (!resourceGroup) {
			errors.push(constants.INVALID_RESOURCE_GROUP_ERROR);
		}
		if (!location) {
			errors.push(constants.INVALID_REGION_ERROR);
		}
		if (!migrationServiceName || migrationServiceName.length < 3 || migrationServiceName.length > 63 || !/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(migrationServiceName)) {
			errors.push(constants.INVALID_SERVICE_NAME_ERROR);
		}
		return errors.join(os.EOL);
	}

	private async populateSubscriptions(): Promise<void> {
		this.migrationServiceResourceGroupDropdown.loading = true;
		this.migrationServiceSubscription.value = this._model._targetSubscription.name;
		await this.populateResourceGroups();
	}

	private async populateResourceGroups(): Promise<void> {
		this.migrationServiceResourceGroupDropdown.loading = true;
		try {
			this.migrationServiceResourceGroupDropdown.values = (await this._model.getAzureResourceGroupDropdownValues(this._model._targetSubscription)).map(v => {
				return {
					name: v.displayName,
					displayName: v.displayName
				};
			});
			const selectedResourceGroupValue = this.migrationServiceResourceGroupDropdown.values.find(v => v.name.toLowerCase() === this._resourceGroupPreset.toLowerCase());
			this.migrationServiceResourceGroupDropdown.value = (selectedResourceGroupValue) ? selectedResourceGroupValue : this.migrationServiceResourceGroupDropdown.values[0];
		} finally {
			this.migrationServiceResourceGroupDropdown.loading = false;
		}
	}

	private createServiceStatus(): azdata.FlexContainer {

		const setupIRHeadingText = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_CONTAINER_HEADING,
			CSSStyles: {
				'font-weight': 'bold',
				'font-size': '13px'
			}
		}).component();

		const setupIRdescription1 = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_CONTAINER_DESCRIPTION1,
			CSSStyles: {
				'font-size': '13px'
			}
		}).component();

		const setupIRdescription2 = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_CONTAINER_DESCRIPTION2,
			CSSStyles: {
				'font-size': '13px'
			}
		}).component();

		const irSetupStep1Text = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_STEP1,
			CSSStyles: {
				'font-size': '13px'
			},
			links: [
				{
					text: constants.SERVICE_STEP1_LINK,
					url: 'https://www.microsoft.com/download/details.aspx?id=39717'
				}
			]
		}).component();

		const irSetupStep2Text = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_STEP2,
			CSSStyles: {
				'font-size': '13px'
			}
		}).component();

		const irSetupStep3Text = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_STEP3,
			CSSStyles: {
				'margin-top': '10px',
				'margin-bottom': '10px',
				'font-size': '13px'
			}
		}).component();

		this._connectionStatus = this._view.modelBuilder.infoBox().withProps({
			text: '',
			style: 'error',
			CSSStyles: {
				'font-size': '13px'
			}
		}).component();

		this._connectionStatus.CSSStyles = {
			'width': '350px'
		};

		this._refreshLoadingComponent = this._view.modelBuilder.loadingComponent().withProps({
			loading: false,
			CSSStyles: {
				'font-size': '13px'
			}
		}).component();


		this.migrationServiceAuthKeyTable = this._view.modelBuilder.declarativeTable().withProps({
			ariaLabel: constants.DATABASE_MIGRATION_SERVICE_AUTHENTICATION_KEYS,
			columns: [
				{
					displayName: constants.NAME,
					valueType: azdata.DeclarativeDataType.string,
					width: '50px',
					isReadOnly: true,
					rowCssStyles: {
						'font-size': '13px'
					},
					headerCssStyles: {
						'font-size': '13px'
					}
				},
				{
					displayName: constants.AUTH_KEY_COLUMN_HEADER,
					valueType: azdata.DeclarativeDataType.string,
					width: '500px',
					isReadOnly: true,
					rowCssStyles: {
						'font-size': '13px'
					},
					headerCssStyles: {
						'font-size': '13px'
					}
				},
				{
					displayName: '',
					valueType: azdata.DeclarativeDataType.component,
					width: '30px',
					isReadOnly: true,
					rowCssStyles: {
						'font-size': '13px'
					},
					headerCssStyles: {
						'font-size': '13px'
					}
				}
			],
			CSSStyles: {
				'margin-top': '5px'
			}
		}).component();

		this._setupContainer = this._view.modelBuilder.flexContainer().withItems(
			[
				setupIRHeadingText,
				setupIRdescription1,
				setupIRdescription2,
				irSetupStep1Text,
				irSetupStep2Text,
				this.migrationServiceAuthKeyTable,
				irSetupStep3Text,
				this._connectionStatus,
				this._refreshLoadingComponent
			], {
			CSSStyles: {
				'margin-bottom': '5px'
			}
		}
		).withLayout({
			flexFlow: 'column'
		}).component();

		this._setupContainer.display = 'none';
		this._testConnectionButton.hidden = true;
		return this._setupContainer;
	}

	private async refreshStatus(): Promise<void> {
		const subscription = this._model._targetSubscription;
		const resourceGroup = (this.migrationServiceResourceGroupDropdown.value as azdata.CategoryValue).name;
		const location = this._model._targetServerInstance.location;

		const maxRetries = 5;
		let migrationServiceStatus!: SqlMigrationService;
		for (let i = 0; i < maxRetries; i++) {
			try {
				clearDialogMessage(this._dialogObject);
				migrationServiceStatus = await getSqlMigrationService(this._model._azureAccount, subscription, resourceGroup, location, this._createdMigrationService.name, this._model._sessionId);
				break;
			} catch (e) {
				this._dialogObject.message = {
					text: constants.SERVICE_STATUS_REFRESH_ERROR,
					description: e.message,
					level: azdata.window.MessageLevel.Error
				};
				console.log(e);
			}
			await new Promise(r => setTimeout(r, 5000));
		}
		const migrationServiceMonitoringStatus = await getSqlMigrationServiceMonitoringData(this._model._azureAccount, subscription, resourceGroup, location, this._createdMigrationService!.name, this._model._sessionId);
		this.irNodes = migrationServiceMonitoringStatus.nodes.map((node) => {
			return node.nodeName;
		});
		if (migrationServiceStatus) {
			const state = migrationServiceStatus.properties.integrationRuntimeState;

			if (state === 'Online') {
				this._connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
					text: constants.SERVICE_READY(this._createdMigrationService!.name, this.irNodes.join(', ')),
					style: 'success',
					CSSStyles: {
						'font-size': '13px'
					}
				});
				this._dialogObject.okButton.enabled = true;
			} else {
				this._connectionStatus.text = constants.SERVICE_NOT_READY(this._createdMigrationService!.name);
				this._connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
					text: constants.SERVICE_NOT_READY(this._createdMigrationService!.name),
					style: 'warning',
					CSSStyles: {
						'font-size': '13px'
					}
				});
				this._dialogObject.okButton.enabled = false;
			}
		}

	}
	private async refreshAuthTable(): Promise<void> {
		const subscription = this._model._targetSubscription;
		const resourceGroup = (this.migrationServiceResourceGroupDropdown.value as azdata.CategoryValue).name;
		const location = this._model._targetServerInstance.location;
		const keys = await getSqlMigrationServiceAuthKeys(this._model._azureAccount, subscription, resourceGroup, location, this._createdMigrationService!.name, this._model._sessionId);

		this._copyKey1Button = this._view.modelBuilder.button().withProps({
			title: constants.COPY_KEY1,
			iconPath: IconPathHelper.copy,
			ariaLabel: constants.COPY_KEY1,
		}).component();

		this._disposables.push(this._copyKey1Button.onDidClick((e) => {
			vscode.env.clipboard.writeText(<string>this.migrationServiceAuthKeyTable.dataValues![0][1].value);
			vscode.window.showInformationMessage(constants.SERVICE_KEY1_COPIED_HELP);
		}));

		this._copyKey2Button = this._view.modelBuilder.button().withProps({
			title: constants.COPY_KEY2,
			iconPath: IconPathHelper.copy,
			ariaLabel: constants.COPY_KEY2,
		}).component();

		this._disposables.push(this._copyKey2Button.onDidClick((e) => {
			vscode.env.clipboard.writeText(<string>this.migrationServiceAuthKeyTable.dataValues![1][1].value);
			vscode.window.showInformationMessage(constants.SERVICE_KEY2_COPIED_HELP);
		}));

		this._refreshKey1Button = this._view.modelBuilder.button().withProps({
			title: constants.REFRESH_KEY1,
			iconPath: IconPathHelper.refresh,
			ariaLabel: constants.REFRESH_KEY1,
		}).component();

		this._disposables.push(this._refreshKey1Button.onDidClick((e) => {
			//TODO: add refresh logic
		}));

		this._refreshKey2Button = this._view.modelBuilder.button().withProps({
			title: constants.REFRESH_KEY2,
			iconPath: IconPathHelper.refresh,
			ariaLabel: constants.REFRESH_KEY2,
		}).component();

		this._disposables.push(this._refreshKey2Button.onDidClick((e) => {
			//TODO: add refresh logic
		}));

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
						value: this._view.modelBuilder.flexContainer().withItems([this._copyKey1Button, this._refreshKey1Button]).component()
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
						value: this._view.modelBuilder.flexContainer().withItems([this._copyKey2Button, this._refreshKey2Button]).component()
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

	private setFormEnabledState(enable: boolean): void {
		this._formSubmitButton.enabled = enable;
		this.migrationServiceResourceGroupDropdown.enabled = enable;
		this.migrationServiceNameText.enabled = enable;
		this._createResourceGroupLink.enabled = enable;
	}
}

export interface CreateSqlMigrationServiceDialogResult {
	service: SqlMigrationService,
	resourceGroup: string
}
