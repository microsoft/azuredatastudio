/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { createSqlMigrationService, getResourceName, getSqlMigrationService, getSqlMigrationServiceMonitoringData, SqlMigrationService } from '../../api/azure';
import { MigrationStateModel } from '../../models/stateMachine';
import { logError, TelemetryViews } from '../../telemetry';
import * as constants from '../../constants/strings';
import * as os from 'os';
import { azureResource } from 'azurecore';
import { CreateResourceGroupDialog } from '../createResourceGroup/createResourceGroupDialog';
import * as EventEmitter from 'events';
import * as utils from '../../api/utils';
import * as styles from '../../constants/styles';
import { ConfigureIRDialog } from '../configureIR/configureIRDialog';

export class CreateSqlMigrationServiceDialog {

	private _model!: MigrationStateModel;

	private migrationServiceSubscription!: azdata.TextComponent;
	private migrationServiceResourceGroupDropdown!: azdata.DropDownComponent;
	private migrationServiceLocation!: azdata.TextComponent;
	private migrationServiceNameText!: azdata.InputBoxComponent;
	private _formSubmitButton!: azdata.ButtonComponent;
	private _createResourceGroupLink!: azdata.HyperlinkComponent;

	private _statusLoadingComponent!: azdata.LoadingComponent;
	private _connectionStatus!: azdata.InfoBoxComponent;
	private _setupContainer!: azdata.FlexContainer;
	private _resourceGroupPreset!: string;

	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;

	private _createdMigrationService!: SqlMigrationService;
	private _resourceGroups!: azureResource.AzureResourceResourceGroup[];
	private _selectedResourceGroup!: azureResource.AzureResourceResourceGroup;

	private _doneButtonEvent: EventEmitter = new EventEmitter();
	private _isBlobContainerUsed: boolean = false;

	private irNodes: string[] = [];
	private _disposables: vscode.Disposable[] = [];

	public async createNewDms(migrationStateModel: MigrationStateModel, resourceGroupPreset: string): Promise<CreateSqlMigrationServiceDialogResult> {
		this._model = migrationStateModel;
		this._resourceGroupPreset = resourceGroupPreset;
		this._dialogObject = azdata.window.createModelViewDialog(constants.CREATE_MIGRATION_SERVICE_TITLE, 'MigrationServiceDialog', 'medium');
		this._dialogObject.okButton.position = 'left';
		this._dialogObject.cancelButton.position = 'left';

		const tab = azdata.window.createTab('');
		this._dialogObject.registerCloseValidator(async () => {
			return true;
		});
		tab.registerContent(async (view: azdata.ModelView) => {
			this._view = view;

			this._formSubmitButton = view.modelBuilder.button().withProps({
				label: constants.CREATE,
				width: '80px'
			}).component();

			this._disposables.push(
				this._formSubmitButton.onDidClick(async (e) => {
					utils.clearDialogMessage(this._dialogObject);

					this._statusLoadingComponent.loading = true;
					this.migrationServiceResourceGroupDropdown.loading = false;
					this.setFormEnabledState(false);

					const subscription = this._model._sqlMigrationServiceSubscription;
					const resourceGroup = this._selectedResourceGroup;
					const location = this._model._location.name;
					const serviceName = this.migrationServiceNameText.value;

					const formValidationErrors = this.validateCreateServiceForm(subscription, resourceGroup.name, location, serviceName);

					try {
						if (formValidationErrors.length > 0) {
							this.setDialogMessage(formValidationErrors);
							this.setFormEnabledState(true);
							return;
						}

						utils.clearDialogMessage(this._dialogObject);
						this._createdMigrationService = await createSqlMigrationService(
							this._model._azureAccount,
							subscription,
							resourceGroup.name,
							location,
							serviceName!,
							this._model._sessionId);

						if (this._createdMigrationService.error) {
							this.setDialogMessage(`${this._createdMigrationService.error.code} : ${this._createdMigrationService.error.message}`);
							this.setFormEnabledState(true);
							return;
						}

						if (this._isBlobContainerUsed && !this._model.isSqlDbTarget) {
							this._dialogObject.okButton.enabled = true;
							this._setupContainer.display = 'none';
							this._dialogObject.message = {
								text: constants.DATA_MIGRATION_SERVICE_CREATED_SUCCESSFULLY,
								level: azdata.window.MessageLevel.Information
							};
						} else {
							await this.refreshStatus();
							this._setupContainer.display = 'inline';
						}
					} catch (e) {
						console.log(e);
						this.setDialogMessage(e.message);
						this.setFormEnabledState(true);
					} finally {
						this._statusLoadingComponent.loading = false;
					}
				}));

			this._statusLoadingComponent = view.modelBuilder.loadingComponent().withProps({
				loadingText: constants.LOADING_MIGRATION_SERVICES,
				loading: false
			}).component();

			// const creationStatusContainer1 = this.createServiceStatus();
			const creationStatusContainer = await this.constructIRConfig(view);

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

			return view.initializeModel(form).then(async () => {
				await this.populateSubscriptions();
			});
		});

		this._dialogObject.content = [tab];
		this._dialogObject.okButton.enabled = false;
		azdata.window.openDialog(this._dialogObject);
		this._disposables.push(this._dialogObject.cancelButton.onClick((e) => { }));
		this._disposables.push(this._dialogObject.okButton.onClick((e) => {
			this._doneButtonEvent.emit('done', this._createdMigrationService, this._selectedResourceGroup);
		}));

		this._isBlobContainerUsed = this._model.isBackupContainerBlobContainer;

		return new Promise((resolve) => {
			this._doneButtonEvent.once('done', (createdDms: SqlMigrationService, selectedResourceGroup: azureResource.AzureResourceResourceGroup) => {
				azdata.window.closeDialog(this._dialogObject);
				resolve(
					{
						service: createdDms,
						resourceGroup: selectedResourceGroup
					});
			});
		});
	}

