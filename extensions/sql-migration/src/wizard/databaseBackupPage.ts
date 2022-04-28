/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { EOL } from 'os';
import { getStorageAccountAccessKeys } from '../api/azure';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { Blob, MigrationMode, MigrationSourceAuthenticationType, MigrationStateModel, MigrationTargetType, NetworkContainerType, NetworkShare, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { IconPathHelper } from '../constants/iconPathHelper';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import * as utils from '../api/utils';
import { logError, TelemetryViews } from '../telemtery';
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
	private _networkShareLocations: azdata.InputBoxComponent[] = [];

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

		const backupChecksumInfoBox = this._view.modelBuilder.infoBox().withProps({
			text: constants.DATABASE_BACKUP_CHECKSUM_INFO_TEXT,
			style: 'information',
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		this._networkShareButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.DATABASE_BACKUP_NC_NETWORK_SHARE_RADIO_LABEL,
				checked: this.migrationStateModel._databaseBackup.networkContainerType === NetworkContainerType.NETWORK_SHARE,
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
				checked: this.migrationStateModel._databaseBackup.networkContainerType === NetworkContainerType.BLOB_CONTAINER,
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
				backupChecksumInfoBox,
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
		this._disposables.push(this._windowsUserAccountText.onTextChanged((value) => {
			for (let i = 0; i < this.migrationStateModel._databaseBackup.networkShares.length; i++) {
				this.migrationStateModel._databaseBackup.networkShares[i].windowsUser = value;
			}
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
			for (let i = 0; i < this.migrationStateModel._databaseBackup.networkShares.length; i++) {
				this.migrationStateModel._databaseBackup.networkShares[i].password = value;
			}
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

		const azureStoragePrivateEndpointInfoBox = this._view.modelBuilder.infoBox().withProps({
			text: constants.DATABASE_BACKUP_PRIVATE_ENDPOINT_INFO_TEXT,
			style: 'information',
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				...styles.BODY_CSS
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
					width: WIZARD_TABLE_COLUMN_WIDTH
				},
				{
					displayName: constants.NETWORK_SHARE_PATH,
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
		]).withProps({
			CSSStyles: {
				'display': 'none',
			}
		}).component();

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
			azureStoragePrivateEndpointInfoBox,
			this._blobContainerTargetDatabaseNamesTable
		]).withProps({
			CSSStyles: {
				'display': 'none',
			}
		}).component();

		const container = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withItems([
			this._networkTableContainer,
			this._blobTableContainer
		]).withProps({
			CSSStyles: {
				'display': 'none',
			}
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

		const azureStoragePrivateEndpointInfoBox = this._view.modelBuilder.infoBox().withProps({
			text: constants.DATABASE_BACKUP_PRIVATE_ENDPOINT_INFO_TEXT,
			style: 'information',
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				...styles.BODY_CSS
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
			const selectedResourceGroup = this.migrationStateModel._resourceGroups.find(rg => rg.name === value);
			if (selectedResourceGroup) {
				for (let i = 0; i < this.migrationStateModel._databaseBackup.networkShares.length; i++) {
					this.migrationStateModel._databaseBackup.networkShares[i].resourceGroup = selectedResourceGroup;
				}
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
			const selectedStorageAccount = this.migrationStateModel._storageAccounts.find(sa => sa.name === value);
			if (selectedStorageAccount) {
				for (let i = 0; i < this.migrationStateModel._databaseBackup.networkShares.length; i++) {
					this.migrationStateModel._databaseBackup.networkShares[i].storageAccount = selectedStorageAccount;
				}
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
			azureStoragePrivateEndpointInfoBox,
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
			try {
				const isOfflineMigration = this.migrationStateModel._databaseBackup?.migrationMode === MigrationMode.OFFLINE;
				const lastBackupFileColumnIndex = this._blobContainerTargetDatabaseNamesTable.columns.length - 1;
				this._blobContainerTargetDatabaseNamesTable.columns[lastBackupFileColumnIndex].hidden = !isOfflineMigration;
				this._blobContainerTargetDatabaseNamesTable.columns.forEach(column => {
					column.width = isOfflineMigration ? WIZARD_TABLE_COLUMN_WIDTH_SMALL : WIZARD_TABLE_COLUMN_WIDTH;
				});

				await this.switchNetworkContainerFields(this.migrationStateModel._databaseBackup.networkContainerType);

				const connectionProfile = await this.migrationStateModel.getSourceConnectionProfile();
				const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(
					(await this.migrationStateModel.getSourceConnectionProfile()).providerId,
					azdata.DataProviderType.QueryProvider);

				const query = 'select SUSER_NAME()';
				const results = await queryProvider.runQueryAndReturn(
					await (azdata.connection.getUriForConnection(
						this.migrationStateModel.sourceConnectionId)), query);

				const username = results.rows[0][0].displayValue;
				this.migrationStateModel._authenticationType = connectionProfile.authenticationType === 'SqlLogin'
					? MigrationSourceAuthenticationType.Sql
					: connectionProfile.authenticationType === 'Integrated'
						? MigrationSourceAuthenticationType.Integrated
						: undefined!;
				this._sourceHelpText.value = constants.SQL_SOURCE_DETAILS(this.migrationStateModel._authenticationType, connectionProfile.serverName);
				this._sqlSourceUsernameInput.value = username;
				this._sqlSourcePassword.value = (await azdata.connection.getCredentials(this.migrationStateModel.sourceConnectionId)).password;
				this._windowsUserAccountText.value = this.migrationStateModel.savedInfo?.networkShares
					? this.migrationStateModel.savedInfo?.networkShares[0]?.windowsUser
					: '';

				this._networkShareTargetDatabaseNames = [];
				this._networkShareLocations = [];
				this._blobContainerTargetDatabaseNames = [];
				this._blobContainerResourceGroupDropdowns = [];
				this._blobContainerStorageAccountDropdowns = [];
				this._blobContainerDropdowns = [];
				this._blobContainerLastBackupFileDropdowns = [];

				if (this.migrationStateModel._targetType === MigrationTargetType.SQLMI) {
					this._existingDatabases = await this.migrationStateModel.getManagedDatabases();
				}

				let originalTargetDatabaseNames = this.migrationStateModel._targetDatabaseNames;
				let originalNetworkShares = this.migrationStateModel._databaseBackup.networkShares || [];
				let originalBlobs = this.migrationStateModel._databaseBackup.blobs;
				if (this.migrationStateModel._didUpdateDatabasesForMigration) {
					this.migrationStateModel._targetDatabaseNames = [];
					this.migrationStateModel._databaseBackup.networkShares = [];
					this.migrationStateModel._databaseBackup.blobs = [];
				}

				this.migrationStateModel._databasesForMigration.forEach((db, index) => {
					let targetDatabaseName = db;
					let networkShare = <NetworkShare>{};
					let blob = <Blob>{};

					if (this.migrationStateModel._didUpdateDatabasesForMigration) {
						const dbIndex = this.migrationStateModel._sourceDatabaseNames?.indexOf(db);
						if (dbIndex > -1) {
							targetDatabaseName = originalTargetDatabaseNames[dbIndex] ?? targetDatabaseName;
							networkShare = originalNetworkShares[dbIndex] ?? networkShare;
							blob = originalBlobs[dbIndex] ?? blob;
						} else {
							// network share values are uniform for all dbs in the same migration, except for networkShareLocation
							const previouslySelectedNetworkShare = originalNetworkShares.length > 0
								? originalNetworkShares[0]
								: '';

							if (previouslySelectedNetworkShare) {
								networkShare = {
									...previouslySelectedNetworkShare,
									networkShareLocation: '',
								};
							}
						}
					}
					this.migrationStateModel._targetDatabaseNames[index] = targetDatabaseName;
					this.migrationStateModel._databaseBackup.networkShares[index] = networkShare;
					this.migrationStateModel._databaseBackup.blobs[index] = blob;

					const targetDatabaseInput = this._view.modelBuilder.inputBox().withProps({
						required: true,
						value: targetDatabaseName,
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
					targetDatabaseInput.value = this.migrationStateModel._targetDatabaseNames[index];
					this._networkShareTargetDatabaseNames.push(targetDatabaseInput);

					const networkShareLocationInput = this._view.modelBuilder.inputBox().withProps({
						required: true,
						placeHolder: constants.NETWORK_SHARE_PATH_FORMAT,
						validationErrorMessage: constants.INVALID_NETWORK_SHARE_LOCATION,
						width: '300px'
					}).withValidation(c => {
						if (this.migrationStateModel._databaseBackup.networkContainerType === NetworkContainerType.NETWORK_SHARE) {
							if (c.value) {
								if (!/^[\\\/]{2,}[^\\\/]+[\\\/]+[^\\\/]+/.test(c.value)) {
									return false;
								}
							}
						}
						return true;
					}).component();
					this._disposables.push(networkShareLocationInput.onTextChanged(async (value) => {
						this.migrationStateModel._databaseBackup.networkShares[index].networkShareLocation = value.trim();
						await this.validateFields();
					}));
					networkShareLocationInput.value = this.migrationStateModel._databaseBackup.networkShares[index]?.networkShareLocation;
					this._networkShareLocations.push(networkShareLocationInput);

					const blobTargetDatabaseInput = this._view.modelBuilder.inputBox().withProps({
						required: true,
						value: targetDatabaseName,
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
					targetDatabaseInput.value = this.migrationStateModel._targetDatabaseNames[index];
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
						if (this.migrationStateModel._resourceGroups) {
							const selectedResourceGroup = this.migrationStateModel._resourceGroups.find(rg => rg.name === value);
							if (selectedResourceGroup && !blobResourceGroupErrorStrings.includes(value)) {
								this.migrationStateModel._databaseBackup.blobs[index].resourceGroup = selectedResourceGroup;
								await this.loadBlobStorageDropdown(index);
								await blobContainerStorageAccountDropdown.updateProperties({ enabled: true });
							} else {
								await this.disableBlobTableDropdowns(index, constants.RESOURCE_GROUP);
							}
						}
					}));
					this._blobContainerResourceGroupDropdowns.push(blobContainerResourceDropdown);

					this._disposables.push(blobContainerStorageAccountDropdown.onValueChanged(async (value) => {
						const selectedStorageAccount = this.migrationStateModel._storageAccounts.find(sa => sa.name === value);
						if (selectedStorageAccount && !blobStorageAccountErrorStrings.includes(value)) {
							this.migrationStateModel._databaseBackup.blobs[index].storageAccount = selectedStorageAccount;
							await this.loadBlobContainerDropdown(index);
							await blobContainerDropdown.updateProperties({ enabled: true });
						} else {
							await this.disableBlobTableDropdowns(index, constants.STORAGE_ACCOUNT);
						}
					}));
					this._blobContainerStorageAccountDropdowns.push(blobContainerStorageAccountDropdown);

					this._disposables.push(blobContainerDropdown.onValueChanged(async (value) => {
						if (this.migrationStateModel._blobContainers) {
							const selectedBlobContainer = this.migrationStateModel._blobContainers.find(blob => blob.name === value);
							if (selectedBlobContainer && !blobContainerErrorStrings.includes(value)) {
								this.migrationStateModel._databaseBackup.blobs[index].blobContainer = selectedBlobContainer;
								if (this.migrationStateModel._databaseBackup.migrationMode === MigrationMode.OFFLINE) {
									await this.loadBlobLastBackupFileDropdown(index);
									await blobContainerLastBackupFileDropdown.updateProperties({ enabled: true });
								}
							} else {
								await this.disableBlobTableDropdowns(index, constants.BLOB_CONTAINER);
							}
						}
					}));
					this._blobContainerDropdowns.push(blobContainerDropdown);

					if (this.migrationStateModel._databaseBackup.migrationMode === MigrationMode.OFFLINE) {
						this._disposables.push(blobContainerLastBackupFileDropdown.onValueChanged(value => {
							if (this.migrationStateModel._lastFileNames) {
								const selectedLastBackupFile = this.migrationStateModel._lastFileNames.find(fileName => fileName.name === value);
								if (selectedLastBackupFile && !blobFileErrorStrings.includes(value)) {
									this.migrationStateModel._databaseBackup.blobs[index].lastBackupFile = selectedLastBackupFile.name;
								}
							}
						}));
						this._blobContainerLastBackupFileDropdowns.push(blobContainerLastBackupFileDropdown);
					}
				});
				this.migrationStateModel._sourceDatabaseNames = this.migrationStateModel._databasesForMigration;


				let data: azdata.DeclarativeTableCellValue[][] = [];
				this.migrationStateModel._databasesForMigration.forEach((db, index) => {
					const targetRow: azdata.DeclarativeTableCellValue[] = [];
					targetRow.push({
						value: db
					});
					targetRow.push({
						value: this._networkShareTargetDatabaseNames[index]
					});
					targetRow.push({
						value: this._networkShareLocations[index]
					});
					data.push(targetRow);
				});
				await this._networkShareTargetDatabaseNamesTable.setDataValues(data);

				data = [];
				this.migrationStateModel._databasesForMigration.forEach((db, index) => {
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
			} catch (error) {
				console.log(error);
				let errorText = error?.message;
				if (errorText === constants.INVALID_OWNER_URI) {
					errorText = constants.DATABASE_BACKUP_PAGE_LOAD_ERROR;
				}
				this.wizard.message = {
					text: errorText,
					description: error?.stack,
					level: azdata.window.MessageLevel.Error
				};
			}
		}

		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}

			const errors: string[] = [];

			switch (this.migrationStateModel._databaseBackup.networkContainerType) {
				case NetworkContainerType.NETWORK_SHARE: {
					if ((<azdata.CategoryValue>this._networkShareStorageAccountResourceGroupDropdown.value)?.displayName === constants.RESOURCE_GROUP_NOT_FOUND) {
						errors.push(constants.INVALID_RESOURCE_GROUP_ERROR);
					}
					if ((<azdata.CategoryValue>this._networkShareContainerStorageAccountDropdown.value)?.displayName === constants.NO_STORAGE_ACCOUNT_FOUND) {
						errors.push(constants.INVALID_STORAGE_ACCOUNT_ERROR);
					}
					break;
				}

				case NetworkContainerType.BLOB_CONTAINER: {
					this._blobContainerResourceGroupDropdowns.forEach((v, index) => {
						if (this.shouldDisplayBlobDropdownError(v, [constants.RESOURCE_GROUP_NOT_FOUND])) {
							errors.push(constants.INVALID_BLOB_RESOURCE_GROUP_ERROR(this.migrationStateModel._databasesForMigration[index]));
						}
					});
					this._blobContainerStorageAccountDropdowns.forEach((v, index) => {
						if (this.shouldDisplayBlobDropdownError(v, [constants.NO_STORAGE_ACCOUNT_FOUND, constants.SELECT_RESOURCE_GROUP_PROMPT])) {
							errors.push(constants.INVALID_BLOB_STORAGE_ACCOUNT_ERROR(this.migrationStateModel._databasesForMigration[index]));
						}
					});
					this._blobContainerDropdowns.forEach((v, index) => {
						if (this.shouldDisplayBlobDropdownError(v, [constants.NO_BLOBCONTAINERS_FOUND, constants.SELECT_STORAGE_ACCOUNT])) {
							errors.push(constants.INVALID_BLOB_CONTAINER_ERROR(this.migrationStateModel._databasesForMigration[index]));
						}
					});

					if (this.migrationStateModel._databaseBackup.migrationMode === MigrationMode.OFFLINE) {
						this._blobContainerLastBackupFileDropdowns.forEach((v, index) => {
							if (this.shouldDisplayBlobDropdownError(v, [constants.NO_BLOBFILES_FOUND, constants.SELECT_BLOB_CONTAINER])) {
								errors.push(constants.INVALID_BLOB_LAST_BACKUP_FILE_ERROR(this.migrationStateModel._databasesForMigration[index]));
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
								const dupString = `${d.map(index => this.migrationStateModel._databasesForMigration[index]).join(', ')}`;
								errors.push(constants.PROVIDE_UNIQUE_CONTAINERS + dupString);
							}
						});
					}
					break;
				}

				default:
					return false;
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
						// All network share migrations use the same storage account
						const storageAccount = this.migrationStateModel._databaseBackup.networkShares[0]?.storageAccount;
						const storageKey = (await getStorageAccountAccessKeys(
							this.migrationStateModel._azureAccount,
							this.migrationStateModel._databaseBackup.subscription,
							storageAccount)).keyName1;
						for (let i = 0; i < this.migrationStateModel._databaseBackup.networkShares.length; i++) {
							this.migrationStateModel._databaseBackup.networkShares[i].storageKey = storageKey;
						}
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
		await this._targetDatabaseContainer.updateCssStyles({ 'display': 'inline' });

		switch (containerType) {
			case NetworkContainerType.NETWORK_SHARE: {
				await this._networkShareContainer.updateCssStyles({ 'display': 'inline' });
				await this._networkShareStorageAccountDetails.updateCssStyles({ 'display': 'inline' });
				await this._networkTableContainer.updateCssStyles({ 'display': 'inline' });

				await this._blobContainer.updateCssStyles({ 'display': 'none' });
				await this._blobTableContainer.updateCssStyles({ 'display': 'none' });

				break;
			}
			case NetworkContainerType.BLOB_CONTAINER: {
				await this._networkShareContainer.updateCssStyles({ 'display': 'none' });
				await this._networkShareStorageAccountDetails.updateCssStyles({ 'display': 'none' });
				await this._networkTableContainer.updateCssStyles({ 'display': 'none' });

				await this._blobContainer.updateCssStyles({ 'display': 'inline' });
				await this._blobTableContainer.updateCssStyles({ 'display': 'inline' });

				break;
			}
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
		await this._windowsUserAccountText.validate();
		await this._passwordText.validate();
		await this._networkShareContainerSubscription.validate();
		await this._networkShareStorageAccountResourceGroupDropdown.validate();
		await this._networkShareContainerStorageAccountDropdown.validate();
		await this._blobContainerSubscription.validate();
		for (let i = 0; i < this._networkShareTargetDatabaseNames.length; i++) {
			await this._networkShareTargetDatabaseNames[i].validate();
			await this._networkShareLocations[i].validate();
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
			this.migrationStateModel._storageAccounts = await utils.getStorageAccounts(this.migrationStateModel._azureAccount, this.migrationStateModel._databaseBackup.subscription);
			this.migrationStateModel._resourceGroups = await utils.getStorageAccountResourceGroups(this.migrationStateModel._storageAccounts, this.migrationStateModel._location);
			this._networkShareStorageAccountResourceGroupDropdown.values = await utils.getAzureResourceGroupsDropdownValues(this.migrationStateModel._resourceGroups);
			utils.selectDefaultDropdownValue(this._networkShareStorageAccountResourceGroupDropdown, this.migrationStateModel._databaseBackup?.networkShares[0]?.resourceGroup?.id, false);
		} catch (error) {
			logError(TelemetryViews.DatabaseBackupPage, 'ErrorLoadingNetworkStorageResourceGroup', error);
		} finally {
			this._networkShareStorageAccountResourceGroupDropdown.loading = false;
			await this.loadNetworkShareStorageDropdown();
		}
	}

	private async loadNetworkShareStorageDropdown(): Promise<void> {
		this._networkShareContainerStorageAccountDropdown.loading = true;
		this._networkShareStorageAccountResourceGroupDropdown.loading = true;
		try {
			this._networkShareContainerStorageAccountDropdown.values = await utils.getStorageAccountsDropdownValues(this.migrationStateModel._storageAccounts, this.migrationStateModel._location, this.migrationStateModel._databaseBackup.networkShares[0]?.resourceGroup);
			utils.selectDefaultDropdownValue(this._networkShareContainerStorageAccountDropdown, this.migrationStateModel?._databaseBackup?.networkShares[0]?.storageAccount?.id, false);
		} catch (error) {
			logError(TelemetryViews.DatabaseBackupPage, 'ErrorLoadingNetworkShareStorageDropdown', error);
		} finally {
			this._networkShareContainerStorageAccountDropdown.loading = false;
			this._networkShareStorageAccountResourceGroupDropdown.loading = false;
		}
	}

	private async loadBlobResourceGroup(): Promise<void> {
		this._blobContainerResourceGroupDropdowns.forEach(v => v.loading = true);
		try {
			this.migrationStateModel._storageAccounts = await utils.getStorageAccounts(this.migrationStateModel._azureAccount, this.migrationStateModel._databaseBackup.subscription);
			this.migrationStateModel._resourceGroups = await utils.getStorageAccountResourceGroups(this.migrationStateModel._storageAccounts, this.migrationStateModel._location);
			const resourceGroupValues = await utils.getAzureResourceGroupsDropdownValues(this.migrationStateModel._resourceGroups);
			this._blobContainerResourceGroupDropdowns.forEach((dropDown, index) => {
				dropDown.values = resourceGroupValues;
				utils.selectDefaultDropdownValue(dropDown, this.migrationStateModel._databaseBackup?.blobs[index]?.resourceGroup?.id, false);
			});
		} catch (error) {
			logError(TelemetryViews.DatabaseBackupPage, 'ErrorLoadingBlobResourceGroup', error);
		} finally {
			this._blobContainerResourceGroupDropdowns.forEach(v => v.loading = false);
		}
	}

	private async loadBlobStorageDropdown(index: number): Promise<void> {
		this._blobContainerStorageAccountDropdowns[index].loading = true;
		try {
			this._blobContainerStorageAccountDropdowns[index].values = await utils.getStorageAccountsDropdownValues(this.migrationStateModel._storageAccounts, this.migrationStateModel._location, this.migrationStateModel._databaseBackup.blobs[index]?.resourceGroup);
			utils.selectDefaultDropdownValue(this._blobContainerStorageAccountDropdowns[index], this.migrationStateModel._databaseBackup?.blobs[index]?.storageAccount?.id, false);
		} catch (error) {
			logError(TelemetryViews.DatabaseBackupPage, 'ErrorLoadingBlobStorageDropdown', error);
		} finally {
			this._blobContainerStorageAccountDropdowns[index].loading = false;
		}
	}

	private async loadBlobContainerDropdown(index: number): Promise<void> {
		this._blobContainerDropdowns[index].loading = true;
		try {
			this.migrationStateModel._blobContainers = await utils.getBlobContainer(this.migrationStateModel._azureAccount, this.migrationStateModel._databaseBackup.subscription, this.migrationStateModel._databaseBackup.blobs[index]?.storageAccount);
			this._blobContainerDropdowns[index].values = await utils.getBlobContainersValues(this.migrationStateModel._blobContainers);
			utils.selectDefaultDropdownValue(this._blobContainerDropdowns[index], this.migrationStateModel._databaseBackup?.blobs[index]?.blobContainer?.id, false);
		} catch (error) {
			logError(TelemetryViews.DatabaseBackupPage, 'ErrorLoadingBlobContainers', error);
		} finally {
			this._blobContainerDropdowns[index].loading = false;
		}
	}

	private async loadBlobLastBackupFileDropdown(index: number): Promise<void> {
		this._blobContainerLastBackupFileDropdowns[index].loading = true;
		try {
			this.migrationStateModel._lastFileNames = await utils.getBlobLastBackupFileNames(this.migrationStateModel._azureAccount, this.migrationStateModel._databaseBackup.subscription, this.migrationStateModel._databaseBackup.blobs[index]?.storageAccount, this.migrationStateModel._databaseBackup.blobs[index]?.blobContainer);
			this._blobContainerLastBackupFileDropdowns[index].values = await utils.getBlobLastBackupFileNamesValues(this.migrationStateModel._lastFileNames);
			utils.selectDefaultDropdownValue(this._blobContainerLastBackupFileDropdowns[index], this.migrationStateModel._databaseBackup?.blobs[index]?.lastBackupFile, false);
		} catch (error) {
			logError(TelemetryViews.DatabaseBackupPage, 'ErrorLoadingBlobLastBackupFiles', error);
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
			utils.selectDropDownIndex(this._blobContainerLastBackupFileDropdowns[rowIndex], 0);
			await this._blobContainerLastBackupFileDropdowns[rowIndex]?.updateProperties(dropdownProps);
		}
		if (columnName === constants.BLOB_CONTAINER) { return; }

		this._blobContainerDropdowns[rowIndex].values = createDropdownValuesWithPrereq(constants.SELECT_STORAGE_ACCOUNT);
		utils.selectDropDownIndex(this._blobContainerDropdowns[rowIndex], 0);
		await this._blobContainerDropdowns[rowIndex].updateProperties(dropdownProps);
		if (columnName === constants.STORAGE_ACCOUNT) { return; }

		this._blobContainerStorageAccountDropdowns[rowIndex].values = createDropdownValuesWithPrereq(constants.SELECT_RESOURCE_GROUP_PROMPT);
		utils.selectDropDownIndex(this._blobContainerStorageAccountDropdowns[rowIndex], 0);
		await this._blobContainerStorageAccountDropdowns[rowIndex].updateProperties(dropdownProps);
	}
}
