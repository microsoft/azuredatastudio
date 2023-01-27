/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationMode, MigrationStateModel, NetworkContainerType, StateChangeEvent } from '../models/stateMachine';
import { CreateSqlMigrationServiceDialog } from '../dialog/createSqlMigrationService/createSqlMigrationServiceDialog';
import * as constants from '../constants/strings';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import { getFullResourceGroupFromId, getLocationDisplayName, getSqlMigrationService, getSqlMigrationServiceAuthKeys, getSqlMigrationServiceMonitoringData, SqlVMServer } from '../api/azure';
import { IconPathHelper } from '../constants/iconPathHelper';
import { logError, TelemetryViews } from '../telemtery';
import * as utils from '../api/utils';
import * as styles from '../constants/styles';

export class IntergrationRuntimePage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _statusLoadingComponent!: azdata.LoadingComponent;
	private _subscription!: azdata.TextComponent;
	private _location!: azdata.TextComponent;
	private _resourceGroupDropdown!: azdata.DropDownComponent;
	private _dmsDropdown!: azdata.DropDownComponent;
	private _dmsInfoContainer!: azdata.FlexContainer;
	private _dmsStatusInfoBox!: azdata.InfoBoxComponent;
	private _authKeyTable!: azdata.DeclarativeTableComponent;
	private _refreshButton!: azdata.ButtonComponent;
	private _connectionStatusLoader!: azdata.LoadingComponent;
	private _copy1!: azdata.ButtonComponent;
	private _copy2!: azdata.ButtonComponent;
	private _refresh1!: azdata.ButtonComponent;
	private _refresh2!: azdata.ButtonComponent;
	private _onlineButton!: azdata.RadioButtonComponent;
	private _offlineButton!: azdata.RadioButtonComponent;
	private _modeContainer!: azdata.FlexContainer;
	private _radioButtonContainer!: azdata.FlexContainer;
	private _networkShareButton!: azdata.RadioButtonComponent;
	private _blobContainerButton!: azdata.RadioButtonComponent;
	private _sqlVmPageBlobInfoBox!: azdata.TextComponent;
	private _originalMigrationMode!: MigrationMode;
	private _disposables: vscode.Disposable[] = [];

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.IR_PAGE_TITLE), migrationStateModel);
		this.migrationStateModel._databaseBackup.migrationMode =
			this.migrationStateModel._databaseBackup.migrationMode ||
				this.migrationStateModel.isSqlDbTarget
				? MigrationMode.OFFLINE
				: MigrationMode.ONLINE;
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;

		this._statusLoadingComponent = view.modelBuilder.loadingComponent()
			.withItem(this.createDMSDetailsContainer())
			.component();

		this._dmsInfoContainer = this._view.modelBuilder.flexContainer()
			.withItems([this._statusLoadingComponent])
			.component();

		this._radioButtonContainer = this.createBackupLocationComponent();
		this._modeContainer = this.migrationModeContainer();

		const form = view.modelBuilder.formContainer()
			.withFormItems([
				{ component: this._modeContainer },
				{ component: this._radioButtonContainer },
				{ component: this.migrationServiceDropdownContainer() },
				{ component: this._dmsInfoContainer }])
			.withProps({ CSSStyles: { 'padding-top': '0' } })
			.component();

		this._disposables.push(
			this._view.onClosed(e =>
				this._disposables.forEach(
					d => { try { d.dispose(); } catch { } })));

		await view.initializeModel(form);
	}

	private migrationModeContainer(): azdata.FlexContainer {
		const buttonGroup = 'migrationMode';
		this._onlineButton = this._view.modelBuilder.radioButton()
			.withProps({
				label: constants.DATABASE_BACKUP_MIGRATION_MODE_ONLINE_LABEL,
				name: buttonGroup,
				checked: this.migrationStateModel._databaseBackup.migrationMode === MigrationMode.ONLINE,
				CSSStyles: { ...styles.LABEL_CSS, },
			}).component();
		const onlineDescription = this._view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_MIGRATION_MODE_ONLINE_DESCRIPTION,
				CSSStyles: { ...styles.NOTE_CSS, 'margin-left': '20px' }
			}).component();
		this._disposables.push(
			this._onlineButton.onDidChangeCheckedState(checked => {
				if (checked) {
					this.migrationStateModel._databaseBackup.migrationMode = MigrationMode.ONLINE;
					this.migrationStateModel.refreshDatabaseBackupPage = true;
				}
			}));

		this._offlineButton = this._view.modelBuilder.radioButton()
			.withProps({
				label: constants.DATABASE_BACKUP_MIGRATION_MODE_OFFLINE_LABEL,
				name: buttonGroup,
				checked: this.migrationStateModel._databaseBackup.migrationMode === MigrationMode.OFFLINE,
				CSSStyles: { ...styles.LABEL_CSS, 'margin-top': '12px' },
			}).component();
		const offlineDescription = this._view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_MIGRATION_MODE_OFFLINE_DESCRIPTION,
				CSSStyles: { ...styles.NOTE_CSS, 'margin-left': '20px' }
			}).component();
		this._disposables.push(
			this._offlineButton.onDidChangeCheckedState(checked => {
				if (checked) {
					this.migrationStateModel._databaseBackup.migrationMode = MigrationMode.OFFLINE;
					this.migrationStateModel.refreshDatabaseBackupPage = true;
				}
			}));

		const flexContainer = this._view.modelBuilder.flexContainer()
			.withItems([
				this._onlineButton,
				onlineDescription,
				this._offlineButton,
				offlineDescription]
			).withLayout({ flexFlow: 'column' })
			.component();

		return flexContainer;
	}

	private createBackupLocationComponent(): azdata.FlexContainer {
		const buttonGroup = 'networkContainer';

		const selectLocationText = this._view.modelBuilder.text()
			.withProps({
				value: constants.DATABASE_BACKUP_PAGE_DESCRIPTION,
				CSSStyles: { ...styles.BODY_CSS }
			}).component();

		this._networkShareButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.DATABASE_BACKUP_NC_NETWORK_SHARE_RADIO_LABEL,
				checked: this.migrationStateModel.isBackupContainerNetworkShare,
				CSSStyles: { ...styles.BODY_CSS, 'margin': '0' }
			}).component();

		this._disposables.push(
			this._networkShareButton.onDidChangeCheckedState(async checked => {
				if (checked) {
					this.migrationStateModel._databaseBackup.networkContainerType = NetworkContainerType.NETWORK_SHARE;
					await utils.updateControlDisplay(this._dmsInfoContainer, true);
					this.migrationStateModel.refreshDatabaseBackupPage = true;
				}
			}));

		this._blobContainerButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.DATABASE_BACKUP_NC_BLOB_STORAGE_RADIO_LABEL,
				checked: this.migrationStateModel._databaseBackup.networkContainerType === NetworkContainerType.BLOB_CONTAINER,
				CSSStyles: { ...styles.BODY_CSS, 'margin': '0' }
			}).component();

		this._disposables.push(
			this._blobContainerButton.onDidChangeCheckedState(async checked => {
				if (checked) {
					this.migrationStateModel._databaseBackup.networkContainerType = NetworkContainerType.BLOB_CONTAINER;
					await utils.updateControlDisplay(this._dmsInfoContainer, false);
					this.migrationStateModel.refreshDatabaseBackupPage = true;
				}
			}));

		this._sqlVmPageBlobInfoBox = this._view.modelBuilder.infoBox()
			.withProps({
				text: constants.DATABASE_BACKUP_SQL_VM_PAGE_BLOB_INFO,
				style: 'information',
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: { ...styles.BODY_CSS, 'display': 'none' },
				links: [
					{
						text: constants.DATABASE_BACKUP_SQL_VM_PAGE_BLOB_URL_LABEL,
						url: 'https://aka.ms/dms-migrations-troubleshooting'
					}
				]
			}).component();

		const flexContainer = this._view.modelBuilder.flexContainer()
			.withItems([
				selectLocationText,
				this._blobContainerButton,
				this._networkShareButton,
				this._sqlVmPageBlobInfoBox
			])
			.withLayout({ flexFlow: 'column' })
			.component();

		return flexContainer;
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		const isSqlDbTarget = this.migrationStateModel.isSqlDbTarget;
		const isSqlVmTarget = this.migrationStateModel.isSqlVmTarget;
		const isNetworkShare = this.migrationStateModel.isBackupContainerNetworkShare;

		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			this.wizard.message = { text: '' };
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}
			const isSqlDbTarget = this.migrationStateModel.isSqlDbTarget;
			if (!isSqlDbTarget && !this._networkShareButton.checked && !this._blobContainerButton.checked) {
				this.wizard.message = {
					level: azdata.window.MessageLevel.Error,
					text: constants.SERVICE_SELECTION_LOCATION_MESSAGE,
				};
				return false;
			}

			const state = this.migrationStateModel._sqlMigrationService?.properties?.integrationRuntimeState;
			if (!this.migrationStateModel._sqlMigrationService) {
				this.wizard.message = {
					level: azdata.window.MessageLevel.Error,
					text: constants.INVALID_SERVICE_ERROR
				};
				return false;
			}
			if ((isSqlDbTarget || isNetworkShare) && state !== 'Online') {
				this.wizard.message = {
					level: azdata.window.MessageLevel.Error,
					text: constants.SERVICE_OFFLINE_ERROR
				};
				return false;
			}
			return true;
		});

		if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
			return;
		}

		await utils.updateControlDisplay(this._modeContainer, !isSqlDbTarget);
		this._onlineButton.enabled = !isSqlDbTarget;

		if (isSqlDbTarget) {
			this.migrationStateModel._databaseBackup.migrationMode = MigrationMode.OFFLINE;
			this._offlineButton.checked = true;
		}
		this._originalMigrationMode = this.migrationStateModel._databaseBackup.migrationMode;

		this._networkShareButton.checked = this.migrationStateModel.isBackupContainerNetworkShare;
		this._blobContainerButton.checked = this.migrationStateModel._databaseBackup.networkContainerType === NetworkContainerType.BLOB_CONTAINER;
		await utils.updateControlDisplay(
			this._radioButtonContainer,
			!isSqlDbTarget);

		// if target SQL VM version is <= 2014, disable IR scenario and show info box
		const shouldDisableIrScenario = isSqlVmTarget && utils.isTargetSqlVm2014OrBelow(this.migrationStateModel._targetServerInstance as SqlVMServer);
		this._networkShareButton.enabled = !shouldDisableIrScenario;
		await utils.updateControlDisplay(this._sqlVmPageBlobInfoBox, shouldDisableIrScenario, 'block');

		// always pre-select blob scenario
		this.migrationStateModel._databaseBackup.networkContainerType = NetworkContainerType.BLOB_CONTAINER;
		this._blobContainerButton.checked = true;

		this._subscription.value = this.migrationStateModel._targetSubscription.name;
		this._location.value = await getLocationDisplayName(
			this.migrationStateModel._targetServerInstance.location);

		await utils.updateControlDisplay(
			this._dmsInfoContainer,
			isSqlDbTarget || isNetworkShare);

		await this.loadResourceGroupDropdown();
	}

	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.registerNavigationValidator(pageChangeInfo => true);
		this.wizard.message = { text: '' };
		if (this._originalMigrationMode !== this.migrationStateModel._databaseBackup.migrationMode) {
			this.migrationStateModel.refreshDatabaseBackupPage = true;
		}
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private migrationServiceDropdownContainer(): azdata.FlexContainer {
		const descriptionText = this._view.modelBuilder.text()
			.withProps({
				value: constants.IR_PAGE_DESCRIPTION,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: { ...styles.BODY_CSS, 'margin-bottom': '16px' }
			}).component();

		const subscriptionLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.SUBSCRIPTION,
				CSSStyles: { ...styles.LABEL_CSS }
			}).component();
		this._subscription = this._view.modelBuilder.text()
			.withProps({
				enabled: false,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: { 'margin': '0' }
			}).component();

		const locationLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.LOCATION,
				CSSStyles: { ...styles.LABEL_CSS, 'margin-top': '1em' }
			}).component();
		this._location = this._view.modelBuilder.text()
			.withProps({
				enabled: false,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: { 'margin': '0' }
			}).component();

		const resourceGroupLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.RESOURCE_GROUP,
				requiredIndicator: true,
				CSSStyles: { ...styles.LABEL_CSS }
			}).component();
		this._resourceGroupDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.RESOURCE_GROUP,
				placeholder: constants.SELECT_RESOURCE_GROUP,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				required: true,
				fireOnTextChange: true,
				CSSStyles: { 'margin-top': '-1em' }
			}).component();
		this._disposables.push(
			this._resourceGroupDropdown.onValueChanged(
				async (value) => {
					if (value && value !== 'undefined' && value !== constants.RESOURCE_GROUP_NOT_FOUND) {
						const selectedResourceGroup = this.migrationStateModel._resourceGroups.find(rg => rg.name === value);
						this.migrationStateModel._sqlMigrationServiceResourceGroup = (selectedResourceGroup)
							? selectedResourceGroup
							: undefined!;
						this.populateDms();
					}
				}));

		const migrationServiceDropdownLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.IR_PAGE_TITLE,
				requiredIndicator: true,
				CSSStyles: { ...styles.LABEL_CSS }
			}).component();
		this._dmsDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.IR_PAGE_TITLE,
				placeholder: constants.SELECT_RESOURCE_GROUP_PROMPT,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				required: true,
				fireOnTextChange: true,
				CSSStyles: { 'margin-top': '-1em' }
			}).component();
		this._disposables.push(
			this._dmsDropdown.onValueChanged(
				async (value) => {
					if (value && value !== 'undefined' && value !== constants.SQL_MIGRATION_SERVICE_NOT_FOUND_ERROR) {
						this.wizard.message = { text: '' };
						const resourceGroupName = this.migrationStateModel._sqlMigrationServiceResourceGroup.name.toLowerCase();
						const selectedDms = this.migrationStateModel._sqlMigrationServices.find(
							dms => dms.name === value
								&& dms.properties.resourceGroup.toLowerCase() === resourceGroupName);

						if (selectedDms) {
							this.migrationStateModel._sqlMigrationService = selectedDms;
							await this.loadStatus();
						}

						await utils.updateControlDisplay(
							this._dmsInfoContainer,
							this.migrationStateModel.isSqlDbTarget ||
							this.migrationStateModel.isBackupContainerNetworkShare);
					} else {
						this.migrationStateModel._sqlMigrationService = undefined;
						await utils.updateControlDisplay(this._dmsInfoContainer, false);
					}
				}));

		const createNewMigrationService = this._view.modelBuilder.hyperlink()
			.withProps({
				label: constants.CREATE_NEW,
				ariaLabel: constants.CREATE_NEW_MIGRATION_SERVICE,
				url: '',
				CSSStyles: { ...styles.BODY_CSS }
			}).component();

		this._disposables.push(
			createNewMigrationService.onDidClick(
				async (e) => {
					const dialog = new CreateSqlMigrationServiceDialog();
					const createdDmsResult = await dialog.createNewDms(
						this.migrationStateModel,
						this._resourceGroupDropdown.value
							? (<azdata.CategoryValue>this._resourceGroupDropdown.value).displayName
							: '');

					this.migrationStateModel._sqlMigrationServiceResourceGroup = createdDmsResult.resourceGroup;
					this.migrationStateModel._sqlMigrationService = createdDmsResult.service;
					await this.loadResourceGroupDropdown();
					this.populateDms();
				}));

		return this._view.modelBuilder.flexContainer()
			.withItems([
				descriptionText,
				subscriptionLabel,
				this._subscription,
				locationLabel,
				this._location,
				resourceGroupLabel,
				this._resourceGroupDropdown,
				migrationServiceDropdownLabel,
				this._dmsDropdown,
				createNewMigrationService])
			.withLayout({ flexFlow: 'column' })
			.component();
	}

	private createDMSDetailsContainer(): azdata.FlexContainer {
		const container = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.component();

		const connectionStatusLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.SERVICE_CONNECTION_STATUS,
				CSSStyles: { ...styles.LABEL_CSS, 'width': '130px' }
			}).component();

		this._refreshButton = this._view.modelBuilder.button()
			.withProps({
				iconWidth: '18px',
				iconHeight: '18px',
				iconPath: IconPathHelper.refresh,
				height: '18px',
				width: '18px',
				ariaLabel: constants.REFRESH,
			}).component();

		this._disposables.push(
			this._refreshButton.onDidClick(
				async (e) => await this.loadStatus()));

		const connectionLabelContainer = this._view.modelBuilder.flexContainer()
			.component();
		connectionLabelContainer.addItem(
			connectionStatusLabel,
			{ flex: '0' });
		connectionLabelContainer.addItem(
			this._refreshButton,
			{ flex: '0', CSSStyles: { 'margin-right': '10px' } });

		const statusContainer = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.component();

		this._dmsStatusInfoBox = this._view.modelBuilder.infoBox()
			.withProps({
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				style: 'error',
				text: '',
				CSSStyles: { ...styles.BODY_CSS }
			}).component();

		const authenticationKeysLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.AUTHENTICATION_KEYS,
				CSSStyles: { ...styles.LABEL_CSS }
			}).component();

		this._copy1 = this._view.modelBuilder.button()
			.withProps({
				title: constants.COPY_KEY1,
				iconPath: IconPathHelper.copy,
				ariaLabel: constants.COPY_KEY1,
			}).component();

		this._disposables.push(
			this._copy1.onDidClick(
				async (e) => {
					await vscode.env.clipboard.writeText(<string>this._authKeyTable.dataValues![0][1].value);
					void vscode.window.showInformationMessage(constants.SERVICE_KEY1_COPIED_HELP);
				}));

		this._copy2 = this._view.modelBuilder.button()
			.withProps({
				title: constants.COPY_KEY2,
				iconPath: IconPathHelper.copy,
				ariaLabel: constants.COPY_KEY2,
			}).component();

		this._disposables.push(
			this._copy2.onDidClick(async (e) => {
				await vscode.env.clipboard.writeText(<string>this._authKeyTable.dataValues![1][1].value);
				void vscode.window.showInformationMessage(constants.SERVICE_KEY2_COPIED_HELP);
			}));

		this._refresh1 = this._view.modelBuilder.button()
			.withProps({
				title: constants.REFRESH_KEY1,
				iconPath: IconPathHelper.refresh,
				ariaLabel: constants.REFRESH_KEY1,
			}).component();

		this._refresh2 = this._view.modelBuilder.button()
			.withProps({
				title: constants.REFRESH_KEY2,
				iconPath: IconPathHelper.refresh,
				ariaLabel: constants.REFRESH_KEY2,
			}).component();

		this._authKeyTable = createAuthenticationKeyTable(this._view);

		statusContainer.addItems([
			this._dmsStatusInfoBox,
			authenticationKeysLabel,
			this._authKeyTable]);

		this._connectionStatusLoader = this._view.modelBuilder.loadingComponent()
			.withItem(statusContainer)
			.withProps({ loading: false })
			.component();

		container.addItems([
			connectionLabelContainer,
			this._connectionStatusLoader]);

		return container;
	}

	public async loadResourceGroupDropdown(): Promise<void> {
		try {
			this._resourceGroupDropdown.loading = true;
			this._dmsDropdown.loading = true;

			this.migrationStateModel._sqlMigrationServices = await utils.getAzureSqlMigrationServices(
				this.migrationStateModel._azureAccount,
				this.migrationStateModel._targetSubscription);

			this.migrationStateModel._resourceGroups = utils.getServiceResourceGroupsByLocation(
				this.migrationStateModel._sqlMigrationServices,
				this.migrationStateModel._location);

			this._resourceGroupDropdown.values = utils.getResourceDropdownValues(
				this.migrationStateModel._resourceGroups,
				constants.RESOURCE_GROUP_NOT_FOUND);

			const resourceGroup = this.migrationStateModel._sqlMigrationService
				? getFullResourceGroupFromId(this.migrationStateModel._sqlMigrationService?.id)
				: undefined;
			utils.selectDefaultDropdownValue(this._resourceGroupDropdown, resourceGroup, false);
		} finally {
			this._dmsDropdown.loading = false;
			this._resourceGroupDropdown.loading = false;
		}
	}

	public populateDms(): void {
		try {
			this._dmsDropdown.loading = true;
			this._dmsDropdown.values = utils.getAzureResourceDropdownValues(
				this.migrationStateModel._sqlMigrationServices,
				this.migrationStateModel._location,
				this.migrationStateModel._sqlMigrationServiceResourceGroup?.name,
				constants.SQL_MIGRATION_SERVICE_NOT_FOUND_ERROR);

			utils.selectDefaultDropdownValue(
				this._dmsDropdown,
				this.migrationStateModel._sqlMigrationService?.id,
				false);
		} finally {
			this._dmsDropdown.loading = false;
		}
	}

	private async loadStatus(): Promise<void> {
		try {
			this._statusLoadingComponent.loading = true;

			if (this.migrationStateModel._sqlMigrationService) {
				const migrationService = await getSqlMigrationService(
					this.migrationStateModel._azureAccount,
					this.migrationStateModel._targetSubscription,
					this.migrationStateModel._sqlMigrationService.properties.resourceGroup,
					this.migrationStateModel._sqlMigrationService.location,
					this.migrationStateModel._sqlMigrationService.name);
				this.migrationStateModel._sqlMigrationService = migrationService;
				const migrationServiceMonitoringStatus = await getSqlMigrationServiceMonitoringData(
					this.migrationStateModel._azureAccount,
					this.migrationStateModel._targetSubscription,
					this.migrationStateModel._sqlMigrationService.properties.resourceGroup,
					this.migrationStateModel._sqlMigrationService.location,
					this.migrationStateModel._sqlMigrationService!.name);
				this.migrationStateModel._nodeNames = migrationServiceMonitoringStatus.nodes.map(
					node => node.nodeName);

				const migrationServiceAuthKeys = await getSqlMigrationServiceAuthKeys(
					this.migrationStateModel._azureAccount,
					this.migrationStateModel._targetSubscription,
					this.migrationStateModel._sqlMigrationService.properties.resourceGroup,
					this.migrationStateModel._sqlMigrationService.location,
					this.migrationStateModel._sqlMigrationService!.name);

				const state = migrationService.properties.integrationRuntimeState;
				if (state === 'Online') {
					await this._dmsStatusInfoBox.updateProperties(<azdata.InfoBoxComponentProperties>{
						text: constants.SERVICE_READY(
							this.migrationStateModel._sqlMigrationService!.name,
							this.migrationStateModel._nodeNames.join(', ')),
						style: 'success'
					});
				} else {
					await this._dmsStatusInfoBox.updateProperties(<azdata.InfoBoxComponentProperties>{
						text: constants.SERVICE_NOT_READY(
							this.migrationStateModel._sqlMigrationService!.name),
						style: 'error'
					});
				}

				const data = [
					[
						{ value: constants.SERVICE_KEY1_LABEL },
						{ value: migrationServiceAuthKeys.authKey1 },
						{
							value: this._view.modelBuilder.flexContainer()
								.withItems([this._copy1, this._refresh1])
								.component()
						}
					],
					[
						{ value: constants.SERVICE_KEY2_LABEL },
						{ value: migrationServiceAuthKeys.authKey2 },
						{
							value: this._view.modelBuilder.flexContainer()
								.withItems([this._copy2, this._refresh2])
								.component()
						}
					]];

				await this._authKeyTable.setDataValues(data);
			}
		} catch (e) {
			logError(TelemetryViews.IntegrationRuntimePage, 'ErrorLoadingStatus', e);
		} finally {
			this._statusLoadingComponent.loading = false;
		}
	}
}