	private async constructIRConfig(view: azdata.ModelView) {
		const configureIR = new ConfigureIRDialog(this._model);

		this._connectionStatus = this._view.modelBuilder.infoBox().withProps({
			text: '',
			style: 'error',
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		this._connectionStatus.CSSStyles = {
			'width': '350px'
		};

		const irConfig = await configureIR.constructIRConfig(view);
		this._setupContainer = this._view.modelBuilder.flexContainer()
			.withItems([this._connectionStatus, irConfig])
			.component();

		this._setupContainer.display = 'none';
		return this._setupContainer;
	}

	private async migrationServiceDropdownContainer(): Promise<azdata.FlexContainer> {
		const dialogDescription = this._view.modelBuilder.text().withProps({
			value: constants.MIGRATION_SERVICE_DIALOG_DESCRIPTION(!this._model.isSqlDbTarget),
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		const subscriptionDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.SUBSCRIPTION,
			description: constants.MIGRATION_SERVICE_SUBSCRIPTION_INFO,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();

		this.migrationServiceSubscription = this._view.modelBuilder.text().withProps({
			enabled: false,
			CSSStyles: {
				'margin': '-1em 0 0'
			}
		}).component();

		const resourceGroupDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.RESOURCE_GROUP,
			description: constants.MIGRATION_SERVICE_RESOURCE_GROUP_INFO,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();

		this.migrationServiceResourceGroupDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.RESOURCE_GROUP,
			required: true,
			editable: true,
			fireOnTextChange: true,
			CSSStyles: {
				'margin-top': '-1em'
			}
		}).component();

		this._disposables.push(
			this.migrationServiceResourceGroupDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined') {
					const selectedResourceGroup = this._resourceGroups.find(rg => rg.name === value || constants.NEW_RESOURCE_GROUP(rg.name) === value);
					this._selectedResourceGroup = (selectedResourceGroup)
						? selectedResourceGroup
						: undefined!;
				}
			}));

