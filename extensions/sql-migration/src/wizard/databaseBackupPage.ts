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
	private _networkShareContainerSubscription!: azdata.InputBoxComponent;
	private _networkShareContainerLocation!: azdata.InputBoxComponent;
	private _networkShareStorageAccountResourceGroupDropdown!: azdata.DropDownComponent;
	private _networkShareContainerStorageAccountDropdown!: azdata.DropDownComponent;
	private _networkShareContainerStorageAccountRefreshButton!: azdata.ButtonComponent;
	private _windowsUserAccountText!: azdata.InputBoxComponent;
	private _passwordText!: azdata.InputBoxComponent;
	private _networkShareDatabaseConfigContainer!: azdata.FlexContainer;
	private _targetDatabaseNames: azdata.InputBoxComponent[] = [];

	private _blobContainer!: azdata.FlexContainer;
	private _blobContainerSubscription!: azdata.InputBoxComponent;
	private _blobContainerStorageAccountDropdown!: azdata.DropDownComponent;
	private _blobContainerDatabaseConfigContainer!: azdata.FlexContainer;
	private _blobContainerDropdowns: azdata.DropDownComponent[] = [];

	private _fileShareContainer!: azdata.FlexContainer;
	private _fileShareSubscription!: azdata.InputBoxComponent;
	private _fileShareStorageAccountDropdown!: azdata.DropDownComponent;
	private _fileShareDatabaseConfigContainer!: azdata.FlexContainer;
	private _fileShareDropdowns: azdata.DropDownComponent[] = [];

	private _existingDatabases: string[] = [];

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.DATABASE_BACKUP_PAGE_TITLE), migrationStateModel);
		this.wizardPage.description = constants.DATABASE_BACKUP_PAGE_DESCRIPTION;
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;
		this._networkShareContainer = this.createNetworkShareContainer(view);
		this._blobContainer = this.createBlobContainer(view);
		this._fileShareContainer = this.createFileShareContainer(view);

		const networkContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withItems([
			this._networkShareContainer,
			this._blobContainer,
			this._fileShareContainer
		]).component();

		const form = view.modelBuilder.formContainer()
			.withFormItems(
				[
					this.createBackupLocationComponent(view),
					{
						title: '',
						component: networkContainer
					},
				]
			);
		await view.initializeModel(form.component());
	}

	private createBackupLocationComponent(view: azdata.ModelView): azdata.FormComponent {
		const buttonGroup = 'networkContainer';

		const networkShareButton = view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.DATABASE_BACKUP_NC_NETWORK_SHARE_RADIO_LABEL,
				checked: true
			}).component();

		networkShareButton.onDidChangeCheckedState((e) => {
			if (e) {
				this.toggleNetworkContainerFields(NetworkContainerType.NETWORK_SHARE);
			}
		});

		const blobContainerButton = view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.DATABASE_BACKUP_NC_BLOB_STORAGE_RADIO_LABEL,
			}).component();

		blobContainerButton.onDidChangeCheckedState((e) => {
			if (e) {
				vscode.window.showInformationMessage('Feature coming soon');
				networkShareButton.checked = true;
				//this.toggleNetworkContainerFields(NetworkContainerType.BLOB_CONTAINER);
			}
		});

		const fileShareButton = view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.DATABASE_BACKUP_NC_FILE_SHARE_RADIO_LABEL,
			}).component();

		fileShareButton.onDidChangeCheckedState((e) => {
			if (e) {
				vscode.window.showInformationMessage('Feature coming soon');
				networkShareButton.checked = true;
				//this.toggleNetworkContainerFields(NetworkContainerType.FILE_SHARE);
			}
		});

		const flexContainer = view.modelBuilder.flexContainer().withItems(
			[
				networkShareButton,
				blobContainerButton,
				fileShareButton
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return {
			title: '',
			component: flexContainer
		};
	}

	private createFileShareContainer(view: azdata.ModelView): azdata.FlexContainer {

		const subscriptionLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_FILE_SHARE_SUBSCRIPTION_LABEL,
			requiredIndicator: true,
		}).component();
		this._fileShareSubscription = view.modelBuilder.inputBox().withProps({
			required: false,
			enabled: false
		}).component();

		const storageAccountLabel = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_FILE_SHARE_STORAGE_ACCOUNT_LABEL,
				requiredIndicator: true,
			}).component();
		this._fileShareStorageAccountDropdown = view.modelBuilder.dropDown()
			.withProps({
				required: false
			}).component();
		this._fileShareStorageAccountDropdown.onValueChanged(async (value) => {
			if (value.selected) {
				this.migrationStateModel._databaseBackup.storageAccount = this.migrationStateModel.getStorageAccount(value.index);
				this.migrationStateModel._databaseBackup.fileShares = undefined!;
				await this.loadFileShareDropdown();
			}
		});

		const fileShareDatabaseConfigHeader = view.modelBuilder.text().withProps({
			value: constants.ENTER_FILE_SHARE_INFORMATION
		}).component();

		this._fileShareDatabaseConfigContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();

		const flexContainer = view.modelBuilder.flexContainer()
			.withItems(
				[
					subscriptionLabel,
					this._fileShareSubscription,
					storageAccountLabel,
					this._fileShareStorageAccountDropdown,
					fileShareDatabaseConfigHeader,
					this._fileShareDatabaseConfigContainer
				]
			).withLayout({
				flexFlow: 'column'
			}).withProps({
				display: 'none'
			}).component();

		return flexContainer;
	}

	private createBlobContainer(view: azdata.ModelView): azdata.FlexContainer {
		const subscriptionLabel = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_BLOB_STORAGE_SUBSCRIPTION_LABEL,
				requiredIndicator: true,
			}).component();
		this._blobContainerSubscription = view.modelBuilder.inputBox()
			.withProps({
				required: false,
				enabled: false
			}).component();

		const storageAccountLabel = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_LABEL,
				requiredIndicator: true,
			}).component();
		this._blobContainerStorageAccountDropdown = view.modelBuilder.dropDown()
			.withProps({
				required: false
			}).component();
		this._blobContainerStorageAccountDropdown.onValueChanged(async (value) => {
			if (value.selected) {
				this.migrationStateModel._databaseBackup.storageAccount = this.migrationStateModel.getStorageAccount(value.index);
				this.migrationStateModel._databaseBackup.blobContainers = undefined!;
				await this.loadBlobContainerDropdown();
			}
		});


		const blobContainerDatabaseConfigHeader = view.modelBuilder.text().withProps({
			value: constants.ENTER_BLOB_CONTAINER_INFORMATION
		}).component();

		this._blobContainerDatabaseConfigContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();

		const flexContainer = view.modelBuilder.flexContainer()
			.withItems(
				[
					subscriptionLabel,
					this._blobContainerSubscription,
					storageAccountLabel,
					this._blobContainerStorageAccountDropdown,
					blobContainerDatabaseConfigHeader,
					this._blobContainerDatabaseConfigContainer
				]
			).withLayout({
				flexFlow: 'column'
			}).withProps({
				display: 'none'
			}).component();

		return flexContainer;
	}

	private createNetworkShareContainer(view: azdata.ModelView): azdata.FlexContainer {
		const networkShareHeading = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_HEADER_TEXT,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'font-size': '14px',
				'font-weight': 'bold'
			}
		}).component();
		const networkShareHelpText = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NC_NETWORK_SHARE_HELP_TEXT,
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();

		const networkLocationInputBoxLabel = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_LOCATION_LABEL,
			requiredIndicator: true,
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();
		const networkLocationInputBox = this._view.modelBuilder.inputBox().withProps({
			placeHolder: '\\\\Servername.domainname.com\\Backupfolder',
			required: true,
			validationErrorMessage: constants.INVALID_NETWORK_SHARE_LOCATION,
			width: WIZARD_INPUT_COMPONENT_WIDTH
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
		networkLocationInputBox.onTextChanged((value) => {
			this.validateFields();
			this.migrationStateModel._databaseBackup.networkShareLocation = value;
		});
		const networkShareInfoBox = view.modelBuilder.infoBox().withProps({
			text: constants.DATABASE_SERVICE_ACCOUNT_INFO_TEXT,
			style: 'information',
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();

		const windowsUserAccountLabel = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_WINDOWS_USER_LABEL,
				requiredIndicator: true,
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();
		this._windowsUserAccountText = view.modelBuilder.inputBox()
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
			this.migrationStateModel._databaseBackup.windowsUser = value;
		});

		const passwordLabel = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_LABEL,
				requiredIndicator: true,
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();
		this._passwordText = view.modelBuilder.inputBox()
			.withProps({
				placeHolder: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_PLACEHOLDER,
				inputType: 'password',
				required: true,
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();
		this._passwordText.onTextChanged((value) => {
			this.migrationStateModel._databaseBackup.password = value;
		});

		const azureAccountHeader = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_AZURE_ACCOUNT_HEADER,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					'font-size': '14px',
					'font-weight': 'bold'
				}
			}).component();

		const azureAccountHelpText = view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_AZURE_ACCOUNT_HELP,
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();

		const subscriptionLabel = view.modelBuilder.text()
			.withProps({
				value: constants.SUBSCRIPTION,
				requiredIndicator: true,
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();
		this._networkShareContainerSubscription = view.modelBuilder.inputBox()
			.withProps({
				required: true,
				enabled: false,
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();

		const locationLabel = view.modelBuilder.text()
			.withProps({
				value: constants.LOCATION,
				requiredIndicator: true,
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();
		this._networkShareContainerLocation = view.modelBuilder.inputBox()
			.withProps({
				required: true,
				enabled: false,
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();

		const resourceGroupLabel = view.modelBuilder.text()
			.withProps({
				value: constants.RESOURCE_GROUP,
				requiredIndicator: true,
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();
		this._networkShareStorageAccountResourceGroupDropdown = view.modelBuilder.dropDown().withProps({
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();
		this._networkShareStorageAccountResourceGroupDropdown.onValueChanged(e => {
			if (e.selected) {
				this.migrationStateModel._databaseBackup.resourceGroup = this.migrationStateModel.getAzureResourceGroup(e.index);
				this.loadNetworkShareStorageDropdown();
			}
		});

		const storageAccountLabel = view.modelBuilder.text()
			.withProps({
				value: constants.STORAGE_ACCOUNT,
				requiredIndicator: true,
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();
		this._networkShareContainerStorageAccountDropdown = view.modelBuilder.dropDown()
			.withProps({
				required: true,
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();
		this._networkShareContainerStorageAccountDropdown.onValueChanged((value) => {
			if (value.selected) {
				this.migrationStateModel._databaseBackup.storageAccount = this.migrationStateModel.getStorageAccount(value.index);
			}
		});

		this._networkShareContainerStorageAccountRefreshButton = view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh,
			iconHeight: 18,
			iconWidth: 18,
			height: 25
		}).component();

		this._networkShareContainerStorageAccountRefreshButton.onDidClick((e) => {
			this.loadNetworkShareStorageDropdown();
		});

		const storageAccountContainer = view.modelBuilder.flexContainer().component();

		storageAccountContainer.addItem(this._networkShareContainerStorageAccountDropdown, {
			flex: '0 0 auto'
		});

		storageAccountContainer.addItem(this._networkShareContainerStorageAccountRefreshButton, {
			flex: '0 0 auto',
			CSSStyles: {
				'margin-left': '5px'
			}
		});

		const networkShareDatabaseConfigHeader = view.modelBuilder.text().withProps({
			value: constants.ENTER_NETWORK_SHARE_INFORMATION,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'font-size': '14px',
				'font-weight': 'bold'
			}
		}).component();
		this._networkShareDatabaseConfigContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).component();


		const flexContainer = view.modelBuilder.flexContainer().withItems(
			[
				networkShareHeading,
				networkShareHelpText,
				networkLocationInputBoxLabel,
				networkLocationInputBox,
				networkShareInfoBox,
				windowsUserAccountLabel,
				this._windowsUserAccountText,
				passwordLabel,
				this._passwordText,
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
				networkShareDatabaseConfigHeader,
				this._networkShareDatabaseConfigContainer
			]
		).withLayout({
			flexFlow: 'column'
		}).withProps({
			display: 'none'
		}).component();

		return flexContainer;
	}

	public async onPageEnter(): Promise<void> {
		if (this.migrationStateModel.refreshDatabaseBackupPage) {
			this._targetDatabaseNames = [];
			if (this.migrationStateModel._targetType === MigrationTargetType.SQLMI) {
				this._existingDatabases = await this.migrationStateModel.getManagedDatabases();
			}
			this._fileShareDropdowns = [];
			this._blobContainerDropdowns = [];
			this.migrationStateModel._targetDatabaseNames = [];
			this.migrationStateModel._databaseBackup.fileShares = [];
			this.migrationStateModel._databaseBackup.blobContainers = [];
			this._networkShareDatabaseConfigContainer.clearItems();
			this._fileShareDatabaseConfigContainer.clearItems();
			this._blobContainerDatabaseConfigContainer.clearItems();

			this.migrationStateModel._migrationDbs.forEach((db, index) => {
				this.migrationStateModel._targetDatabaseNames.push('');
				const targetNameLabel = constants.TARGET_NAME_FOR_DATABASE(db);
				const targetNameNetworkInputBoxLabel = this._view.modelBuilder.text().withProps({
					value: targetNameLabel,
					requiredIndicator: true
				}).component();
				const targetNameNetworkInputBox = this._view.modelBuilder.inputBox().withProps({
					required: true,
					value: db,
					width: WIZARD_INPUT_COMPONENT_WIDTH
				}).withValidation(c => {
					if (this._targetDatabaseNames.filter(t => t.value === c.value).length > 1) { //Making sure no databases have duplicate values.
						c.validationErrorMessage = constants.DUPLICATE_NAME_ERROR;
						return false;
					}
					if (this.migrationStateModel._targetType === MigrationTargetType.SQLMI && this._existingDatabases.includes(c.value!)) { // Making sure if database with same name is not present on the target Azure SQL
						c.validationErrorMessage = constants.DATABASE_ALREADY_EXISTS_MI(this.migrationStateModel._targetServerInstance.name);
						return false;
					}
					if (c.value!.length < 1 || c.value!.length > 128 || !/[^<>*%&:\\\/?]/.test(c.value!)) {
						c.validationErrorMessage = constants.INVALID_TARGET_NAME_ERROR;
						return false;
					}
					return true;
				}).component();
				targetNameNetworkInputBox.onTextChanged((value) => {
					this.migrationStateModel._targetDatabaseNames[index] = value.trim();
				});
				this._targetDatabaseNames.push(targetNameNetworkInputBox);

				this._networkShareDatabaseConfigContainer.addItems(
					[
						targetNameNetworkInputBoxLabel,
						targetNameNetworkInputBox
					]
				);

				const targetNameFileInputBoxLabel = this._view.modelBuilder.text().withProps({
					value: targetNameLabel
				}).component();
				const targetNameFileInputBox = this._view.modelBuilder.inputBox().withProps({
				}).component();
				const fileShareLabel = this._view.modelBuilder.text()
					.withProps({
						value: constants.TARGET_FILE_SHARE(db),
						requiredIndicator: true,
					}).component();
				const fileShareDropdown = this._view.modelBuilder.dropDown()
					.withProps({
					}).component();
				fileShareDropdown.onValueChanged((value) => {
					if (value.selected && value.selected !== constants.NO_FILESHARES_FOUND) {
						this.validateFields();
						this.migrationStateModel._databaseBackup.fileShares[index] = this.migrationStateModel.getFileShare(value.index);
					}
				});
				this.migrationStateModel._databaseBackup.fileShares.push(undefined!);
				this._fileShareDropdowns.push(fileShareDropdown);
				this._fileShareDatabaseConfigContainer.addItems(
					[
						targetNameFileInputBoxLabel,
						targetNameFileInputBox,
						fileShareLabel,
						fileShareDropdown
					]
				);

				const targetNameBlobInputBoxLabel = this._view.modelBuilder.text().withProps({
					value: targetNameLabel
				}).component();
				const targetNameBlobInputBox = this._view.modelBuilder.inputBox().withProps({
				}).component();
				const blobContainerLabel = this._view.modelBuilder.text()
					.withProps({
						value: constants.TARGET_BLOB_CONTAINER(db),
						requiredIndicator: true,
					}).component();
				const blobContainerDropdown = this._view.modelBuilder.dropDown()
					.withProps({
					}).component();
				blobContainerDropdown.onValueChanged((value) => {
					if (value.selected && value.selected !== constants.NO_BLOBCONTAINERS_FOUND) {
						this.validateFields();
						this.migrationStateModel._databaseBackup.blobContainers[index] = this.migrationStateModel.getBlobContainer(value.index);
					}
				});
				this.migrationStateModel._databaseBackup.fileShares.push(undefined!);
				this._blobContainerDropdowns.push(blobContainerDropdown);
				this._blobContainerDatabaseConfigContainer.addItems(
					[
						targetNameBlobInputBoxLabel,
						targetNameBlobInputBox,
						blobContainerLabel,
						blobContainerDropdown
					]
				);
			});

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
					if (this._networkShareContainerSubscription.value === constants.NO_SUBSCRIPTIONS_FOUND) {
						errors.push(constants.INVALID_SUBSCRIPTION_ERROR);
					}
					if ((<azdata.CategoryValue>this._networkShareContainerStorageAccountDropdown.value).displayName === constants.NO_STORAGE_ACCOUNT_FOUND) {
						errors.push(constants.INVALID_STORAGE_ACCOUNT_ERROR);
					}
					break;
				case NetworkContainerType.BLOB_CONTAINER:
					if ((<azdata.CategoryValue>this._blobContainerStorageAccountDropdown.value).displayName === constants.NO_STORAGE_ACCOUNT_FOUND) {
						errors.push(constants.INVALID_STORAGE_ACCOUNT_ERROR);
					}
					for (let i = 0; i < this._blobContainerDropdowns.length; i++) {
						if ((<azdata.CategoryValue>this._blobContainerDropdowns[i].value).displayName === constants.NO_BLOBCONTAINERS_FOUND) {
							errors.push(constants.INVALID_BLOBCONTAINER_ERROR);
							break;
						}
					}
					break;
				case NetworkContainerType.FILE_SHARE:
					if ((<azdata.CategoryValue>this._fileShareStorageAccountDropdown.value).displayName === constants.NO_STORAGE_ACCOUNT_FOUND) {
						errors.push(constants.INVALID_STORAGE_ACCOUNT_ERROR);
					}
					for (let i = 0; i < this._fileShareDropdowns.length; i++) {
						if ((<azdata.CategoryValue>this._fileShareDropdowns[i].value).displayName === constants.NO_FILESHARES_FOUND) {
							errors.push(constants.INVALID_FILESHARE_ERROR);
							break;
						}
					}
					break;
			}

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
			this.migrationStateModel._databaseBackup.storageKey = (await getStorageAccountAccessKeys(this.migrationStateModel._azureAccount, this.migrationStateModel._databaseBackup.subscription, this.migrationStateModel._databaseBackup.storageAccount)).keyName1;
		} finally {
			this.wizard.registerNavigationValidator((pageChangeInfo) => {
				return true;
			});
		}
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private toggleNetworkContainerFields(containerType: NetworkContainerType): void {
		this.migrationStateModel._databaseBackup.networkContainerType = containerType;
		this._fileShareContainer.updateCssStyles({ 'display': (containerType === NetworkContainerType.FILE_SHARE) ? 'inline' : 'none' });
		this._blobContainer.updateCssStyles({ 'display': (containerType === NetworkContainerType.BLOB_CONTAINER) ? 'inline' : 'none' });
		this._networkShareContainer.updateCssStyles({ 'display': (containerType === NetworkContainerType.NETWORK_SHARE) ? 'inline' : 'none' });
		this._windowsUserAccountText.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
		this._passwordText.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
		this._targetDatabaseNames.forEach((inputBox) => {
			inputBox.validate();
		});
		this._windowsUserAccountText.validate();
		this._passwordText.validate();
		this._networkShareContainerSubscription.validate();
		this._networkShareContainerStorageAccountDropdown.validate();
		this._blobContainerSubscription.validate();
		this._blobContainerStorageAccountDropdown.validate();
		this._blobContainerDropdowns.forEach((dropdown) => {
			dropdown.validate();
		});
		this._fileShareSubscription.validate();
		this._fileShareStorageAccountDropdown.validate();
		this._fileShareDropdowns.forEach(dropdown => {
			dropdown.validate();
		});

	}


	private validateFields(): void {
		this._targetDatabaseNames.forEach((inputBox) => {
			inputBox.validate();
		});
		this._windowsUserAccountText.validate();
		this._passwordText.validate();
		this._networkShareContainerSubscription.validate();
		this._networkShareContainerStorageAccountDropdown.validate();
		this._blobContainerSubscription.validate();
		this._blobContainerStorageAccountDropdown.validate();
		this._blobContainerDropdowns.forEach((dropdown) => {
			dropdown.validate();
		});
		this._fileShareSubscription.validate();
		this._fileShareStorageAccountDropdown.validate();
		this._fileShareDropdowns.forEach((dropdown) => {
			dropdown.validate();
		});
	}

	private async getSubscriptionValues(): Promise<void> {
		this._fileShareSubscription.value = this.migrationStateModel._targetSubscription.name;
		this._networkShareContainerSubscription.value = this.migrationStateModel._targetSubscription.name;
		this._networkShareContainerLocation.value = await this.migrationStateModel.getLocationDisplayName(this.migrationStateModel._targetServerInstance.location);
		this._blobContainerSubscription.value = this.migrationStateModel._targetSubscription.name;
		this.migrationStateModel._databaseBackup.subscription = this.migrationStateModel._targetSubscription;
		this.loadNetworkStorageResourceGroup();
		this.loadFileShareStorageDropdown();
		this.loadblobStorageDropdown();
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
			this._networkShareContainerStorageAccountDropdown.values = await this.migrationStateModel.getStorageAccountValues(this.migrationStateModel._databaseBackup.subscription);
		} catch (error) {
			console.log(error);
		} finally {
			this._networkShareContainerStorageAccountDropdown.loading = false;
		}
	}

	private async loadFileShareStorageDropdown(): Promise<void> {
		if (!this.migrationStateModel._databaseBackup.storageAccount) {
			this._fileShareStorageAccountDropdown.loading = true;
			this._fileShareDropdowns.forEach((dropdown) => {
				dropdown.loading = true;
			});
			try {
				this._fileShareStorageAccountDropdown.values = await this.migrationStateModel.getStorageAccountValues(this.migrationStateModel._databaseBackup.subscription);
			} catch (error) {
				console.log(error);
			} finally {
				this._fileShareStorageAccountDropdown.loading = false;
				this._fileShareDropdowns.forEach((dropdown) => {
					dropdown.loading = false;
				});
			}
		}
	}

	private async loadblobStorageDropdown(): Promise<void> {
		if (!this.migrationStateModel._databaseBackup.storageAccount) {
			this._blobContainerStorageAccountDropdown.loading = true;
			this._blobContainerDropdowns.forEach((dropdown) => {
				dropdown.loading = true;
			});
			try {
				this._blobContainerStorageAccountDropdown.values = await this.migrationStateModel.getStorageAccountValues(this.migrationStateModel._databaseBackup.subscription);
			} catch (error) {
				console.log(error);
			} finally {
				this._blobContainerStorageAccountDropdown.loading = false;
				this._blobContainerDropdowns.forEach((dropdown) => {
					dropdown.loading = false;
				});
			}
		}
	}

	private async loadFileShareDropdown(): Promise<void> {
		if (!this.migrationStateModel._fileShares) {
			this._fileShareDropdowns.forEach((dropdown) => {
				dropdown.loading = true;
			});
			try {
				const fileShareValues = await this.migrationStateModel.getFileShareValues(this.migrationStateModel._databaseBackup.subscription, this.migrationStateModel._databaseBackup.storageAccount);
				this._fileShareDropdowns.forEach((dropdown) => {
					dropdown.values = fileShareValues;
				});
			} catch (error) {
				console.log(error);
			} finally {
				this._fileShareDropdowns.forEach((dropdown) => {
					dropdown.loading = true;
				});
			}
		}
	}

	private async loadBlobContainerDropdown(): Promise<void> {
		if (!this.migrationStateModel._blobContainers) {
			this._blobContainerDropdowns.forEach((dropdown) => {
				dropdown.loading = true;
			});
			try {
				const blobContainerValues = await this.migrationStateModel.getBlobContainerValues(this.migrationStateModel._databaseBackup.subscription, this.migrationStateModel._databaseBackup.storageAccount);
				this._blobContainerDropdowns.forEach((dropdown) => {
					dropdown.values = blobContainerValues;
				});
			} catch (error) {
				console.log(error);
			} finally {
				this._blobContainerDropdowns.forEach((dropdown) => {
					dropdown.loading = false;
				});
			}
		}
	}
}
