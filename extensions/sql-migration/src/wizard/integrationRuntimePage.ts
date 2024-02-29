/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationMode, MigrationStateModel, NetworkContainerType, StateChangeEvent } from '../models/stateMachine';
import { CreateSqlMigrationServiceDialog } from '../dialog/createSqlMigrationService/createSqlMigrationServiceDialog';
import * as constants from '../constants/strings';
import { WIZARD_INPUT_COMPONENT_WIDTH, WizardController } from './wizardController';
import { getFullResourceGroupFromId, getSqlMigrationService, getSqlMigrationServiceMonitoringData, IntegrationRuntimeNode, SqlVMServer } from '../api/azure';
import { IconPathHelper } from '../constants/iconPathHelper';
import { logError, TelemetryViews } from '../telemetry';
import * as utils from '../api/utils';
import * as styles from '../constants/styles';
import { ConfigureIRDialog } from '../dialog/configureIR/configureIRDialog';

export class IntergrationRuntimePage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _statusLoadingComponent!: azdata.LoadingComponent;
	private _subscriptionDropdown!: azdata.DropDownComponent;
	private _location!: azdata.TextComponent;
	private _resourceGroupDropdown!: azdata.DropDownComponent;
	private _dmsDropdown!: azdata.DropDownComponent;
	private _dmsInfoContainer!: azdata.FlexContainer;
	private _dmsStatusInfoBox!: azdata.InfoBoxComponent;
	private _integrationRuntimeTable!: azdata.DeclarativeTableComponent;
	private _refreshButton!: azdata.ButtonComponent;
	private _configureIRButton!: azdata.ButtonComponent;
	private _onlineButton!: azdata.RadioButtonComponent;
	private _offlineButton!: azdata.RadioButtonComponent;
	private _modeContainer!: azdata.FlexContainer;
	private _radioButtonContainer!: azdata.FlexContainer;
	private _networkShareButton!: azdata.RadioButtonComponent;
	private _blobContainerButton!: azdata.RadioButtonComponent;
	private _sqlVmPageBlobInfoBox!: azdata.TextComponent;
	private _originalMigrationMode!: MigrationMode;
	private _disposables: vscode.Disposable[] = [];

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel, private wizardController: WizardController) {
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
					this.migrationStateModel.refreshDatabaseBackupPage = true;

					const hasService = this.migrationStateModel._sqlMigrationService !== undefined;
					await utils.updateControlDisplay(this._dmsInfoContainer, hasService);
					if (hasService) {
						await this.loadStatus();
					}
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
		this.wizardController.cancelReasonsList([
			constants.WIZARD_CANCEL_REASON_CONTINUE_WITH_MIGRATION_LATER,
			constants.WIZARD_CANCEL_REASON_DMS_SERVICE_OR_IR_NOT_READY
		]);

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

		await this.loadSubscriptionsDropdown();

		this._location.value = this.migrationStateModel._location.displayName;

		await utils.updateControlDisplay(
			this._dmsInfoContainer,
			isSqlDbTarget || isNetworkShare);
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

		this._subscriptionDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.MIGRATION_SERVICE_SELECT_SERVICE_LABEL,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				required: true,
				fireOnTextChange: true,
				placeholder: constants.SELECT_A_SERVICE,
				CSSStyles: { 'margin': '0' }
			}).component();

		this._disposables.push(
			this._subscriptionDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined' && value !== constants.SERVICE_NOT_FOUND) {
					const selectedSubscription = this.migrationStateModel._subscriptions.find(
						sub => `${sub.name} - ${sub.id}` === value);
					this.migrationStateModel._sqlMigrationServiceSubscription = (selectedSubscription)
						? selectedSubscription
						: undefined!;
				} else {
					this.migrationStateModel._sqlMigrationServiceSubscription = undefined!;
				}
				await utils.clearDropDown(this._resourceGroupDropdown);
				await this.loadResourceGroupDropdown();
			}));

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
					}
					else {
						this.migrationStateModel._sqlMigrationServiceResourceGroup = undefined!;
					}
					await utils.clearDropDown(this._dmsDropdown);
					this.loadDmsDropdown();
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

						const showShirStatus = selectedDms !== undefined &&
							(this.migrationStateModel.isSqlDbTarget ||
								this.migrationStateModel.isBackupContainerNetworkShare);

						this.migrationStateModel._sqlMigrationService = selectedDms;
						await utils.updateControlDisplay(
							this._dmsInfoContainer,
							showShirStatus);

						if (showShirStatus) {
							await this.loadStatus();
						}
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
				}));

		return this._view.modelBuilder.flexContainer()
			.withItems([
				descriptionText,
				subscriptionLabel,
				this._subscriptionDropdown,
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
				height: '40px',
				width: '60px',
				ariaLabel: constants.REFRESH,
				label: constants.REFRESH,
			}).component();

		this._disposables.push(
			this._refreshButton.onDidClick(
				async (e) => await this.loadStatus()));

		this._configureIRButton = this._view.modelBuilder.button()
			.withProps({
				iconWidth: '18px',
				iconHeight: '18px',
				iconPath: IconPathHelper.settings,
				height: '40px',
				width: '180px',
				ariaLabel: constants.CONFIGURE_INTEGRATION_RUNTIME,
				label: constants.CONFIGURE_INTEGRATION_RUNTIME,
			}).component();

		this._disposables.push(
			this._configureIRButton.onDidClick(
				async (e) => {
					await this.openIRDialog();
				}
			)
		);

		const connectionLabelContainer = this._view.modelBuilder.flexContainer()
			.component();
		connectionLabelContainer.addItem(
			connectionStatusLabel,
			{ flex: '0' });

		this._dmsStatusInfoBox = this._view.modelBuilder.infoBox()
			.withProps({
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				style: 'error',
				text: '',
				CSSStyles: { ...styles.BODY_CSS }
			}).component();

		const refreshAndConfigureIRcontainer = this._view.modelBuilder.toolbarContainer()
			.withToolbarItems(
				[
					{ component: this._refreshButton },
					{ component: this._configureIRButton }
				]
			).component();

		this._integrationRuntimeTable = utils.createIntegrationRuntimeTable(this._view);

		container.addItems([
			connectionLabelContainer,
			this._dmsStatusInfoBox,
			refreshAndConfigureIRcontainer,
			this._integrationRuntimeTable
			//statusContainer
		]);

		return container;
	}

	// opens IR dialog
	public async openIRDialog(): Promise<void> {
		const configureIR = new ConfigureIRDialog(this.migrationStateModel);
		await configureIR.openDialog();
	}

	public async loadSubscriptionsDropdown(): Promise<void> {
		try {
			this._subscriptionDropdown.loading = true;
			this.migrationStateModel._subscriptions = await utils.getAzureSubscriptions(
				this.migrationStateModel._azureAccount,
				this.migrationStateModel._azureTenant?.id);

			const sub = this.migrationStateModel._sqlMigrationServiceSubscription
				?? this.migrationStateModel._targetSubscription;

			this._subscriptionDropdown.values = await utils.getAzureSubscriptionsDropdownValues(
				this.migrationStateModel._subscriptions);

			utils.selectDefaultDropdownValue(this._subscriptionDropdown, sub?.id, false);
		} catch (e) {
			logError(TelemetryViews.IntegrationRuntimePage, 'Error loadSubscriptionsDropdown', e);
		} finally {
			this._subscriptionDropdown.loading = false;
		}
	}

	public async loadResourceGroupDropdown(): Promise<void> {
		try {
			this._resourceGroupDropdown.loading = true;
			const account = this.migrationStateModel._azureAccount;
			const subscription = this.migrationStateModel._sqlMigrationServiceSubscription;
			const serviceId = this.migrationStateModel._sqlMigrationService?.id;
			const resourceGroup = this.migrationStateModel._sqlMigrationServiceResourceGroup?.name ??
				serviceId !== undefined
				? getFullResourceGroupFromId(serviceId!)
				: undefined;

			const migrationServices = await utils.getAzureSqlMigrationServices(
				account,
				subscription);

			const resourceGroups = utils.getServiceResourceGroupsByLocation(
				migrationServices,
				this.migrationStateModel._location);

			this._resourceGroupDropdown.values = utils.getResourceDropdownValues(
				resourceGroups,
				constants.RESOURCE_GROUP_NOT_FOUND);

			this.migrationStateModel._sqlMigrationServices = migrationServices;
			this.migrationStateModel._resourceGroups = resourceGroups;
			utils.selectDefaultDropdownValue(this._resourceGroupDropdown, resourceGroup, false);
		} catch (e) {
			logError(TelemetryViews.IntegrationRuntimePage, 'Error loadResourceGroupDropdown', e);
		} finally {
			this._resourceGroupDropdown.loading = false;
		}
	}

	public loadDmsDropdown(): void {
		try {
			this._dmsDropdown.loading = true;
			const serviceId = this.migrationStateModel._sqlMigrationService?.id;

			this._dmsDropdown.values = utils.getAzureResourceDropdownValues(
				this.migrationStateModel._sqlMigrationServices,
				this.migrationStateModel._location,
				this.migrationStateModel._sqlMigrationServiceResourceGroup?.name,
				constants.SQL_MIGRATION_SERVICE_NOT_FOUND_ERROR);

			utils.selectDefaultDropdownValue(
				this._dmsDropdown,
				serviceId,
				false);
		} catch (e) {
			logError(TelemetryViews.IntegrationRuntimePage, 'Error loadDmsDropdown', e);
		} finally {
			this._dmsDropdown.loading = false;
		}
	}

	private _lastIn = 0;
	private async loadStatus(): Promise<void> {
		const callSequence = ++this._lastIn;
		let serviceName = '';
		try {
			if (callSequence === this._lastIn) {
				this._statusLoadingComponent.loading = true;
			}

			const service = this.migrationStateModel._sqlMigrationService;
			if (service) {
				const account = this.migrationStateModel._azureAccount;
				const subscription = this.migrationStateModel._sqlMigrationServiceSubscription;
				const resourceGroup = this.migrationStateModel._sqlMigrationServiceResourceGroup?.name;
				const location = service.location;
				serviceName = service.name;
				if (service?.properties?.integrationRuntimeState) {
					service.properties.integrationRuntimeState = undefined;
				}

				const migrationService = await getSqlMigrationService(
					account,
					subscription,
					resourceGroup,
					location,
					serviceName);

				// exit if new call has started
				if (callSequence !== this._lastIn) { return; }

				const migrationServiceMonitoringStatus = await getSqlMigrationServiceMonitoringData(
					account,
					subscription,
					resourceGroup,
					location,
					serviceName);

				const nodeNames = migrationServiceMonitoringStatus.nodes.map(
					node => node.nodeName);

				// exit if new call has started
				if (callSequence !== this._lastIn) { return; }

				const state = migrationService.properties.integrationRuntimeState;
				if (state === 'Online') {
					await this._dmsStatusInfoBox.updateProperties(<azdata.InfoBoxComponentProperties>{
						text: constants.SERVICE_READY_WITHOUT_NODENAMES(serviceName),
						style: 'success'
					});
				} else {
					await this._dmsStatusInfoBox.updateProperties(<azdata.InfoBoxComponentProperties>{
						text: constants.SERVICE_NOT_READY(serviceName, false),
						style: 'error'
					});
				}

				// exit if new call has started
				if (callSequence !== this._lastIn) { return; }

				// populate the table with data
				await utils.refreshIntegrationRuntimeTable(this._view, this._integrationRuntimeTable, migrationServiceMonitoringStatus);

				// based on the data, enable or disable configure ir button
				if (migrationServiceMonitoringStatus.nodes.length === 4 &&
					this.atleastOneNodeOnline(migrationServiceMonitoringStatus.nodes)) {
					this._configureIRButton.enabled = false;
				}
				else {
					this._configureIRButton.enabled = true;
				}

				// if the versions are mismatched, show a warning
				if (migrationServiceMonitoringStatus?.nodes.length === 1) {
					let nodeversion = migrationServiceMonitoringStatus.nodes[0].version;

					for (const node of migrationServiceMonitoringStatus.nodes) {
						if (node.version !== nodeversion && node.status === 'Online') {
							await this._dmsStatusInfoBox.updateProperties(<azdata.InfoBoxComponentProperties>{
								text: constants.VERSION_MISMATCH,
								style: 'warning'
							});
						}
					}
				}

				this.migrationStateModel._sqlMigrationService = migrationService;
				this.migrationStateModel._sqlMigrationServiceSubscription = subscription;
				this.migrationStateModel._nodeNames = nodeNames;
			}
		} catch (e) {
			await this._dmsStatusInfoBox.updateProperties(<azdata.InfoBoxComponentProperties>{
				text: constants.SERVICE_ERROR_NOT_READY(serviceName, e.message),
				style: 'error'
			});

			logError(TelemetryViews.IntegrationRuntimePage, 'Error loadStatus', e);
		} finally {
			if (callSequence === this._lastIn) {
				this._statusLoadingComponent.loading = false;
			}
		}
	}

	private atleastOneNodeOnline(nodes: IntegrationRuntimeNode[]): boolean {
		let result = false;
		nodes.forEach(node => {
			if (node.status === constants.ONLINE)
				result = true;
		});
		return result;
	}
}