		const migrationServiceNameLabel = this._view.modelBuilder.text().withProps({
			value: constants.NAME,
			description: constants.MIGRATION_SERVICE_NAME_INFO,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();

		this._createResourceGroupLink = this._view.modelBuilder.hyperlink().withProps({
			label: constants.CREATE_NEW,
			ariaLabel: constants.CREATE_NEW_RESOURCE_GROUP,
			url: '',
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		this._disposables.push(this._createResourceGroupLink.onDidClick(async e => {
			const createResourceGroupDialog = new CreateResourceGroupDialog(
				this._model._azureAccount,
				this._model._sqlMigrationServiceSubscription,
				this._model._location.name);

			const createdResourceGroup = await createResourceGroupDialog.initialize();
			if (createdResourceGroup) {
				this._resourceGroups.push(createdResourceGroup);
				this._selectedResourceGroup = createdResourceGroup;
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
				await this.migrationServiceResourceGroupDropdown.focus();
			}
		}));

		this.migrationServiceNameText = this._view.modelBuilder.inputBox().withProps({
			ariaLabel: constants.NAME,
			CSSStyles: {
				'margin-top': '-1em'
			}
		}).component();

		const locationDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.LOCATION,
			description: constants.MIGRATION_SERVICE_LOCATION_INFO,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();

		this.migrationServiceLocation = this._view.modelBuilder.text().withProps({
			enabled: false,
			value: this._model._location.displayName,
			CSSStyles: {
				'margin': '-1em 0 0'
			}
		}).component();

		const targetLabel = this._view.modelBuilder.text().withProps({
			value: constants.TARGET,
			description: constants.MIGRATION_SERVICE_TARGET_INFO,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();

		const targetText = this._view.modelBuilder.text().withProps({
			enabled: false,
			value: constants.AZURE_SQL,
			CSSStyles: {
				'margin-top': '-1em',
				// 'font-size': '13px',
				// 'margin': '0px'
			}
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
			targetLabel,
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
			errors.push(constants.INVALID_LOCATION_ERROR);
		}
		if (!migrationServiceName || migrationServiceName.length < 3 || migrationServiceName.length > 63 || !/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(migrationServiceName)) {
			errors.push(constants.INVALID_SERVICE_NAME_ERROR);
		}
		return errors.join(os.EOL);
	}

	private async populateSubscriptions(): Promise<void> {
		this.migrationServiceResourceGroupDropdown.loading = true;
		this.migrationServiceSubscription.value = this._model._sqlMigrationServiceSubscription.name;
		await this.populateResourceGroups();
	}

	private async populateResourceGroups(): Promise<void> {
		this.migrationServiceResourceGroupDropdown.loading = true;
		try {
			this._resourceGroups = await utils.getAllResourceGroups(
				this._model._azureAccount,
				this._model._sqlMigrationServiceSubscription);
			this.migrationServiceResourceGroupDropdown.values = utils.getResourceDropdownValues(
				this._resourceGroups,
				constants.RESOURCE_GROUP_NOT_FOUND);

			const selectedResourceGroupValue = this.migrationServiceResourceGroupDropdown.values.find(v => v.name.toLowerCase() === this._resourceGroupPreset.toLowerCase());
			this.migrationServiceResourceGroupDropdown.value = (selectedResourceGroupValue)
				? selectedResourceGroupValue
				: this.migrationServiceResourceGroupDropdown.values?.length > 0
					? this.migrationServiceResourceGroupDropdown.values[0]
					: '';
		} finally {
			this.migrationServiceResourceGroupDropdown.loading = false;
		}
	}

	private async refreshStatus(): Promise<void> {
		const subscription = this._model._sqlMigrationServiceSubscription;
		const resourceGroupId = (this.migrationServiceResourceGroupDropdown.value as azdata.CategoryValue).name;
		const resourceGroup = getResourceName(resourceGroupId);
		const location = this._model._location.name;

		const maxRetries = 5;
		let migrationServiceStatus!: SqlMigrationService;
		for (let i = 0; i < maxRetries; i++) {
			try {
				utils.clearDialogMessage(this._dialogObject);
				migrationServiceStatus = await getSqlMigrationService(
					this._model._azureAccount,
					subscription,
					resourceGroup,
					location,
					this._createdMigrationService.name);
				break;
			} catch (e) {
				this._dialogObject.message = {
					text: constants.SERVICE_STATUS_REFRESH_ERROR,
					description: e.message,
					level: azdata.window.MessageLevel.Error
				};
				logError(TelemetryViews.CreateDataMigrationServiceDialog, 'FetchSqlMigrationServiceFailed', e);
			}
			await new Promise(r => setTimeout(r, 5000));
		}
		const migrationServiceMonitoringStatus = await getSqlMigrationServiceMonitoringData(
			this._model._azureAccount,
			subscription,
			resourceGroup,
			location,
			this._createdMigrationService!.name);

		this.irNodes = migrationServiceMonitoringStatus.nodes.map((node) => {
			return node.nodeName;
		});
		if (migrationServiceStatus) {
			const state = migrationServiceStatus.properties.integrationRuntimeState;

			if (state === 'Online') {
				await this._connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
					text: constants.SERVICE_READY(this._createdMigrationService!.name, this.irNodes.join(', '), false),
					style: 'success',
					CSSStyles: {
						...styles.BODY_CSS
					}
				});
			} else {
				this._connectionStatus.text = constants.SERVICE_NOT_READY(this._createdMigrationService!.name, false);
				await this._connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
					text: constants.SERVICE_NOT_READY(this._createdMigrationService!.name, false),
					style: 'warning',
					CSSStyles: {
						...styles.BODY_CSS
					}
				});
			}
			this._dialogObject.okButton.enabled = true;
		}
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
	resourceGroup: azureResource.AzureResourceResourceGroup
}
