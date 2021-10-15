/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { EOL } from 'os';
import { getStorageAccountAccessKeys, SqlManagedInstance, SqlVMServer } from '../api/azure';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { Blob, MigrationMode, MigrationSourceAuthenticationType, MigrationStateModel, MigrationTargetType, NetworkContainerType, Page, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { IconPathHelper } from '../constants/iconPathHelper';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import { findDropDownItemIndex, selectDropDownIndex } from '../api/utils';
import { azureResource } from 'azureResource';
import * as styles from '../constants/styles';

const WIZARD_TABLE_COLUMN_WIDTH = '200px';
const WIZARD_TABLE_COLUMN_WIDTH_SMALL = '170px';

const blobResourceGroupErrorStrings = [constants.RESOURCE_GROUP_NOT_FOUND];
const blobStorageAccountErrorStrings = [constants.NO_STORAGE_ACCOUNT_FOUND, constants.SELECT_RESOURCE_GROUP_PROMPT];
const blobContainerErrorStrings = [constants.NO_BLOBCONTAINERS_FOUND, constants.SELECT_STORAGE_ACCOUNT];
const blobFileErrorStrings = [constants.NO_BLOBFILES_FOUND, constants.SELECT_BLOB_CONTAINER];

export class DatabaseBackupPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;

	private _networkShareButton!: azdata.RadioButtonComponent;
	private _blobContainerButton!: azdata.RadioButtonComponent;

	private _networkShareContainer!: azdata.FlexContainer;
	private _windowsUserAccountText!: azdata.InputBoxComponent;
	private _passwordText!: azdata.InputBoxComponent;
	private _networkSharePath!: azdata.InputBoxComponent;
	private _sourceHelpText!: azdata.TextComponent;
	private _sqlSourceUsernameInput!: azdata.InputBoxComponent;
	private _sqlSourcePassword!: azdata.InputBoxComponent;

	private _blobContainer!: azdata.FlexContainer;
	private _blobContainerSubscription!: azdata.TextComponent;
	private _blobContainerLocation!: azdata.TextComponent;
	private _blobContainerResourceGroupDropdowns!: azdata.DropDownComponent[];
	private _blobContainerStorageAccountDropdowns!: azdata.DropDownComponent[];
	private _blobContainerDropdowns!: azdata.DropDownComponent[];
	private _blobContainerLastBackupFileDropdowns!: azdata.DropDownComponent[];

	private _networkShareStorageAccountDetails!: azdata.FlexContainer;
	private _networkShareContainerSubscription!: azdata.TextComponent;
	private _networkShareContainerLocation!: azdata.TextComponent;
	private _networkShareStorageAccountResourceGroupDropdown!: azdata.DropDownComponent;
	private _networkShareContainerStorageAccountDropdown!: azdata.DropDownComponent;
	private _networkShareContainerStorageAccountRefreshButton!: azdata.ButtonComponent;

	private _targetDatabaseContainer!: azdata.FlexContainer;
	private _networkShareTargetDatabaseNamesTable!: azdata.DeclarativeTableComponent;
	private _blobContainerTargetDatabaseNamesTable!: azdata.DeclarativeTableComponent;
	private _networkTableContainer!: azdata.FlexContainer;
	private _blobTableContainer!: azdata.FlexContainer;
	private _networkShareTargetDatabaseNames: azdata.InputBoxComponent[] = [];
	private _blobContainerTargetDatabaseNames: azdata.InputBoxComponent[] = [];

	private _existingDatabases: string[] = [];
	private _disposables: vscode.Disposable[] = [];

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
			).withProps({
				CSSStyles: {
					'padding-top': '0'
				}
			}).component();

		this._disposables.push(this._view.onClosed(e => {
			this._disposables.forEach(
				d => { try { d.dispose(); } catch { } });
		}));

		await view.initializeModel(form);
	}

	private createBackupLocationComponent(): azdata.FlexContainer {
		const buttonGroup = 'networkContainer';

		const selectLocationText = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_PAGE_DESCRIPTION,
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		this._networkShareButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.DATABASE_BACKUP_NC_NETWORK_SHARE_RADIO_LABEL,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '0'
				}
			}).component();

		this._disposables.push(this._networkShareButton.onDidChangeCheckedState(async (e) => {
			if (e) {
				await this.switchNetworkContainerFields(NetworkContainerType.NETWORK_SHARE);
			}
		}));

		this._blobContainerButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.DATABASE_BACKUP_NC_BLOB_STORAGE_RADIO_LABEL,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '0'
				}
			}).component();

		this._disposables.push(this._blobContainerButton.onDidChangeCheckedState(async (e) => {
			if (e) {
				await this.switchNetworkContainerFields(NetworkContainerType.BLOB_CONTAINER);
			}
		}));

		const flexContainer = this._view.modelBuilder.flexContainer().withItems(
			[
				selectLocationText,
				this._networkShareButton,
				this._blobContainerButton
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
				...styles.SECTION_HEADER_CSS,
				'margin-top': '4px'
			}
		}).component();

		this._sourceHelpText = this._view.modelBuilder.text().withProps({
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		const usernameLabel = this._view.modelBuilder.text().withProps({
			value: constants.USERNAME,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();
		this._sqlSourceUsernameInput = this._view.modelBuilder.inputBox().withProps({
			required: true,
			enabled: false,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'margin-top': '-1em'
			},
		}).component();
		this._disposables.push(this._sqlSourceUsernameInput.onTextChanged(value => {
			this.migrationStateModel._sqlServerUsername = value;
		}));

		const sqlPasswordLabel = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_LABEL,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();
		this._sqlSourcePassword = this._view.modelBuilder.inputBox().withProps({
			required: true,
			inputType: 'password',
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'margin-top': '-1em'
			},
		}).component();
		this._disposables.push(this._sqlSourcePassword.onTextChanged(value => {
			this.migrationStateModel._sqlServerPassword = value;
		}));


		const networkShareHeading = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_HEADER_TEXT,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				...styles.SECTION_HEADER_CSS,
				'margin-top': '24px'
			}
		}).component();

		const networkShareHelpText = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NC_NETWORK_SHARE_HELP_TEXT,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		const networkLocationInputBoxLabel = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_LOCATION_LABEL,
			description: constants.DATABASE_BACKUP_NETWORK_SHARE_LOCATION_INFO,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();
		this._networkSharePath = this._view.modelBuilder.inputBox().withProps({
			placeHolder: constants.NETWORK_SHARE_PATH,
			validationErrorMessage: constants.INVALID_NETWORK_SHARE_LOCATION,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'margin-top': '-1em'
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
		if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.MigrationMode) {
			this._networkSharePath.value = this.migrationStateModel.savedInfo.networkShare?.networkShareLocation;
		}
		this._disposables.push(this._networkSharePath.onTextChanged(async (value) => {
			await this.validateFields();
			this.migrationStateModel._databaseBackup.networkShare.networkShareLocation = value;
		}));

		const networkShareInfoBox = this._view.modelBuilder.infoBox().withProps({
			text: constants.DATABASE_SERVICE_ACCOUNT_INFO_TEXT,
			style: 'information',
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		const windowsUserAccountLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_WINDOWS_USER_LABEL,
				description: constants.DATABASE_BACKUP_NETWORK_SHARE_WINDOWS_USER_INFO,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: {
					...styles.LABEL_CSS
				}
			}).component();
		this._windowsUserAccountText = this._view.modelBuilder.inputBox()
			.withProps({
				placeHolder: constants.WINDOWS_USER_ACCOUNT,
				required: true,
				validationErrorMessage: constants.INVALID_USER_ACCOUNT,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin-top': '-1em'
				}
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
		if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.DatabaseBackup) {
			this._windowsUserAccountText.value = this.migrationStateModel.savedInfo.networkShare?.windowsUser;
		}
		this._disposables.push(this._windowsUserAccountText.onTextChanged((value) => {
			this.migrationStateModel._databaseBackup.networkShare.windowsUser = value;
		}));

		const passwordLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_LABEL,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: {
					...styles.LABEL_CSS,
				}
			}).component();
		this._passwordText = this._view.modelBuilder.inputBox()
			.withProps({
				placeHolder: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_PLACEHOLDER,
				inputType: 'password',
				required: true,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin-top': '-1em'
				}
			}).component();
		this._disposables.push(this._passwordText.onTextChanged((value) => {
			this.migrationStateModel._databaseBackup.networkShare.password = value;
		}));

		const flexContainer = this._view.modelBuilder.flexContainer().withItems(
			[
				sqlSourceHeader,
				this._sourceHelpText,
				usernameLabel,
				this._sqlSourceUsernameInput,
				sqlPasswordLabel,
				this._sqlSourcePassword,
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
		const blobHeading = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_BLOB_STORAGE_HEADER_TEXT,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				...styles.SECTION_HEADER_CSS
			}
		}).component();

		const blobHelpText = this._view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_BLOB_STORAGE_HELP_TEXT,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin-bottom': '12px'
			}
		}).component();

		const subscriptionLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_BLOB_STORAGE_SUBSCRIPTION_LABEL,
				CSSStyles: {
					...styles.LABEL_CSS
				}
			}).component();
		this._blobContainerSubscription = this._view.modelBuilder.text()
			.withProps({
				enabled: false,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '0 0 12px 0'
				}
			}).component();

		const locationLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.LOCATION,
				CSSStyles: {
					...styles.LABEL_CSS
				}
			}).component();
		this._blobContainerLocation = this._view.modelBuilder.text()
			.withProps({
				enabled: false,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '0px'
				}
			}).component();

		const flexContainer = this._view.modelBuilder.flexContainer()
			.withItems(
				[
					blobHeading,
					blobHelpText,
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
			...styles.LABEL_CSS,
			'border': 'none',
			'text-align': 'left',
			'box-shadow': 'inset 0px -1px 0px #F3F2F1',

		};
		const rowCssStyle: azdata.CssStyles = {
			...styles.BODY_CSS,
			'border': 'none',
			'font-size': '13px',
			'box-shadow': 'inset 0px -1px 0px #F3F2F1',
		};

		const networkShareTableText = this._view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_TABLE_HELP_TEXT,
				CSSStyles: {
					...styles.SECTION_HEADER_CSS,
					'margin-top': '8px'
				}
			}).component();

		const blobTableText = this._view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_BLOB_STORAGE_TABLE_HELP_TEXT,
				CSSStyles: {
					...styles.SECTION_HEADER_CSS
				}
			}).component();

		this._networkShareTargetDatabaseNamesTable = this._view.modelBuilder.declarativeTable().withProps({
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
				},
				{
					displayName: constants.BLOB_CONTAINER_LAST_BACKUP_FILE,
					valueType: azdata.DeclarativeDataType.component,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles,
					isReadOnly: true,
					width: WIZARD_TABLE_COLUMN_WIDTH,
					hidden: true
				}
			]
		}).component();

		this._networkTableContainer = this._view.modelBuilder.flexContainer().withItems([
			networkShareTableText,
			this._networkShareTargetDatabaseNamesTable
		]).component();

		const allFieldsRequiredLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.ALL_FIELDS_REQUIRED,
				CSSStyles: {
					...styles.BODY_CSS
				}
			}).component();

		this._blobTableContainer = this._view.modelBuilder.flexContainer().withItems([
			blobTableText,
			allFieldsRequiredLabel,
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
					...styles.SECTION_HEADER_CSS,
					'margin-top': '12px'
				}
			}).component();

		const azureAccountHelpText = this._view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_NETWORK_SHARE_AZURE_ACCOUNT_HELP,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin-bottom': '12px'
				}
			}).component();

		const subscriptionLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.SUBSCRIPTION,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					...styles.LABEL_CSS,
					'margin': '0'
				}
			}).component();
		this._networkShareContainerSubscription = this._view.modelBuilder.text()
			.withProps({
				enabled: false,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					'margin': '0'
				}
			}).component();

		const locationLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.LOCATION,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					...styles.LABEL_CSS,
					'margin': '12px 0 0'
				}
			}).component();
		this._networkShareContainerLocation = this._view.modelBuilder.text()
			.withProps({
				enabled: false,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					'margin': '0'
				}
			}).component();

		const resourceGroupLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.RESOURCE_GROUP,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: {
					...styles.LABEL_CSS
				}
			}).component();
		this._networkShareStorageAccountResourceGroupDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				required: true,
				ariaLabel: constants.RESOURCE_GROUP,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				fireOnTextChange: true,
				CSSStyles: {
					'margin-top': '-1em'
				},
			}).component();
		this._disposables.push(this._networkShareStorageAccountResourceGroupDropdown.onValueChanged(async (value) => {
			const selectedIndex = findDropDownItemIndex(this._networkShareStorageAccountResourceGroupDropdown, value);
			if (selectedIndex > -1) {
				this.migrationStateModel._databaseBackup.networkShare.resourceGroup = this.migrationStateModel.getAzureResourceGroup(selectedIndex);
				await this.loadNetworkShareStorageDropdown();
			}
		}));

		const storageAccountLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.STORAGE_ACCOUNT,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: {
					...styles.LABEL_CSS
				}
			}).component();
		this._networkShareContainerStorageAccountDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.STORAGE_ACCOUNT,
				required: true,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				fireOnTextChange: true,
			}).component();
		this._disposables.push(this._networkShareContainerStorageAccountDropdown.onValueChanged((value) => {
			const selectedIndex = findDropDownItemIndex(this._networkShareContainerStorageAccountDropdown, value);
			if (selectedIndex > -1) {
				this.migrationStateModel._databaseBackup.networkShare.storageAccount = this.migrationStateModel.getStorageAccount(selectedIndex);
			}
		}));

		this._networkShareContainerStorageAccountRefreshButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh,
			iconHeight: 18,
			iconWidth: 18,
			height: 25,
			ariaLabel: constants.REFRESH,
		}).component();

		this._disposables.push(this._networkShareContainerStorageAccountRefreshButton.onDidClick(async (value) => {
			await this.loadNetworkShareStorageDropdown();
		}));

		const storageAccountContainer = this._view.modelBuilder.flexContainer()
			.withProps({
				CSSStyles: {
					'margin-top': '-1em'
				}
			}).component();

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


	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		if (this.migrationStateModel.refreshDatabaseBackupPage) {
			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.DatabaseBackup) {
				this.migrationStateModel._migrationDbs = this.migrationStateModel.savedInfo.databaseList;
			}
			const isOfflineMigration = this.migrationStateModel._databaseBackup?.migrationMode === MigrationMode.OFFLINE;
			const lastBackupFileColumnIndex = this._blobContainerTargetDatabaseNamesTable.columns.length - 1;
			this._blobContainerTargetDatabaseNamesTable.columns[lastBackupFileColumnIndex].hidden = !isOfflineMigration;
			this._blobContainerTargetDatabaseNamesTable.columns.forEach(column => {
				column.width = isOfflineMigration ? WIZARD_TABLE_COLUMN_WIDTH_SMALL : WIZARD_TABLE_COLUMN_WIDTH;
			});

			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.MigrationMode) {
				if (this.migrationStateModel.savedInfo.networkContainerType === NetworkContainerType.NETWORK_SHARE) {
					this._networkShareButton.checked = true;
				} else {
					this._networkShareButton.checked = false;
					this._networkTableContainer.display = 'none';
					await this._networkShareContainer.updateCssStyles({ 'display': 'none' });
				}
			} else {
				this._networkShareButton.checked = false;
				this._networkTableContainer.display = 'none';
				await this._networkShareContainer.updateCssStyles({ 'display': 'none' });
			}

			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.MigrationMode) {
				if (this.migrationStateModel.savedInfo.networkContainerType === NetworkContainerType.BLOB_CONTAINER) {
					this._blobContainerButton.checked = true;
				} else {
					this._blobContainerButton.checked = false;
					this._blobTableContainer.display = 'none';
					await this._blobContainer.updateCssStyles({ 'display': 'none' });
				}
			} else {
				this._blobContainerButton.checked = false;
				this._blobTableContainer.display = 'none';
				await this._blobContainer.updateCssStyles({ 'display': 'none' });
			}

			await this._targetDatabaseContainer.updateCssStyles({ 'display': 'none' });
			await this._networkShareStorageAccountDetails.updateCssStyles({ 'display': 'none' });
			const connectionProfile = await this.migrationStateModel.getSourceConnectionProfile();
			const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>((await this.migrationStateModel.getSourceConnectionProfile()).providerId, azdata.DataProviderType.QueryProvider);
			const query = 'select SUSER_NAME()';
			const results = await queryProvider.runQueryAndReturn(await (azdata.connection.getUriForConnection(this.migrationStateModel.sourceConnectionId)), query);
			const username = results.rows[0][0].displayValue;
			this.migrationStateModel._authenticationType = connectionProfile.authenticationType === 'SqlLogin' ? MigrationSourceAuthenticationType.Sql : connectionProfile.authenticationType === 'Integrated' ? MigrationSourceAuthenticationType.Integrated : undefined!;
			this._sourceHelpText.value = constants.SQL_SOURCE_DETAILS(this.migrationStateModel._authenticationType, connectionProfile.serverName);
			this._sqlSourceUsernameInput.value = username;
			this._sqlSourcePassword.value = (await azdata.connection.getCredentials(this.migrationStateModel.sourceConnectionId)).password;

			this._networkShareTargetDatabaseNames = [];
			this._blobContainerTargetDatabaseNames = [];
			this._blobContainerResourceGroupDropdowns = [];
			this._blobContainerStorageAccountDropdowns = [];
			this._blobContainerDropdowns = [];
			this._blobContainerLastBackupFileDropdowns = [];

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
				this._disposables.push(targetDatabaseInput.onTextChanged(async (value) => {
					this.migrationStateModel._targetDatabaseNames[index] = value.trim();
					await this.validateFields();
				}));
				if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.DatabaseBackup) {
					targetDatabaseInput.value = this.migrationStateModel.savedInfo.targetDatabaseNames[index];
				} else {
					targetDatabaseInput.value = this.migrationStateModel._targetDatabaseNames[index];
				}
				this._networkShareTargetDatabaseNames.push(targetDatabaseInput);

				const blobTargetDatabaseInput = this._view.modelBuilder.inputBox().withProps({
					required: true,
					value: db,
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
				this._disposables.push(blobTargetDatabaseInput.onTextChanged((value) => {
					this.migrationStateModel._targetDatabaseNames[index] = value.trim();
				}));
				if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.DatabaseBackup) {
					blobTargetDatabaseInput.value = this.migrationStateModel.savedInfo.targetDatabaseNames[index];
				} else {
					targetDatabaseInput.value = this.migrationStateModel._targetDatabaseNames[index];
				}
				this._blobContainerTargetDatabaseNames.push(blobTargetDatabaseInput);

				const blobContainerResourceDropdown = this._view.modelBuilder.dropDown().withProps({
					ariaLabel: constants.BLOB_CONTAINER_RESOURCE_GROUP,
					editable: true,
					fireOnTextChange: true,
					required: true,
				}).component();

				const blobContainerStorageAccountDropdown = this._view.modelBuilder.dropDown().withProps({
					ariaLabel: constants.BLOB_CONTAINER_STORAGE_ACCOUNT,
					editable: true,
					fireOnTextChange: true,
					required: true,
					enabled: false,
				}).component();

				const blobContainerDropdown = this._view.modelBuilder.dropDown().withProps({
					ariaLabel: constants.BLOB_CONTAINER,
					editable: true,
					fireOnTextChange: true,
					required: true,
					enabled: false,
				}).component();

				const blobContainerLastBackupFileDropdown = this._view.modelBuilder.dropDown().withProps({
					ariaLabel: constants.BLOB_CONTAINER_LAST_BACKUP_FILE,
					editable: true,
					fireOnTextChange: true,
					required: true,
					enabled: false,
				}).component();

				this._disposables.push(blobContainerResourceDropdown.onValueChanged(async (value) => {
					const selectedIndex = findDropDownItemIndex(blobContainerResourceDropdown, value);
					if (selectedIndex > -1 && !blobResourceGroupErrorStrings.includes(value)) {
						this.migrationStateModel._databaseBackup.blobs[index].resourceGroup = this.migrationStateModel.getAzureResourceGroup(selectedIndex);
						await this.loadBlobStorageDropdown(index);
						await blobContainerStorageAccountDropdown.updateProperties({ enabled: true });
					} else {
						await this.disableBlobTableDropdowns(index, constants.RESOURCE_GROUP);
					}
				}));
				this._blobContainerResourceGroupDropdowns.push(blobContainerResourceDropdown);

				this._disposables.push(blobContainerStorageAccountDropdown.onValueChanged(async (value) => {
					const selectedIndex = findDropDownItemIndex(blobContainerStorageAccountDropdown, value);
					if (selectedIndex > -1 && !blobStorageAccountErrorStrings.includes(value)) {
						this.migrationStateModel._databaseBackup.blobs[index].storageAccount = this.migrationStateModel.getStorageAccount(selectedIndex);
						await this.loadBlobContainerDropdown(index);
						await blobContainerDropdown.updateProperties({ enabled: true });
					} else {
						await this.disableBlobTableDropdowns(index, constants.STORAGE_ACCOUNT);
					}
				}));
				this._blobContainerStorageAccountDropdowns.push(blobContainerStorageAccountDropdown);

				this._disposables.push(blobContainerDropdown.onValueChanged(async (value) => {
					const selectedIndex = findDropDownItemIndex(blobContainerDropdown, value);
					if (selectedIndex > -1 && !blobContainerErrorStrings.includes(value)) {
						this.migrationStateModel._databaseBackup.blobs[index].blobContainer = this.migrationStateModel.getBlobContainer(selectedIndex);
						if (this.migrationStateModel._databaseBackup.migrationMode === MigrationMode.OFFLINE) {
							await this.loadBlobLastBackupFileDropdown(index);
							await blobContainerLastBackupFileDropdown.updateProperties({ enabled: true });
						}
					} else {
						await this.disableBlobTableDropdowns(index, constants.BLOB_CONTAINER);
					}
				}));
				this._blobContainerDropdowns.push(blobContainerDropdown);

				if (this.migrationStateModel._databaseBackup.migrationMode === MigrationMode.OFFLINE) {
					this._disposables.push(blobContainerLastBackupFileDropdown.onValueChanged(value => {
						const selectedIndex = findDropDownItemIndex(blobContainerLastBackupFileDropdown, value);
						if (selectedIndex > -1 && !blobFileErrorStrings.includes(value)) {
							this.migrationStateModel._databaseBackup.blobs[index].lastBackupFile = this.migrationStateModel.getBlobLastBackupFileName(selectedIndex);
						}
					}));
					this._blobContainerLastBackupFileDropdowns.push(blobContainerLastBackupFileDropdown);
				}
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
			this._networkShareTargetDatabaseNamesTable.dataValues = data;

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
				targetRow.push({
					value: this._blobContainerLastBackupFileDropdowns[index]
				});
				data.push(targetRow);
			});
			await this._blobContainerTargetDatabaseNamesTable.setDataValues(data);

			await this.getSubscriptionValues();
			this.migrationStateModel.refreshDatabaseBackupPage = false;
		}

		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}

			const errors: string[] = [];

			switch (this.migrationStateModel._databaseBackup.networkContainerType) {
				case NetworkContainerType.NETWORK_SHARE:
					if ((<azdata.CategoryValue>this._networkShareStorageAccountResourceGroupDropdown.value)?.displayName === constants.RESOURCE_GROUP_NOT_FOUND) {
						errors.push(constants.INVALID_RESOURCE_GROUP_ERROR);
					}
					if ((<azdata.CategoryValue>this._networkShareContainerStorageAccountDropdown.value)?.displayName === constants.NO_STORAGE_ACCOUNT_FOUND) {
						errors.push(constants.INVALID_STORAGE_ACCOUNT_ERROR);
					}
					break;
				case NetworkContainerType.BLOB_CONTAINER:
					this._blobContainerResourceGroupDropdowns.forEach((v, index) => {
						if (this.shouldDisplayBlobDropdownError(v, [constants.RESOURCE_GROUP_NOT_FOUND])) {
							errors.push(constants.INVALID_BLOB_RESOURCE_GROUP_ERROR(this.migrationStateModel._migrationDbs[index]));
						}
					});
					this._blobContainerStorageAccountDropdowns.forEach((v, index) => {
						if (this.shouldDisplayBlobDropdownError(v, [constants.NO_STORAGE_ACCOUNT_FOUND, constants.SELECT_RESOURCE_GROUP_PROMPT])) {
							errors.push(constants.INVALID_BLOB_STORAGE_ACCOUNT_ERROR(this.migrationStateModel._migrationDbs[index]));
						}
					});
					this._blobContainerDropdowns.forEach((v, index) => {
						if (this.shouldDisplayBlobDropdownError(v, [constants.NO_BLOBCONTAINERS_FOUND, constants.SELECT_STORAGE_ACCOUNT])) {
							errors.push(constants.INVALID_BLOB_CONTAINER_ERROR(this.migrationStateModel._migrationDbs[index]));
						}
					});

					if (this.migrationStateModel._databaseBackup.migrationMode === MigrationMode.OFFLINE) {
						this._blobContainerLastBackupFileDropdowns.forEach((v, index) => {
							if (this.shouldDisplayBlobDropdownError(v, [constants.NO_BLOBFILES_FOUND, constants.SELECT_BLOB_CONTAINER])) {
								errors.push(constants.INVALID_BLOB_LAST_BACKUP_FILE_ERROR(this.migrationStateModel._migrationDbs[index]));
							}
						});
					}

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

	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		try {
			if (pageChangeInfo.newPage > pageChangeInfo.lastPage) {
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
			}
		} finally {
			this.wizard.registerNavigationValidator((pageChangeInfo) => {
				return true;
			});
		}
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private async switchNetworkContainerFields(containerType: NetworkContainerType): Promise<void> {
		this.wizard.message = {
			text: '',
			level: azdata.window.MessageLevel.Error
		};

		this.wizard.nextButton.enabled = true;
		this.migrationStateModel._databaseBackup.networkContainerType = containerType;
		await this._blobContainer.updateCssStyles({ 'display': (containerType === NetworkContainerType.BLOB_CONTAINER) ? 'inline' : 'none' });
		await this._networkShareContainer.updateCssStyles({ 'display': (containerType === NetworkContainerType.NETWORK_SHARE) ? 'inline' : 'none' });
		await this._networkShareStorageAccountDetails.updateCssStyles({ 'display': (containerType === NetworkContainerType.NETWORK_SHARE) ? 'inline' : 'none' });
		await this._targetDatabaseContainer.updateCssStyles({ 'display': 'inline' });
		this._networkTableContainer.display = (containerType === NetworkContainerType.NETWORK_SHARE) ? 'inline' : 'none';
		this._blobTableContainer.display = (containerType === NetworkContainerType.BLOB_CONTAINER) ? 'inline' : 'none';

		//Preserving the database Names between the 2 tables.
		if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.DatabaseBackup) {
			this.migrationStateModel._targetDatabaseNames = this.migrationStateModel.savedInfo.targetDatabaseNames;
		}

		await this._windowsUserAccountText.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
		await this._passwordText.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
		await this._sqlSourceUsernameInput.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
		await this._sqlSourcePassword.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
		await this.validateFields();
	}


	private async validateFields(): Promise<void> {
		await this._sqlSourceUsernameInput.validate();
		await this._sqlSourcePassword.validate();
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

			if (this.migrationStateModel._databaseBackup.migrationMode === MigrationMode.OFFLINE) {
				await this._blobContainerLastBackupFileDropdowns[i]?.validate();
			}
		}
	}

	private async getSubscriptionValues(): Promise<void> {
		if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.DatabaseBackup) {
			this.migrationStateModel._targetSubscription = <azureResource.AzureResourceSubscription>this.migrationStateModel.savedInfo.targetSubscription;
			this.migrationStateModel._targetServerInstance = <SqlManagedInstance | SqlVMServer>this.migrationStateModel.savedInfo.targetServerInstance;
		}

		this._networkShareContainerSubscription.value = this.migrationStateModel._targetSubscription.name;
		this._networkShareContainerLocation.value = await this.migrationStateModel.getLocationDisplayName(this.migrationStateModel._targetServerInstance.location);

		this._blobContainerSubscription.value = this.migrationStateModel._targetSubscription.name;
		this._blobContainerLocation.value = await this.migrationStateModel.getLocationDisplayName(this.migrationStateModel._targetServerInstance.location);

		this.migrationStateModel._databaseBackup.subscription = this.migrationStateModel._targetSubscription;

		await this.loadNetworkStorageResourceGroup();
		await this.loadBlobResourceGroup();
	}

	private async loadNetworkStorageResourceGroup(): Promise<void> {
		this._networkShareStorageAccountResourceGroupDropdown.loading = true;
		try {
			this._networkShareStorageAccountResourceGroupDropdown.values = await this.migrationStateModel.getAzureResourceGroupDropdownValues(this.migrationStateModel._databaseBackup.subscription);
			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.DatabaseBackup && this._networkShareStorageAccountResourceGroupDropdown.values) {
				this._networkShareStorageAccountResourceGroupDropdown.values.forEach((resource, index) => {
					if ((<azdata.CategoryValue>resource).name.toLowerCase() === this.migrationStateModel.savedInfo?.networkShare?.resourceGroup.id.toLowerCase()) {
						selectDropDownIndex(this._networkShareStorageAccountResourceGroupDropdown, index);
					}
				});
			} else {
				selectDropDownIndex(this._networkShareStorageAccountResourceGroupDropdown, 0);
			}
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

	private async loadBlobResourceGroup(): Promise<void> {
		this._blobContainerResourceGroupDropdowns.forEach(v => v.loading = true);
		try {
			const resourceGroupValues = await this.migrationStateModel.getAzureResourceGroupDropdownValues(this.migrationStateModel._databaseBackup.subscription);
			this._blobContainerResourceGroupDropdowns.forEach((dropDown, index) => {
				dropDown.values = resourceGroupValues;
				if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.DatabaseBackup && dropDown.values) {
					dropDown.values.forEach((resource, resourceIndex) => {
						if ((<azdata.CategoryValue>resource).name.toLowerCase() === this.migrationStateModel.savedInfo?.blobs[index]?.resourceGroup.id.toLowerCase()) {
							selectDropDownIndex(dropDown, resourceIndex);
						}
					});
				} else {
					selectDropDownIndex(dropDown, 0);
				}
			});
		} catch (error) {
			console.log(error);
		} finally {
			this._blobContainerResourceGroupDropdowns.forEach(v => v.loading = false);
		}
	}

	private async loadBlobStorageDropdown(index: number): Promise<void> {
		this._blobContainerStorageAccountDropdowns[index].loading = true;
		try {
			this._blobContainerStorageAccountDropdowns[index].values = await this.migrationStateModel.getStorageAccountValues(this.migrationStateModel._databaseBackup.subscription, this.migrationStateModel._databaseBackup.blobs[index].resourceGroup);
			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.DatabaseBackup && this._blobContainerStorageAccountDropdowns[index].values && this.migrationStateModel.savedInfo.blobs[index].storageAccount) {
				this._blobContainerStorageAccountDropdowns[index].values!.forEach((resource, resourceIndex) => {
					if ((<azdata.CategoryValue>resource).name.toLowerCase() === this.migrationStateModel.savedInfo?.blobs[index]?.storageAccount.id.toLowerCase()) {
						selectDropDownIndex(this._blobContainerStorageAccountDropdowns[index], resourceIndex);
					}
				});
			} else {
				selectDropDownIndex(this._blobContainerStorageAccountDropdowns[index], 0);
			}
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
			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.DatabaseBackup && this._blobContainerDropdowns[index].values && this.migrationStateModel.savedInfo.blobs[index].blobContainer) {
				this._blobContainerDropdowns[index].values!.forEach((resource, resourceIndex) => {
					if ((<azdata.CategoryValue>resource).name.toLowerCase() === this.migrationStateModel.savedInfo?.blobs[index]?.blobContainer.id.toLowerCase()) {
						selectDropDownIndex(this._blobContainerDropdowns[index], resourceIndex);
					}
				});
			} else {
				selectDropDownIndex(this._blobContainerDropdowns[index], 0);
			}
		} catch (error) {
			console.log(error);
		} finally {
			this._blobContainerDropdowns[index].loading = false;
		}
	}

	private async loadBlobLastBackupFileDropdown(index: number): Promise<void> {
		this._blobContainerLastBackupFileDropdowns[index].loading = true;
		try {
			const blobLastBackupFileValues = await this.migrationStateModel.getBlobLastBackupFileNameValues(this.migrationStateModel._databaseBackup.subscription, this.migrationStateModel._databaseBackup.blobs[index].storageAccount, this.migrationStateModel._databaseBackup.blobs[index].blobContainer);
			this._blobContainerLastBackupFileDropdowns[index].values = blobLastBackupFileValues;
			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.DatabaseBackup && this._blobContainerLastBackupFileDropdowns[index].values && this.migrationStateModel.savedInfo.blobs[index].lastBackupFile) {
				this._blobContainerLastBackupFileDropdowns[index].values!.forEach((resource, resourceIndex) => {
					if ((<azdata.CategoryValue>resource).name.toLowerCase() === this.migrationStateModel.savedInfo?.blobs[index]?.lastBackupFile!.toLowerCase()) {
						selectDropDownIndex(this._blobContainerLastBackupFileDropdowns[index], resourceIndex);
					}
				});
			} else {
				selectDropDownIndex(this._blobContainerLastBackupFileDropdowns[index], 0);
			}
		} catch (error) {
			console.log(error);
		} finally {
			this._blobContainerLastBackupFileDropdowns[index].loading = false;
		}
	}

	private shouldDisplayBlobDropdownError(v: azdata.DropDownComponent, errorStrings: string[]) {
		return v.value === undefined || errorStrings.includes((<azdata.CategoryValue>v.value)?.displayName);
	}

	private async disableBlobTableDropdowns(rowIndex: number, columnName: string): Promise<void> {
		const dropdownProps = { enabled: false, loading: false };
		const createDropdownValuesWithPrereq = (displayName: string, name: string = '') => [{ displayName, name }];

		if (this.migrationStateModel._databaseBackup?.migrationMode === MigrationMode.OFFLINE) {
			this._blobContainerLastBackupFileDropdowns[rowIndex].values = createDropdownValuesWithPrereq(constants.SELECT_BLOB_CONTAINER);
			selectDropDownIndex(this._blobContainerLastBackupFileDropdowns[rowIndex], 0);
			await this._blobContainerLastBackupFileDropdowns[rowIndex]?.updateProperties(dropdownProps);
		}
		if (columnName === constants.BLOB_CONTAINER) { return; }

		this._blobContainerDropdowns[rowIndex].values = createDropdownValuesWithPrereq(constants.SELECT_STORAGE_ACCOUNT);
		selectDropDownIndex(this._blobContainerDropdowns[rowIndex], 0);
		await this._blobContainerDropdowns[rowIndex].updateProperties(dropdownProps);
		if (columnName === constants.STORAGE_ACCOUNT) { return; }

		this._blobContainerStorageAccountDropdowns[rowIndex].values = createDropdownValuesWithPrereq(constants.SELECT_RESOURCE_GROUP_PROMPT);
		selectDropDownIndex(this._blobContainerStorageAccountDropdowns[rowIndex], 0);
		await this._blobContainerStorageAccountDropdowns[rowIndex].updateProperties(dropdownProps);
	}
}
