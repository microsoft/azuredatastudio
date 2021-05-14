/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { EOL } from 'os';
import { getStorageAccountAccessKeys } from '../api/azure';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, MigrationTargetType, NetworkContainerType, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import * as vscode from 'vscode';
import { IconPathHelper } from '../constants/iconPathHelper';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
export class DatabaseBackupPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;

	private _networkShareContainer!: azdata.FlexContainer;
	private _windowsUserAccountText!: azdata.InputBoxComponent;
	private _passwordText!: azdata.InputBoxComponent;
	private _networkSharePath!: azdata.InputBoxComponent;

	private _blobContainer!: azdata.FlexContainer;
	private _blobContainerSubscription!: azdata.InputBoxComponent;
	private _blobContainerLocation!: azdata.InputBoxComponent;
	private _blobContainerResourceGroup!: azdata.DropDownComponent;
	private _blobContainerStorageAccountDropdown!: azdata.DropDownComponent;
	private _blobContainerDropdown!: azdata.DropDownComponent;

	private _fileShareContainer!: azdata.FlexContainer;
	private _fileShareSubscription!: azdata.InputBoxComponent;
	private _fileShareStorageAccountDropdown!: azdata.DropDownComponent;

	private _networkShareStorageAccountDetails!: azdata.FlexContainer;
	private _networkShareContainerSubscription!: azdata.InputBoxComponent;
	private _networkShareContainerLocation!: azdata.InputBoxComponent;
	private _networkShareStorageAccountResourceGroupDropdown!: azdata.DropDownComponent;
	private _networkShareContainerStorageAccountDropdown!: azdata.DropDownComponent;
	private _networkShareContainerStorageAccountRefreshButton!: azdata.ButtonComponent;

	private _targetDatabaseContainer!: azdata.FlexContainer;
	private _targetDatabaseNamesTable!: azdata.DeclarativeTableComponent;
	private _targetDatabaseNames: azdata.InputBoxComponent[] = [];


	private _existingDatabases: string[] = [];

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.DATABASE_BACKUP_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;

		const radioButtonContainer = this.createBackupLocationComponent();

		const networkDetailsContainer = this.createNetworkDetailsContainer();

		this._targetDatabaseContainer = this.createTargetDatabaseContainer();

		this._networkShareStorageAccountDetails = this.createNetworkShareStorageAccountDetailsContainer();

		const form = this._view.modelBuilder.formContainer()
			.withFormItems(
				[
					{
						title: '',
						component: radioButtonContainer
					},
					{
						title: '',
						component: networkDetailsContainer
					},
					{
						title: '',
						component: this._targetDatabaseContainer
					},
					{
						title: '',
						component: this._networkShareStorageAccountDetails
					}
				]
			);
		await view.initializeModel(form.component());


	}

	private createBackupLocationComponent(): azdata.FlexContainer {
		const buttonGroup = 'networkContainer';

		const selectLocationText = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_PAGE_DESCRIPTION,
			CSSStyles: {
				'font-size': '13px'
			}
		}).component();

		const networkShareButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.DATABASE_BACKUP_NC_NETWORK_SHARE_RADIO_LABEL,
				CSSStyles: {
					'font-size': '13px'
				}
			}).component();

		networkShareButton.onDidChangeCheckedState((e) => {
			if (e) {
				this.toggleNetworkContainerFields(NetworkContainerType.NETWORK_SHARE);
			}
		});

		const blobContainerButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.DATABASE_BACKUP_NC_BLOB_STORAGE_RADIO_LABEL,
				enabled: false,
				CSSStyles: {
					'font-size': '13px'
				}
			}).component();

		blobContainerButton.onDidChangeCheckedState((e) => {
			if (e) {
				this.toggleNetworkContainerFields(NetworkContainerType.BLOB_CONTAINER);
			}
		});

		const fileShareButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.DATABASE_BACKUP_NC_FILE_SHARE_RADIO_LABEL,
				enabled: false,
				CSSStyles: {
					'font-size': '13px'
				}
			}).component();

		fileShareButton.onDidChangeCheckedState((e) => {
			if (e) {
				vscode.window.showInformationMessage('Feature coming soon');
				networkShareButton.checked = true;
				//this.toggleNetworkContainerFields(NetworkContainerType.FILE_SHARE);
			}
		});

		const flexContainer = this._view.modelBuilder.flexContainer().withItems(
			[
				selectLocationText,
				networkShareButton,
				blobContainerButton,
				fileShareButton
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return flexContainer;
	}

	private createNetworkDetailsContainer(): azdata.FlexContainer {
		this._networkShareContainer = this.createNetworkShareContainer();
		this._blobContainer = this.createBlobContainer();
		this._fileShareContainer = this.createFileShareContainer();

		const networkContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withItems([
			this._networkShareContainer,
			this._blobContainer,
			this._fileShareContainer
		]).component();
		return networkContainer;
	}

	private createNetworkShareContainer(): azdata.FlexContainer {
		const networkShareHeading = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_HEADER_TEXT,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'font-size': '14px',
				'font-weight': 'bold'
			}
		}).component();

		const networkShareHelpText = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NC_NETWORK_SHARE_HELP_TEXT,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'font-size': '13px',
			}
		}).component();

		const networkLocationInputBoxLabel = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_LOCATION_LABEL,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold'
			}
		}).component();
		this._networkSharePath = this._view.modelBuilder.inputBox().withProps({
			placeHolder: '\\\\Servername.domainname.com\\Backupfolder',
			validationErrorMessage: constants.INVALID_NETWORK_SHARE_LOCATION,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold'
			}
		}).withValidation((component) => {
			if (this.migrationStateModel._databaseBackup.networkContainerType === NetworkContainerType.NETWORK_SHARE) {
				if (component.value) {
					if (!/^[\\\/]{2,}[^\\\/]+[\\\/]+[^\\\/]+/.test(component.value)) {
						return false;
					}
				}
			}
			return true;
		}).component();
		this._networkSharePath.onTextChanged((value) => {
			this.validateFields();
			this.migrationStateModel._databaseBackup.networkShare.networkShareLocation = value;
		});

		const networkShareInfoBox = this._view.modelBuilder.infoBox().withProps({
			text: constants.DATABASE_SERVICE_ACCOUNT_INFO_TEXT,
			style: 'information',
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'font-size': '13px',
				'margin-top': '10px'
			}
		}).component();

		const windowsUserAccountLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_WINDOWS_USER_LABEL,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': 'bold'
				}
			}).component();
		this._windowsUserAccountText = this._view.modelBuilder.inputBox()
			.withProps({
				placeHolder: 'Domain\\username',
				required: true,
				validationErrorMessage: constants.INVALID_USER_ACCOUNT,
				width: WIZARD_INPUT_COMPONENT_WIDTH
			})
			.withValidation((component) => {
				if (this.migrationStateModel._databaseBackup.networkContainerType === NetworkContainerType.NETWORK_SHARE) {
					if (component.value) {
						if (!/^[A-Za-z0-9\\\._-]{7,}$/.test(component.value)) {
							return false;
						}
					}
				}
				return true;
			}).component();
		this._windowsUserAccountText.onTextChanged((value) => {
			this.migrationStateModel._databaseBackup.networkShare.windowsUser = value;
		});

		const passwordLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_LABEL,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': 'bold'
				}
			}).component();
		this._passwordText = this._view.modelBuilder.inputBox()
			.withProps({
				placeHolder: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_PLACEHOLDER,
				inputType: 'password',
				required: true,
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();
		this._passwordText.onTextChanged((value) => {
			this.migrationStateModel._databaseBackup.networkShare.password = value;
		});

		const flexContainer = this._view.modelBuilder.flexContainer().withItems(
			[
				networkShareHeading,
				networkShareHelpText,
				networkLocationInputBoxLabel,
				this._networkSharePath,
				networkShareInfoBox,
				windowsUserAccountLabel,
				this._windowsUserAccountText,
				passwordLabel,
				this._passwordText,
			]
		).withLayout({
			flexFlow: 'column'
		}).withProps({
			display: 'none'
		}).component();

		return flexContainer;
	}

	private createFileShareContainer(): azdata.FlexContainer {

		const subscriptionLabel = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_FILE_SHARE_SUBSCRIPTION_LABEL,
			requiredIndicator: true,
		}).component();
		this._fileShareSubscription = this._view.modelBuilder.inputBox().withProps({
			enabled: false
		}).component();

		const storageAccountLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_FILE_SHARE_STORAGE_ACCOUNT_LABEL,
			}).component();
		this._fileShareStorageAccountDropdown = this._view.modelBuilder.dropDown().component();

		const flexContainer = this._view.modelBuilder.flexContainer()
			.withItems(
				[
					subscriptionLabel,
					this._fileShareSubscription,
					storageAccountLabel,
					this._fileShareStorageAccountDropdown
				]
			).withLayout({
				flexFlow: 'column'
			}).withProps({
				display: 'none'
			}).component();

		return flexContainer;
	}

	private createBlobContainer(): azdata.FlexContainer {

		const subscriptionLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_BLOB_STORAGE_SUBSCRIPTION_LABEL,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': 'bold'
				}
			}).component();
		this._blobContainerSubscription = this._view.modelBuilder.inputBox()
			.withProps({
				enabled: false
			}).component();

		const locationLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.LOCATION,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': 'bold'
				}
			}).component();
		this._blobContainerLocation = this._view.modelBuilder.inputBox()
			.withProps({
				enabled: false
			}).component();

		const resourceGroupLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.RESOURCE_GROUP,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': 'bold'
				}
			}).component();
		this._blobContainerResourceGroup = this._view.modelBuilder.dropDown().withProps({
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();
		this._blobContainerResourceGroup.onValueChanged(e => {
			if (e.selected && e.selected !== constants.RESOURCE_GROUP_NOT_FOUND) {
				this.migrationStateModel._databaseBackup.blob.resourceGroup = this.migrationStateModel.getAzureResourceGroup(e.index);
			}
			this.loadblobStorageDropdown();
		});

		const storageAccountLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.STORAGE_ACCOUNT,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': 'bold'
				}
			}).component();
		this._blobContainerStorageAccountDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();
		this._blobContainerStorageAccountDropdown.onValueChanged(async (value) => {
			if (value.selected && value.selected !== constants.NO_STORAGE_ACCOUNT_FOUND) {
				this.migrationStateModel._databaseBackup.blob.storageAccount = this.migrationStateModel.getStorageAccount(value.index);
			}
			await this.loadBlobContainerDropdown();
		});


		const blobContainerLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.BLOB_CONTAINER,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': 'bold'
				}
			}).component();
		this._blobContainerDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();
		this._blobContainerDropdown.onValueChanged(async (value) => {
			if (value.selected && value.selected !== constants.NO_BLOBCONTAINERS_FOUND) {
				this.migrationStateModel._databaseBackup.blob.blobContainer = this.migrationStateModel.getBlobContainer(value.index);
			}
		});



		const flexContainer = this._view.modelBuilder.flexContainer()
			.withItems(
				[
					subscriptionLabel,
					this._blobContainerSubscription,
					locationLabel,
					this._blobContainerLocation,
					resourceGroupLabel,
					this._blobContainerResourceGroup,
					storageAccountLabel,
					this._blobContainerStorageAccountDropdown,
					blobContainerLabel,
					this._blobContainerDropdown,
				]
			).withLayout({
				flexFlow: 'column'
			}).withProps({
				display: 'none'
			}).component();

		return flexContainer;
	}


	private createTargetDatabaseContainer(): azdata.FlexContainer {
		const rowCssStyle: azdata.CssStyles = {
			'border': 'none',
			'font-size': '13px',
			'border-bottom': '1px solid',
		};

		const headerCssStyles: azdata.CssStyles = {
			'border': 'none',
			'font-size': '13px',
			'font-weight': 'bold',
			'text-align': 'left',
			'border-bottom': '1px solid',
		};

		this._targetDatabaseNamesTable = this._view.modelBuilder.declarativeTable().withProps({
			columns: [
				{
					displayName: constants.SOURCE_DATABASE,
					valueType: azdata.DeclarativeDataType.string,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles,
					isReadOnly: true,
					width: '250px'
				},
				{
					displayName: constants.TARGET_DATABASE_NAME,
					valueType: azdata.DeclarativeDataType.component,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles,
					isReadOnly: true,
					width: '300px'
				}
			]
		}).component();

		const container = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withItems([
			this._targetDatabaseNamesTable
		]).withProps({
			display: 'none'
		}).component();
		return container;
	}

	private createNetworkShareStorageAccountDetailsContainer(): azdata.FlexContainer {
		const azureAccountHeader = this._view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_AZURE_ACCOUNT_HEADER,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					'font-size': '14px',
					'font-weight': 'bold'
				}
			}).component();

		const azureAccountHelpText = this._view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_AZURE_ACCOUNT_HELP,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					'font-size': '13px',
				}
			}).component();

		const subscriptionLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.SUBSCRIPTION,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': 'bold'
				}
			}).component();
		this._networkShareContainerSubscription = this._view.modelBuilder.inputBox()
			.withProps({
				required: true,
				enabled: false,
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();

		const locationLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.LOCATION,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': 'bold'
				}
			}).component();
		this._networkShareContainerLocation = this._view.modelBuilder.inputBox()
			.withProps({
				required: true,
				enabled: false,
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();

		const resourceGroupLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.RESOURCE_GROUP,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': 'bold'
				}
			}).component();
		this._networkShareStorageAccountResourceGroupDropdown = this._view.modelBuilder.dropDown().withProps({
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();
		this._networkShareStorageAccountResourceGroupDropdown.onValueChanged(e => {
			if (e.selected) {
				this.migrationStateModel._databaseBackup.networkShare.resourceGroup = this.migrationStateModel.getAzureResourceGroup(e.index);
				this.loadNetworkShareStorageDropdown();
			}
		});

		const storageAccountLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.STORAGE_ACCOUNT,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': 'bold'
				}
			}).component();
		this._networkShareContainerStorageAccountDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				required: true,
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();
		this._networkShareContainerStorageAccountDropdown.onValueChanged((value) => {
			if (value.selected) {
				this.migrationStateModel._databaseBackup.networkShare.storageAccount = this.migrationStateModel.getStorageAccount(value.index);
			}
		});

		this._networkShareContainerStorageAccountRefreshButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh,
			iconHeight: 18,
			iconWidth: 18,
			height: 25
		}).component();

		this._networkShareContainerStorageAccountRefreshButton.onDidClick((e) => {
			this.loadNetworkShareStorageDropdown();
		});

		const storageAccountContainer = this._view.modelBuilder.flexContainer().component();

		storageAccountContainer.addItem(this._networkShareContainerStorageAccountDropdown, {
			flex: '0 0 auto'
		});

		storageAccountContainer.addItem(this._networkShareContainerStorageAccountRefreshButton, {
			flex: '0 0 auto',
			CSSStyles: {
				'margin-left': '5px'
			}
		});

		const container = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).withItems([
			azureAccountHeader,
			azureAccountHelpText,
			subscriptionLabel,
			this._networkShareContainerSubscription,
			locationLabel,
			this._networkShareContainerLocation,
			resourceGroupLabel,
			this._networkShareStorageAccountResourceGroupDropdown,
			storageAccountLabel,
			storageAccountContainer,
		]).withProps({
			display: 'none'
		}).component();

		return container;
	}


	public async onPageEnter(): Promise<void> {
		if (this.migrationStateModel.refreshDatabaseBackupPage) {
			this._targetDatabaseNames = [];
			if (this.migrationStateModel._targetType === MigrationTargetType.SQLMI) {
				this._existingDatabases = await this.migrationStateModel.getManagedDatabases();
			}
			this.migrationStateModel._targetDatabaseNames = [];

			const tableRows: azdata.DeclarativeTableCellValue[][] = [];
			this.migrationStateModel._migrationDbs.forEach((db, index) => {
				const targetRow: azdata.DeclarativeTableCellValue[] = [];
				this.migrationStateModel._targetDatabaseNames.push('');
				const targetDatabaseInput = this._view.modelBuilder.inputBox().withProps({
					required: true,
					value: db,
					width: '280px'
				}).withValidation(c => {
					if (this._targetDatabaseNames.filter(t => t.value === c.value).length > 1) { //Making sure no databases have duplicate values.
						c.validationErrorMessage = constants.DUPLICATE_NAME_ERROR;
						return false;
					}
					if (this.migrationStateModel._targetType === MigrationTargetType.SQLMI && this._existingDatabases.includes(c.value!)) { // Making sure if database with same name is not present on the target Azure SQL
						c.validationErrorMessage = constants.DATABASE_ALREADY_EXISTS_MI(c.value!, this.migrationStateModel._targetServerInstance.name);
						return false;
					}
					if (c.value!.length < 1 || c.value!.length > 128 || !/[^<>*%&:\\\/?]/.test(c.value!)) {
						c.validationErrorMessage = constants.INVALID_TARGET_NAME_ERROR;
						return false;
					}
					return true;
				}).component();
				targetDatabaseInput.onTextChanged((value) => {
					this.migrationStateModel._targetDatabaseNames[index] = value.trim();
				});
				this._targetDatabaseNames.push(targetDatabaseInput);

				targetRow.push({
					value: db
				});
				targetRow.push({
					value: targetDatabaseInput
				});
				tableRows.push(targetRow);
			});

			this._targetDatabaseNamesTable.dataValues = tableRows;
			this.migrationStateModel.refreshDatabaseBackupPage = false;
		}
		await this.getSubscriptionValues();
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}

			const errors: string[] = [];

			switch (this.migrationStateModel._databaseBackup.networkContainerType) {
				case NetworkContainerType.NETWORK_SHARE:
					if ((<azdata.CategoryValue>this._networkShareStorageAccountResourceGroupDropdown.value).displayName === constants.RESOURCE_GROUP_NOT_FOUND) {
						errors.push(constants.INVALID_RESOURCE_GROUP_ERROR);
					}
					if ((<azdata.CategoryValue>this._networkShareContainerStorageAccountDropdown.value).displayName === constants.NO_STORAGE_ACCOUNT_FOUND) {
						errors.push(constants.INVALID_STORAGE_ACCOUNT_ERROR);
					}
					break;
				case NetworkContainerType.BLOB_CONTAINER:
					if ((<azdata.CategoryValue>this._blobContainerResourceGroup.value).displayName === constants.RESOURCE_GROUP_NOT_FOUND) {
						errors.push(constants.INVALID_RESOURCE_GROUP_ERROR);
					}
					if ((<azdata.CategoryValue>this._blobContainerStorageAccountDropdown.value).displayName === constants.NO_STORAGE_ACCOUNT_FOUND) {
						errors.push(constants.INVALID_STORAGE_ACCOUNT_ERROR);
					}
					if ((<azdata.CategoryValue>this._blobContainerDropdown.value).displayName === constants.NO_BLOBCONTAINERS_FOUND) {
						errors.push(constants.INVALID_BLOBCONTAINER_ERROR);
					}
					break;
			}

			this.migrationStateModel._targetDatabaseNames.forEach(t => {
				if (this.migrationStateModel._targetType === MigrationTargetType.SQLMI && this._existingDatabases.includes(t)) { // Making sure if database with same name is not present on the target Azure SQL
					errors.push(constants.DATABASE_ALREADY_EXISTS_MI(t, this.migrationStateModel._targetServerInstance.name));
				}
			});

			this.wizard.message = {
				text: errors.join(EOL),
				level: azdata.window.MessageLevel.Error
			};
			if (errors.length > 0) {
				return false;
			}
			return true;
		});
	}

	public async onPageLeave(): Promise<void> {
		try {
			const storageAccount = (this.migrationStateModel._databaseBackup.networkContainerType === NetworkContainerType.BLOB_CONTAINER) ?
				this.migrationStateModel._databaseBackup.blob.storageAccount : this.migrationStateModel._databaseBackup.networkShare.storageAccount;

			this.migrationStateModel._databaseBackup.storageKey = (await getStorageAccountAccessKeys(
				this.migrationStateModel._azureAccount,
				this.migrationStateModel._databaseBackup.subscription,
				storageAccount)).keyName1;
		} finally {
			this.wizard.registerNavigationValidator((pageChangeInfo) => {
				return true;
			});
		}
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private toggleNetworkContainerFields(containerType: NetworkContainerType): void {
		this.wizard.message = {
			text: '',
			level: azdata.window.MessageLevel.Error
		};

		this.wizard.nextButton.enabled = true;
		this.migrationStateModel._databaseBackup.networkContainerType = containerType;
		this._fileShareContainer.updateCssStyles({ 'display': (containerType === NetworkContainerType.FILE_SHARE) ? 'inline' : 'none' });
		this._blobContainer.updateCssStyles({ 'display': (containerType === NetworkContainerType.BLOB_CONTAINER) ? 'inline' : 'none' });
		this._networkShareContainer.updateCssStyles({ 'display': (containerType === NetworkContainerType.NETWORK_SHARE) ? 'inline' : 'none' });
		this._networkShareStorageAccountDetails.updateCssStyles({ 'display': (containerType === NetworkContainerType.NETWORK_SHARE) ? 'inline' : 'none' });
		this._targetDatabaseContainer.updateCssStyles({ 'display': 'inline' });

		this._windowsUserAccountText.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
		this._passwordText.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
		this.validateFields();
	}


	private async validateFields(): Promise<void> {
		await this._networkSharePath.validate();
		await this._windowsUserAccountText.validate();
		await this._passwordText.validate();
		await this._networkShareContainerSubscription.validate();
		await this._networkShareStorageAccountResourceGroupDropdown.validate();
		await this._networkShareContainerStorageAccountDropdown.validate();
		await this._blobContainerSubscription.validate();
		await this._blobContainerResourceGroup.validate();
		await this._blobContainerStorageAccountDropdown.validate();
		await this._blobContainerDropdown.validate();
		await this._targetDatabaseNames.forEach((inputBox) => {
			inputBox.validate();
		});
	}

	private async getSubscriptionValues(): Promise<void> {

		this._networkShareContainerSubscription.value = this.migrationStateModel._targetSubscription.name;
		this._networkShareContainerLocation.value = await this.migrationStateModel.getLocationDisplayName(this.migrationStateModel._targetServerInstance.location);

		this._blobContainerSubscription.value = this.migrationStateModel._targetSubscription.name;
		this._blobContainerLocation.value = await this.migrationStateModel.getLocationDisplayName(this.migrationStateModel._targetServerInstance.location);

		this.migrationStateModel._databaseBackup.subscription = this.migrationStateModel._targetSubscription;


		this.loadNetworkStorageResourceGroup();
		this.loadblobResourceGroup();
	}

	private async loadNetworkStorageResourceGroup(): Promise<void> {
		this._networkShareStorageAccountResourceGroupDropdown.loading = true;
		try {
			this._networkShareStorageAccountResourceGroupDropdown.values = await this.migrationStateModel.getAzureResourceGroupDropdownValues(this.migrationStateModel._databaseBackup.subscription);
		} catch (error) {
			console.log(error);
		} finally {
			this._networkShareStorageAccountResourceGroupDropdown.loading = false;
			this.loadNetworkShareStorageDropdown();
		}
	}

	private async loadNetworkShareStorageDropdown(): Promise<void> {
		this._networkShareContainerStorageAccountDropdown.loading = true;
		try {
			this._networkShareContainerStorageAccountDropdown.values = await this.migrationStateModel.getStorageAccountValues(this.migrationStateModel._databaseBackup.subscription, this.migrationStateModel._databaseBackup.networkShare.resourceGroup);
		} catch (error) {
			console.log(error);
		} finally {
			this._networkShareContainerStorageAccountDropdown.loading = false;
		}
	}

	private async loadblobResourceGroup(): Promise<void> {
		this._blobContainerResourceGroup.loading = true;
		try {
			this._blobContainerResourceGroup.values = await this.migrationStateModel.getAzureResourceGroupDropdownValues(this.migrationStateModel._databaseBackup.subscription);
		} catch (error) {
			console.log(error);
		} finally {
			this._blobContainerResourceGroup.loading = false;
		}
	}

	private async loadblobStorageDropdown(): Promise<void> {
		this._blobContainerStorageAccountDropdown.loading = true;
		try {
			this._blobContainerStorageAccountDropdown.values = await this.migrationStateModel.getStorageAccountValues(this.migrationStateModel._databaseBackup.subscription, this.migrationStateModel._databaseBackup.blob.resourceGroup);
		} catch (error) {
			console.log(error);
		} finally {
			this._blobContainerStorageAccountDropdown.loading = false;
		}
	}

	private async loadBlobContainerDropdown(): Promise<void> {
		this._blobContainerDropdown.loading = true;
		try {
			const blobContainerValues = await this.migrationStateModel.getBlobContainerValues(this.migrationStateModel._databaseBackup.subscription, this.migrationStateModel._databaseBackup.blob.storageAccount);
			this._blobContainerDropdown.values = blobContainerValues;
		} catch (error) {
			console.log(error);
		} finally {
			this._blobContainerDropdown.loading = false;
		}
	}

}
