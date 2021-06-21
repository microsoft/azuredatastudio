/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { EOL } from 'os';
import { getStorageAccountAccessKeys } from '../api/azure';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { Blob, MigrationSourceAuthenticationType, MigrationStateModel, MigrationTargetType, NetworkContainerType, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { IconPathHelper } from '../constants/iconPathHelper';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import { findDropDownItemIndex, selectDropDownIndex } from '../api/utils';

const WIZARD_TABLE_COLUMN_WIDTH = '200px';

export class DatabaseBackupPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;

	private _networkShareContainer!: azdata.FlexContainer;
	private _windowsUserAccountText!: azdata.InputBoxComponent;
	private _passwordText!: azdata.InputBoxComponent;
	private _networkSharePath!: azdata.InputBoxComponent;
	private _sourceHelpText!: azdata.TextComponent;
	private _sqlSourceUsernameInput!: azdata.InputBoxComponent;
	private _sqlSourcepassword!: azdata.InputBoxComponent;

	private _blobContainer!: azdata.FlexContainer;
	private _blobContainerSubscription!: azdata.InputBoxComponent;
	private _blobContainerLocation!: azdata.InputBoxComponent;
	private _blobContainerResourceGroupDropdowns!: azdata.DropDownComponent[];
	private _blobContainerStorageAccountDropdowns!: azdata.DropDownComponent[];
	private _blobContainerDropdowns!: azdata.DropDownComponent[];

	private _networkShareStorageAccountDetails!: azdata.FlexContainer;
	private _networkShareContainerSubscription!: azdata.InputBoxComponent;
	private _networkShareContainerLocation!: azdata.InputBoxComponent;
	private _networkShareStorageAccountResourceGroupDropdown!: azdata.DropDownComponent;
	private _networkShareContainerStorageAccountDropdown!: azdata.DropDownComponent;
	private _networkShareContainerStorageAccountRefreshButton!: azdata.ButtonComponent;

	private _targetDatabaseContainer!: azdata.FlexContainer;
	private _newtworkShareTargetDatabaseNamesTable!: azdata.DeclarativeTableComponent;
	private _blobContainerTargetDatabaseNamesTable!: azdata.DeclarativeTableComponent;
	private _networkTableContainer!: azdata.FlexContainer;
	private _blobTableContainer!: azdata.FlexContainer;
	private _networkShareTargetDatabaseNames: azdata.InputBoxComponent[] = [];
	private _blobContainerTargetDatabaseNames: azdata.InputBoxComponent[] = [];


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
				this.switchNetworkContainerFields(NetworkContainerType.NETWORK_SHARE);
			}
		});

		const blobContainerButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.DATABASE_BACKUP_NC_BLOB_STORAGE_RADIO_LABEL,
				CSSStyles: {
					'font-size': '13px'
				}
			}).component();

		blobContainerButton.onDidChangeCheckedState((e) => {
			if (e) {
				this.switchNetworkContainerFields(NetworkContainerType.BLOB_CONTAINER);
			}
		});

		const flexContainer = this._view.modelBuilder.flexContainer().withItems(
			[
				selectLocationText,
				networkShareButton,
				blobContainerButton
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return flexContainer;
	}

	private createNetworkDetailsContainer(): azdata.FlexContainer {
		this._networkShareContainer = this.createNetworkShareContainer();
		this._blobContainer = this.createBlobContainer();

		const networkContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withItems([
			this._networkShareContainer,
			this._blobContainer,
		]).component();
		return networkContainer;
	}

	private createNetworkShareContainer(): azdata.FlexContainer {

		const sqlSourceHeader = this._view.modelBuilder.text().withProps({
			value: constants.SOURCE_CREDENTIALS,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'font-size': '14px',
				'font-weight': 'bold'
			}
		}).component();

		this._sourceHelpText = this._view.modelBuilder.text().withProps({
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'font-size': '13px',
			}
		}).component();

		const usernameLable = this._view.modelBuilder.text().withProps({
			value: constants.USERNAME,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold',
			}
		}).component();
		this._sqlSourceUsernameInput = this._view.modelBuilder.inputBox().withProps({
			required: true,
			enabled: false,
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();
		this._sqlSourceUsernameInput.onTextChanged(value => {
			this.migrationStateModel._sqlServerUsername = value;
		});

		const sqlPasswordLabel = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_LABEL,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold',
			}
		}).component();
		this._sqlSourcepassword = this._view.modelBuilder.inputBox().withProps({
			required: true,
			inputType: 'password',
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();
		this._sqlSourcepassword.onTextChanged(value => {
			this.migrationStateModel._sqlServerPassword = value;
		});


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
				sqlSourceHeader,
				this._sourceHelpText,
				usernameLable,
				this._sqlSourceUsernameInput,
				sqlPasswordLabel,
				this._sqlSourcepassword,
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

		const flexContainer = this._view.modelBuilder.flexContainer()
			.withItems(
				[
					subscriptionLabel,
					this._blobContainerSubscription,
					locationLabel,
					this._blobContainerLocation,
				]
			).withLayout({
				flexFlow: 'column'
			}).withProps({
				display: 'none'
			}).component();

		return flexContainer;
	}


	private createTargetDatabaseContainer(): azdata.FlexContainer {
		const headerCssStyles: azdata.CssStyles = {
			'border': 'none',
			'font-size': '13px',
			'font-weight': 'bold',
			'text-align': 'left',
			'border-bottom': '1px solid',
		};
		const rowCssStyle: azdata.CssStyles = {
			'border': 'none',
			'font-size': '13px',
			'border-bottom': '1px solid',
		};

		this._newtworkShareTargetDatabaseNamesTable = this._view.modelBuilder.declarativeTable().withProps({
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
		this._blobContainerTargetDatabaseNamesTable = this._view.modelBuilder.declarativeTable().withProps({
			columns: [
				{
					displayName: constants.SOURCE_DATABASE,
					valueType: azdata.DeclarativeDataType.string,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles,
					isReadOnly: true,
					width: WIZARD_TABLE_COLUMN_WIDTH,
				},
				{
					displayName: constants.TARGET_DATABASE_NAME,
					valueType: azdata.DeclarativeDataType.component,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles,
					isReadOnly: true,
					width: WIZARD_TABLE_COLUMN_WIDTH
				},
				{
					displayName: constants.RESOURCE_GROUP,
					valueType: azdata.DeclarativeDataType.component,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles,
					isReadOnly: true,
					width: WIZARD_TABLE_COLUMN_WIDTH
				},
				{
					displayName: constants.STORAGE_ACCOUNT,
					valueType: azdata.DeclarativeDataType.component,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles,
					isReadOnly: true,
					width: WIZARD_TABLE_COLUMN_WIDTH
				},
				{
					displayName: constants.BLOB_CONTAINER,
					valueType: azdata.DeclarativeDataType.component,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles,
					isReadOnly: true,
					width: WIZARD_TABLE_COLUMN_WIDTH
				}
			]
		}).component();

		this._networkTableContainer = this._view.modelBuilder.flexContainer().withItems([
			this._newtworkShareTargetDatabaseNamesTable
		]).component();

		this._blobTableContainer = this._view.modelBuilder.flexContainer().withItems([
			this._blobContainerTargetDatabaseNamesTable
		]).component();

		const container = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withItems([
			this._networkTableContainer,
			this._blobTableContainer
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
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			editable: true,
			fireOnTextChange: true,
		}).component();
		this._networkShareStorageAccountResourceGroupDropdown.onValueChanged(async (value) => {
			const selectedIndex = findDropDownItemIndex(this._networkShareStorageAccountResourceGroupDropdown, value);
			if (selectedIndex > -1) {
				this.migrationStateModel._databaseBackup.networkShare.resourceGroup = this.migrationStateModel.getAzureResourceGroup(selectedIndex);
				await this.loadNetworkShareStorageDropdown();
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
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				fireOnTextChange: true,
			}).component();
		this._networkShareContainerStorageAccountDropdown.onValueChanged((value) => {
			const selectedIndex = findDropDownItemIndex(this._networkShareContainerStorageAccountDropdown, value);
			if (selectedIndex > -1) {
				this.migrationStateModel._databaseBackup.networkShare.storageAccount = this.migrationStateModel.getStorageAccount(selectedIndex);
			}
		});

		this._networkShareContainerStorageAccountRefreshButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh,
			iconHeight: 18,
			iconWidth: 18,
			height: 25
		}).component();

		this._networkShareContainerStorageAccountRefreshButton.onDidClick(async (value) => {
			await this.loadNetworkShareStorageDropdown();
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
			const connectionProfile = await this.migrationStateModel.getSourceConnectionProfile();
			const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>((await this.migrationStateModel.getSourceConnectionProfile()).providerId, azdata.DataProviderType.QueryProvider);
			const query = 'select SUSER_NAME()';
			const results = await queryProvider.runQueryAndReturn(await (azdata.connection.getUriForConnection(this.migrationStateModel.sourceConnectionId)), query);
			const username = results.rows[0][0].displayValue;
			this.migrationStateModel._authenticationType = connectionProfile.authenticationType === 'SqlLogin' ? MigrationSourceAuthenticationType.Sql : connectionProfile.authenticationType === 'Integrated' ? MigrationSourceAuthenticationType.Integrated : undefined!;
			this._sourceHelpText.value = constants.SQL_SOURCE_DETAILS(this.migrationStateModel._authenticationType, connectionProfile.serverName);
			this._sqlSourceUsernameInput.value = username;
			this._sqlSourcepassword.value = (await azdata.connection.getCredentials(this.migrationStateModel.sourceConnectionId)).password;

			this._networkShareTargetDatabaseNames = [];
			this._blobContainerTargetDatabaseNames = [];
			this._blobContainerResourceGroupDropdowns = [];
			this._blobContainerStorageAccountDropdowns = [];
			this._blobContainerDropdowns = [];

			if (this.migrationStateModel._targetType === MigrationTargetType.SQLMI) {
				this._existingDatabases = await this.migrationStateModel.getManagedDatabases();
			}
			this.migrationStateModel._targetDatabaseNames = [];
			this.migrationStateModel._databaseBackup.blobs = [];
			this.migrationStateModel._migrationDbs.forEach((db, index) => {

				this.migrationStateModel._targetDatabaseNames.push('');
				this.migrationStateModel._databaseBackup.blobs.push(<Blob>{});
				const targetDatabaseInput = this._view.modelBuilder.inputBox().withProps({
					required: true,
					value: db,
					width: WIZARD_TABLE_COLUMN_WIDTH
				}).withValidation(c => {
					if (this._networkShareTargetDatabaseNames.filter(t => t.value === c.value).length > 1) { //Making sure no databases have duplicate values.
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
					this.validateFields();
				});
				this._networkShareTargetDatabaseNames.push(targetDatabaseInput);

				const blobtargetDatabaseInput = this._view.modelBuilder.inputBox().withProps({
					required: true,
					value: db,
					width: WIZARD_TABLE_COLUMN_WIDTH
				}).withValidation(c => {
					if (this._blobContainerTargetDatabaseNames.filter(t => t.value === c.value).length > 1) { //Making sure no databases have duplicate values.
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
				blobtargetDatabaseInput.onTextChanged((value) => {
					this.migrationStateModel._targetDatabaseNames[index] = value.trim();
				});
				this._blobContainerTargetDatabaseNames.push(blobtargetDatabaseInput);

				const blobContainerResourceDropdown = this._view.modelBuilder.dropDown().withProps({
					width: WIZARD_TABLE_COLUMN_WIDTH,
					editable: true,
					fireOnTextChange: true,
				}).component();
				blobContainerResourceDropdown.onValueChanged(async (value) => {
					const selectedIndex = findDropDownItemIndex(blobContainerResourceDropdown, value);
					if (selectedIndex > -1 && value !== constants.RESOURCE_GROUP_NOT_FOUND) {
						this.migrationStateModel._databaseBackup.blobs[index].resourceGroup = this.migrationStateModel.getAzureResourceGroup(selectedIndex);
					}

					await this.loadblobStorageDropdown(index);
				});
				this._blobContainerResourceGroupDropdowns.push(blobContainerResourceDropdown);

				const blobContainerStorageAccountDropdown = this._view.modelBuilder.dropDown()
					.withProps({
						width: WIZARD_TABLE_COLUMN_WIDTH,
						editable: true,
						fireOnTextChange: true,
					}).component();

				blobContainerStorageAccountDropdown.onValueChanged(async (value) => {
					const selectedIndex = findDropDownItemIndex(blobContainerStorageAccountDropdown, value);
					if (selectedIndex > -1 && value !== constants.NO_STORAGE_ACCOUNT_FOUND) {
						this.migrationStateModel._databaseBackup.blobs[index].storageAccount = this.migrationStateModel.getStorageAccount(selectedIndex);
					}
					await this.loadBlobContainerDropdown(index);
				});
				this._blobContainerStorageAccountDropdowns.push(blobContainerStorageAccountDropdown);

				const blobContainerDropdown = this._view.modelBuilder.dropDown()
					.withProps({
						width: WIZARD_TABLE_COLUMN_WIDTH,
						editable: true,
						fireOnTextChange: true,
					}).component();
				blobContainerDropdown.onValueChanged(value => {
					const selectedIndex = findDropDownItemIndex(blobContainerDropdown, value);
					if (selectedIndex > -1 && value !== constants.NO_BLOBCONTAINERS_FOUND) {
						this.migrationStateModel._databaseBackup.blobs[index].blobContainer = this.migrationStateModel.getBlobContainer(selectedIndex);
					}
				});
				this._blobContainerDropdowns.push(blobContainerDropdown);
			});


			let data: azdata.DeclarativeTableCellValue[][] = [];
			this.migrationStateModel._migrationDbs.forEach((db, index) => {
				const targetRow: azdata.DeclarativeTableCellValue[] = [];
				targetRow.push({
					value: db
				});
				targetRow.push({
					value: this._networkShareTargetDatabaseNames[index]
				});
				data.push(targetRow);
			});
			this._newtworkShareTargetDatabaseNamesTable.dataValues = data;

			data = [];

			this.migrationStateModel._migrationDbs.forEach((db, index) => {
				const targetRow: azdata.DeclarativeTableCellValue[] = [];
				targetRow.push({
					value: db
				});
				targetRow.push({
					value: this._blobContainerTargetDatabaseNames[index]
				});
				targetRow.push({
					value: this._blobContainerResourceGroupDropdowns[index]
				});
				targetRow.push({
					value: this._blobContainerStorageAccountDropdowns[index]
				});
				targetRow.push({
					value: this._blobContainerDropdowns[index]
				});
				data.push(targetRow);
			});
			this._blobContainerTargetDatabaseNamesTable.dataValues = data;

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
					this._blobContainerResourceGroupDropdowns.forEach(v => {
						if ((<azdata.CategoryValue>v.value).displayName === constants.RESOURCE_GROUP_NOT_FOUND) {
							errors.push(constants.INVALID_RESOURCE_GROUP_ERROR);
						}
					});
					this._blobContainerStorageAccountDropdowns.forEach(v => {
						if ((<azdata.CategoryValue>v.value).displayName === constants.NO_STORAGE_ACCOUNT_FOUND) {
							errors.push(constants.INVALID_STORAGE_ACCOUNT_ERROR);
						}
					});
					this._blobContainerDropdowns.forEach(v => {
						if ((<azdata.CategoryValue>v.value).displayName === constants.NO_BLOBCONTAINERS_FOUND) {
							errors.push(constants.INVALID_BLOBCONTAINER_ERROR);
						}
					});

					if (errors.length > 0) {
						const duplicates: Map<string, number[]> = new Map();
						for (let i = 0; i < this.migrationStateModel._targetDatabaseNames.length; i++) {
							const blobContainerId = this.migrationStateModel._databaseBackup.blobs[i].blobContainer?.id;
							if (duplicates.has(blobContainerId)) {
								duplicates.get(blobContainerId)?.push(i);
							} else {
								duplicates.set(blobContainerId, [i]);
							}
						}
						duplicates.forEach((d) => {
							if (d.length > 1) {
								const dupString = `${d.map(index => this.migrationStateModel._migrationDbs[index]).join(', ')}`;
								errors.push(constants.PROVIDE_UNIQUE_CONTAINERS + dupString);
							}
						});
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
			switch (this.migrationStateModel._databaseBackup.networkContainerType) {
				case NetworkContainerType.BLOB_CONTAINER:
					for (let i = 0; i < this.migrationStateModel._databaseBackup.blobs.length; i++) {
						const storageAccount = this.migrationStateModel._databaseBackup.blobs[i].storageAccount;
						this.migrationStateModel._databaseBackup.blobs[i].storageKey = (await getStorageAccountAccessKeys(
							this.migrationStateModel._azureAccount,
							this.migrationStateModel._databaseBackup.subscription,
							storageAccount)).keyName1;
					}
					break;
				case NetworkContainerType.NETWORK_SHARE:
					const storageAccount = this.migrationStateModel._databaseBackup.networkShare.storageAccount;

					this.migrationStateModel._databaseBackup.networkShare.storageKey = (await getStorageAccountAccessKeys(
						this.migrationStateModel._azureAccount,
						this.migrationStateModel._databaseBackup.subscription,
						storageAccount)).keyName1;
					break;
			}
		} finally {
			this.wizard.registerNavigationValidator((pageChangeInfo) => {
				return true;
			});
		}
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private switchNetworkContainerFields(containerType: NetworkContainerType): void {
		this.wizard.message = {
			text: '',
			level: azdata.window.MessageLevel.Error
		};

		this.wizard.nextButton.enabled = true;
		this.migrationStateModel._databaseBackup.networkContainerType = containerType;
		this._blobContainer.updateCssStyles({ 'display': (containerType === NetworkContainerType.BLOB_CONTAINER) ? 'inline' : 'none' });
		this._networkShareContainer.updateCssStyles({ 'display': (containerType === NetworkContainerType.NETWORK_SHARE) ? 'inline' : 'none' });
		this._networkShareStorageAccountDetails.updateCssStyles({ 'display': (containerType === NetworkContainerType.NETWORK_SHARE) ? 'inline' : 'none' });
		this._targetDatabaseContainer.updateCssStyles({ 'display': 'inline' });
		this._networkTableContainer.display = (containerType === NetworkContainerType.NETWORK_SHARE) ? 'inline' : 'none';
		this._blobTableContainer.display = (containerType === NetworkContainerType.BLOB_CONTAINER) ? 'inline' : 'none';

		//Preserving the database Names between the 2 tables.
		this.migrationStateModel._targetDatabaseNames.forEach((v, index) => {
			this._networkShareTargetDatabaseNames[index].value = v;
			this._blobContainerTargetDatabaseNames[index].value = v;
		});

		this._windowsUserAccountText.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
		this._passwordText.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
		this._sqlSourceUsernameInput.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
		this._sqlSourcepassword.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
		this.validateFields();
	}


	private async validateFields(): Promise<void> {
		await this._sqlSourceUsernameInput.validate();
		await this._sqlSourcepassword.validate();
		await this._networkSharePath.validate();
		await this._windowsUserAccountText.validate();
		await this._passwordText.validate();
		await this._networkShareContainerSubscription.validate();
		await this._networkShareStorageAccountResourceGroupDropdown.validate();
		await this._networkShareContainerStorageAccountDropdown.validate();
		await this._blobContainerSubscription.validate();
		for (let i = 0; i < this._networkShareTargetDatabaseNames.length; i++) {
			await this._networkShareTargetDatabaseNames[i].validate();
			await this._blobContainerTargetDatabaseNames[i].validate();
			await this._blobContainerResourceGroupDropdowns[i].validate();
			await this._blobContainerStorageAccountDropdowns[i].validate();
			await this._blobContainerDropdowns[i].validate();
		}
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
			selectDropDownIndex(this._networkShareStorageAccountResourceGroupDropdown, 0);
		} catch (error) {
			console.log(error);
		} finally {
			this._networkShareStorageAccountResourceGroupDropdown.loading = false;
			await this.loadNetworkShareStorageDropdown();
		}
	}

	private async loadNetworkShareStorageDropdown(): Promise<void> {
		this._networkShareContainerStorageAccountDropdown.loading = true;
		try {
			this._networkShareContainerStorageAccountDropdown.values = await this.migrationStateModel.getStorageAccountValues(this.migrationStateModel._databaseBackup.subscription, this.migrationStateModel._databaseBackup.networkShare.resourceGroup);
			selectDropDownIndex(this._networkShareContainerStorageAccountDropdown, 0);
		} catch (error) {
			console.log(error);
		} finally {
			this._networkShareContainerStorageAccountDropdown.loading = false;
		}
	}

	private async loadblobResourceGroup(): Promise<void> {
		this._blobContainerResourceGroupDropdowns.forEach(v => v.loading = true);
		try {
			const resourceGroupValues = await this.migrationStateModel.getAzureResourceGroupDropdownValues(this.migrationStateModel._databaseBackup.subscription);
			this._blobContainerResourceGroupDropdowns.forEach(dropDown => {
				dropDown.values = resourceGroupValues;
				selectDropDownIndex(dropDown, 0);
			});
		} catch (error) {
			console.log(error);
		} finally {
			this._blobContainerResourceGroupDropdowns.forEach(v => v.loading = false);
		}
	}

	private async loadblobStorageDropdown(index: number): Promise<void> {
		this._blobContainerStorageAccountDropdowns[index].loading = true;
		try {
			this._blobContainerStorageAccountDropdowns[index].values = await this.migrationStateModel.getStorageAccountValues(this.migrationStateModel._databaseBackup.subscription, this.migrationStateModel._databaseBackup.blobs[index].resourceGroup);
			selectDropDownIndex(this._blobContainerStorageAccountDropdowns[index], 0);
		} catch (error) {
			console.log(error);
		} finally {
			this._blobContainerStorageAccountDropdowns[index].loading = false;
		}
	}

	private async loadBlobContainerDropdown(index: number): Promise<void> {
		this._blobContainerDropdowns[index].loading = true;
		try {
			const blobContainerValues = await this.migrationStateModel.getBlobContainerValues(this.migrationStateModel._databaseBackup.subscription, this.migrationStateModel._databaseBackup.blobs[index].storageAccount);
			this._blobContainerDropdowns[index].values = blobContainerValues;
			selectDropDownIndex(this._blobContainerDropdowns[index], 0);
		} catch (error) {
			console.log(error);
		} finally {
			this._blobContainerDropdowns[index].loading = false;
		}
	}

}