export function createAuthenticationKeyTable(view: azdata.ModelView,): azdata.DeclarativeTableComponent {
	const authKeyTable = view.modelBuilder.declarativeTable()
		.withProps({
			ariaLabel: constants.DATABASE_MIGRATION_SERVICE_AUTHENTICATION_KEYS,
			columns: [
				{
					displayName: constants.NAME,
					valueType: azdata.DeclarativeDataType.string,
					width: '50px',
					isReadOnly: true,
					rowCssStyles: { ...styles.BODY_CSS },
					headerCssStyles: { ...styles.BODY_CSS, 'font-weight': '600' }
				},
				{
					displayName: constants.AUTH_KEY_COLUMN_HEADER,
					valueType: azdata.DeclarativeDataType.string,
					width: '500px',
					isReadOnly: true,
					rowCssStyles: { ...styles.BODY_CSS },
					headerCssStyles: { ...styles.BODY_CSS, 'font-weight': '600' }
				},
				{
					displayName: '',
					valueType: azdata.DeclarativeDataType.component,
					width: '30px',
					isReadOnly: true,
					rowCssStyles: { ...styles.BODY_CSS },
					headerCssStyles: { ...styles.BODY_CSS }
				}
			],
			CSSStyles: { 'margin-top': '5px', 'width': WIZARD_INPUT_COMPONENT_WIDTH }
		}).component();
	return authKeyTable;
}
