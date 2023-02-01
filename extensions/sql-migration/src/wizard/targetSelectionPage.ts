/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { EOL } from 'os';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, MigrationTargetType, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import * as styles from '../constants/styles';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import * as utils from '../api/utils';
import { azureResource } from 'azurecore';
import { AzureSqlDatabaseServer, getVMInstanceView, SqlVMServer } from '../api/azure';
import { collectTargetDatabaseInfo, TargetDatabaseInfo } from '../api/sqlUtils';
import { MigrationLocalStorage, MigrationServiceContext } from '../models/migrationLocalStorage';

export class TargetSelectionPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _disposables: vscode.Disposable[] = [];

	private _pageDescription!: azdata.TextComponent;
	private _azureAccountsDropdown!: azdata.DropDownComponent;
	private _accountTenantDropdown!: azdata.DropDownComponent;
	private _accountTenantFlexContainer!: azdata.FlexContainer;
	private _azureSubscriptionDropdown!: azdata.DropDownComponent;
	private _azureLocationDropdown!: azdata.DropDownComponent;
	private _azureResourceGroupLabel!: azdata.TextComponent;
	private _azureResourceGroupDropdown!: azdata.DropDownComponent;
	private _azureResourceDropdownLabel!: azdata.TextComponent;
	private _azureResourceDropdown!: azdata.DropDownComponent;
	private _azureResourceTable!: azdata.DeclarativeTableComponent;
	private _resourceSelectionContainer!: azdata.FlexContainer;
	private _resourceAuthenticationContainer!: azdata.FlexContainer;
	private _targetUserNameInputBox!: azdata.InputBoxComponent;
	private _targetPasswordInputBox!: azdata.InputBoxComponent;
	private _testConectionButton!: azdata.ButtonComponent;
	private _connectionResultsInfoBox!: azdata.InfoBoxComponent;
	private _migrationTargetPlatform!: MigrationTargetType;
	private _serviceContext!: MigrationServiceContext;

	constructor(
		wizard: azdata.window.Wizard,
		migrationStateModel: MigrationStateModel) {
		super(
			wizard,
			azdata.window.createWizardPage(constants.AZURE_SQL_TARGET_PAGE_TITLE),
			migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;

		this._serviceContext = await MigrationLocalStorage.getMigrationServiceContext();

		this._pageDescription = this._view.modelBuilder.text()
			.withProps({
				value: constants.AZURE_SQL_TARGET_PAGE_DESCRIPTION(),
				CSSStyles: { ...styles.BODY_CSS, 'margin': '0' }
			}).component();

		const form = this._view.modelBuilder.formContainer()
			.withFormItems([
				{ component: this._pageDescription },
				{ component: this.createAzureAccountsDropdown() },
				{ component: this.createAzureTenantContainer() },
				{ component: this.createTargetDropdownContainer() }
			]).withProps({
				CSSStyles: { 'padding-top': '0' }
			}).component();

		this._disposables.push(
			this._view.onClosed(e => {
				this._disposables.forEach(
					d => { try { d.dispose(); } catch { } });
			}));

		if (this.migrationStateModel.resumeAssessment) {
			await this.populateAzureAccountsDropdown();
		}

		await this._view.initializeModel(form);
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			this.wizard.message = { text: '' };
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}

			const errors: string[] = [];
			if (!this.migrationStateModel._azureAccount) {
				errors.push(constants.INVALID_ACCOUNT_ERROR);
			}

			if (!this.migrationStateModel._targetSubscription ||
				(<azdata.CategoryValue>this._azureSubscriptionDropdown.value)?.displayName === constants.NO_SUBSCRIPTIONS_FOUND) {
				errors.push(constants.INVALID_SUBSCRIPTION_ERROR);
			}
			if (!this.migrationStateModel._location ||
				(<azdata.CategoryValue>this._azureLocationDropdown.value)?.displayName === constants.NO_LOCATION_FOUND) {
				errors.push(constants.INVALID_LOCATION_ERROR);
			}
			if (!this.migrationStateModel._resourceGroup ||
				(<azdata.CategoryValue>this._azureResourceGroupDropdown.value)?.displayName === constants.RESOURCE_GROUP_NOT_FOUND) {
				errors.push(constants.INVALID_RESOURCE_GROUP_ERROR);
			}

			const resourceDropdownValue = (<azdata.CategoryValue>this._azureResourceDropdown.value)?.displayName;
			switch (this.migrationStateModel._targetType) {
				case MigrationTargetType.SQLMI:
					const targetMi = this.migrationStateModel._targetServerInstance as azureResource.AzureSqlManagedInstance;
					if (!targetMi || resourceDropdownValue === constants.NO_MANAGED_INSTANCE_FOUND) {
						errors.push(constants.INVALID_MANAGED_INSTANCE_ERROR);
					}
					if (targetMi && targetMi.properties?.state.toLowerCase() !== 'Ready'.toLowerCase()) {
						errors.push(constants.MI_NOT_READY_ERROR(targetMi.name, targetMi.properties?.state));
					}
					break;
				case MigrationTargetType.SQLVM:
					const targetVm = this.migrationStateModel._targetServerInstance as SqlVMServer;
					if (!targetVm || resourceDropdownValue === constants.NO_VIRTUAL_MACHINE_FOUND) {
						errors.push(constants.INVALID_VIRTUAL_MACHINE_ERROR);
					}

					// validate power state from VM instance view
					const vmInstanceView = this.migrationStateModel._vmInstanceView;
					if (!vmInstanceView.statuses.some(status => status.code.toLowerCase() === 'PowerState/running'.toLowerCase())) {
						errors.push(constants.VM_NOT_READY_POWER_STATE_ERROR(targetVm.name));
					}

					// validate IaaS extension mode
					if (targetVm.properties.sqlManagement.toLowerCase() !== 'Full'.toLowerCase()) {
						errors.push(constants.VM_NOT_READY_IAAS_EXTENSION_ERROR(targetVm.name, targetVm.properties.sqlManagement));
					}
					break;
				case MigrationTargetType.SQLDB:
					const targetSqlDB = this.migrationStateModel._targetServerInstance as AzureSqlDatabaseServer;
					if (!targetSqlDB || resourceDropdownValue === constants.NO_SQL_DATABASE_FOUND) {
						errors.push(constants.INVALID_SQL_DATABASE_ERROR);
					}
					// TODO: verify what state check is needed/possible?
					if (targetSqlDB && targetSqlDB.properties?.state.toLowerCase() !== 'Ready'.toLowerCase()) {
						errors.push(constants.SQLDB_NOT_READY_ERROR(targetSqlDB.name, targetSqlDB.properties.state));
					}

					// validate target sqldb username exists
					const targetUsernameValue = this._targetUserNameInputBox.value ?? '';
					if (targetUsernameValue.length < 1) {
						errors.push(constants.MISSING_TARGET_USERNAME_ERROR);
					}

					// validate target sqldb password exists
					const targetPasswordValue = this._targetPasswordInputBox.value ?? '';
					if (targetPasswordValue.length < 1) {
						errors.push(constants.MISSING_TARGET_PASSWORD_ERROR);
					}

					// validate source and target database mapping
					const mappingErrors = this._getSourceTargetMappingErrors();
					if (mappingErrors.length > 0) {
						errors.push(...mappingErrors);
					}
					break;
			}

			if (errors.length > 0) {
				this.wizard.message = {
					text: errors.join(EOL),
					level: azdata.window.MessageLevel.Error
				};
				return false;
			}
			return true;
		});

		if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
			return;
		}
		switch (this.migrationStateModel._targetType) {
			case MigrationTargetType.SQLMI:
				this._pageDescription.value = constants.AZURE_SQL_TARGET_PAGE_DESCRIPTION(constants.SKU_RECOMMENDATION_MI_CARD_TEXT);
				this._azureResourceDropdownLabel.value = constants.AZURE_SQL_DATABASE_MANAGED_INSTANCE;
				this._azureResourceDropdown.ariaLabel = constants.AZURE_SQL_DATABASE_MANAGED_INSTANCE;
				break;
			case MigrationTargetType.SQLVM:
				this._pageDescription.value = constants.AZURE_SQL_TARGET_PAGE_DESCRIPTION(constants.SKU_RECOMMENDATION_VM_CARD_TEXT);
				this._azureResourceDropdownLabel.value = constants.AZURE_SQL_DATABASE_VIRTUAL_MACHINE;
				this._azureResourceDropdown.ariaLabel = constants.AZURE_SQL_DATABASE_VIRTUAL_MACHINE;
				break;
			case MigrationTargetType.SQLDB:
				this._pageDescription.value = constants.AZURE_SQL_TARGET_PAGE_DESCRIPTION(constants.SKU_RECOMMENDATION_SQLDB_CARD_TEXT);
				this._azureResourceDropdownLabel.value = constants.AZURE_SQL_DATABASE;
				this._azureResourceDropdown.ariaLabel = constants.AZURE_SQL_DATABASE;
				this._updateConnectionButtonState();
				if (this.migrationStateModel._didUpdateDatabasesForMigration) {
					await this._resetTargetMapping();
					this.migrationStateModel._didUpdateDatabasesForMigration = false;
				}
				break;
		}

		const isSqlDbTarget = this.migrationStateModel._targetType === MigrationTargetType.SQLDB;
		await this._targetUserNameInputBox.updateProperties({ required: isSqlDbTarget });
		await this._targetPasswordInputBox.updateProperties({ required: isSqlDbTarget });
		await utils.updateControlDisplay(this._resourceAuthenticationContainer, isSqlDbTarget);

		if (this._migrationTargetPlatform !== this.migrationStateModel._targetType) {
			// if the user had previously selected values on this page, then went back to change the migration target platform
			// and came back, forcibly reload the location/resource group/resource values since they will now be different
			this._migrationTargetPlatform = this.migrationStateModel._targetType;

			this._targetPasswordInputBox.value = '';
			this.migrationStateModel._sqlMigrationServices = undefined!;
			this.migrationStateModel._azureAccount = undefined!;
			this.migrationStateModel._azureTenant = undefined!;
			this.migrationStateModel._targetSubscription = undefined!;
			this.migrationStateModel._location = undefined!;
			this.migrationStateModel._resourceGroup = undefined!;
			this.migrationStateModel._targetServerInstance = undefined!;

			const clearDropDown = async (dropDown: azdata.DropDownComponent): Promise<void> => {
				dropDown.values = [];
				dropDown.value = undefined;
			};
			await clearDropDown(this._azureAccountsDropdown);
			await clearDropDown(this._accountTenantDropdown);
			await clearDropDown(this._azureSubscriptionDropdown);
			await clearDropDown(this._azureLocationDropdown);
			await clearDropDown(this._azureResourceGroupDropdown);
			await clearDropDown(this._azureResourceDropdown);
		}

		await this.populateAzureAccountsDropdown();
	}

	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.registerNavigationValidator(pageChangeInfo => true);
		this.wizard.message = { text: '' };
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private createAzureAccountsDropdown(): azdata.FlexContainer {
		const azureAccountLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.ACCOUNTS_SELECTION_PAGE_TITLE,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: { ...styles.LABEL_CSS, 'margin-top': '-1em' }
			}).component();
		this._azureAccountsDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.ACCOUNTS_SELECTION_PAGE_TITLE,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				required: true,
				fireOnTextChange: true,
				placeholder: constants.SELECT_AN_ACCOUNT,
				CSSStyles: { 'margin-top': '-1em' },
			}).component();
		this._disposables.push(
			this._azureAccountsDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined') {
					const selectedAccount = this.migrationStateModel._azureAccounts?.find(account => account.displayInfo.displayName === value);
					this.migrationStateModel._azureAccount = (selectedAccount)
						? utils.deepClone(selectedAccount)!
						: undefined!;
				}
				await this.populateTenantsDropdown();
			}));

		const linkAccountButton = this._view.modelBuilder.hyperlink()
			.withProps({
				label: constants.ACCOUNT_LINK_BUTTON_LABEL,
				url: '',
				CSSStyles: { ...styles.BODY_CSS }
			})
			.component();

		this._disposables.push(
			linkAccountButton.onDidClick(async (event) => {
				await vscode.commands.executeCommand('workbench.actions.modal.linkedAccount');
				await this.populateAzureAccountsDropdown();
				this.wizard.message = { text: '' };
				await this._azureAccountsDropdown.validate();
			}));

		return this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([
				azureAccountLabel,
				this._azureAccountsDropdown,
				linkAccountButton])
			.component();
	}

	private createAzureTenantContainer(): azdata.FlexContainer {
		const azureTenantDropdownLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.AZURE_TENANT,
				CSSStyles: { ...styles.LABEL_CSS }
			}).component();

		this._accountTenantDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.AZURE_TENANT,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				fireOnTextChange: true,
				placeholder: constants.SELECT_A_TENANT
			}).component();

		this._disposables.push(
			this._accountTenantDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined') {
					/**
					 * Replacing all the tenants in azure account with the tenant user has selected.
					 * All azure requests will only run on this tenant from now on
					 */
					const selectedTenant = this.migrationStateModel._accountTenants?.find(tenant => tenant.displayName === value);
					if (selectedTenant) {
						this.migrationStateModel._azureTenant = utils.deepClone(selectedTenant)!;
						this.migrationStateModel._azureAccount.properties.tenants = [this.migrationStateModel._azureTenant];
					}
				}
				await this.populateSubscriptionDropdown();
			}));

		this._accountTenantFlexContainer = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([
				azureTenantDropdownLabel,
				this._accountTenantDropdown])
			.withProps({ CSSStyles: { 'display': 'none' } })
			.component();
		return this._accountTenantFlexContainer;
	}

	private createTargetDropdownContainer(): azdata.FlexContainer {
		const subscriptionDropdownLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.SUBSCRIPTION,
				description: constants.TARGET_SUBSCRIPTION_INFO,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: { ...styles.LABEL_CSS, }
			}).component();
		this._azureSubscriptionDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.SUBSCRIPTION,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				required: true,
				fireOnTextChange: true,
				placeholder: constants.SELECT_A_SUBSCRIPTION,
				CSSStyles: { 'margin-top': '-1em' },
			}).component();
		this._disposables.push(
			this._azureSubscriptionDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined' && value !== constants.NO_SUBSCRIPTIONS_FOUND) {
					const selectedSubscription = this.migrationStateModel._subscriptions?.find(
						subscription => `${subscription.name} - ${subscription.id}` === value);
					this.migrationStateModel._targetSubscription = (selectedSubscription)
						? utils.deepClone(selectedSubscription)!
						: undefined!;
					this.migrationStateModel.refreshDatabaseBackupPage = true;
				}
				await this.populateLocationDropdown();
			}));

		const azureLocationLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.LOCATION,
				description: constants.TARGET_LOCATION_INFO,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: { ...styles.LABEL_CSS }
			}).component();
		this._azureLocationDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.LOCATION,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				required: true,
				fireOnTextChange: true,
				placeholder: constants.SELECT_A_LOCATION,
				CSSStyles: { 'margin-top': '-1em' },
			}).component();
		this._disposables.push(
			this._azureLocationDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined' && value !== constants.NO_LOCATION_FOUND) {
					const selectedLocation = this.migrationStateModel._locations?.find(location => location.displayName === value);
					this.migrationStateModel._location = (selectedLocation)
						? utils.deepClone(selectedLocation)!
						: undefined!;
				}
				this.migrationStateModel.refreshDatabaseBackupPage = true;
				await this.populateResourceGroupDropdown();
			}));

		this._resourceSelectionContainer = this._createResourceDropdowns();
		this._resourceAuthenticationContainer = this._createResourceAuthenticationContainer();

		return this._view.modelBuilder.flexContainer()
			.withItems([
				subscriptionDropdownLabel,
				this._azureSubscriptionDropdown,
				azureLocationLabel,
				this._azureLocationDropdown,
				this._resourceSelectionContainer,
				this._resourceAuthenticationContainer])
			.withLayout({ flexFlow: 'column' })
			.component();
	}

	private _createResourceAuthenticationContainer(): azdata.FlexContainer {
		// target user name
		const targetUserNameLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.TARGET_USERNAME_LAbEL,
				requiredIndicator: true,
				CSSStyles: { ...styles.LABEL_CSS, 'margin-top': '-1em' }
			}).component();
		this._targetUserNameInputBox = this._view.modelBuilder.inputBox()
			.withProps({
				width: '300px',
				inputType: 'text',
				placeHolder: constants.TARGET_USERNAME_PLACEHOLDER,
				required: false,
				CSSStyles: { 'margin-top': '-1em' },
			}).component();

		this._disposables.push(
			this._targetUserNameInputBox.onTextChanged(
				async (value: string) => {
					this.migrationStateModel._targetUserName = value ?? '';
					await this._resetTargetMapping();
				}));

		// target password
		const targetPasswordLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.TARGET_PASSWORD_LAbEL,
				requiredIndicator: true,
				title: '',
				CSSStyles: { ...styles.LABEL_CSS, 'margin-top': '-1em' }
			}).component();
		this._targetPasswordInputBox = this._view.modelBuilder.inputBox()
			.withProps({
				width: '300px',
				inputType: 'password',
				placeHolder: constants.TARGET_PASSWORD_PLACEHOLDER,
				required: false,
				CSSStyles: { 'margin-top': '-1em' },
			}).component();
		this._disposables.push(
			this._targetPasswordInputBox.onTextChanged(
				async (value: string) => {
					this.migrationStateModel._targetPassword = value ?? '';
					await this._resetTargetMapping();
				}));

		// test connection button
		this._testConectionButton = this._view.modelBuilder.button()
			.withProps({
				enabled: false,
				label: constants.TARGET_CONNECTION_LABEL,
				width: '80px',
			}).component();

		this._connectionResultsInfoBox = this._view.modelBuilder.infoBox()
			.withProps({
				style: 'success',
				text: '',
				announceText: true,
				CSSStyles: { 'display': 'none' },
			})
			.component();

		const connectionButtonLoadingContainer = this._view.modelBuilder.loadingComponent()
			.withItem(this._testConectionButton)
			.withProps({ loading: false })
			.component();

		this._disposables.push(
			this._testConectionButton.onDidClick(async (value) => {
				this.wizard.message = { text: '' };

				const targetDatabaseServer = this.migrationStateModel._targetServerInstance as AzureSqlDatabaseServer;
				const userName = this.migrationStateModel._targetUserName;
				const password = this.migrationStateModel._targetPassword;
				const targetDatabases: TargetDatabaseInfo[] = [];
				if (targetDatabaseServer && userName && password) {
					try {
						connectionButtonLoadingContainer.loading = true;
						await utils.updateControlDisplay(this._connectionResultsInfoBox, false);
						targetDatabases.push(
							...await collectTargetDatabaseInfo(
								targetDatabaseServer,
								userName,
								password));
						await this._showConnectionResults(targetDatabases);
					} catch (error) {
						this.wizard.message = {
							level: azdata.window.MessageLevel.Error,
							text: constants.AZURE_SQL_TARGET_CONNECTION_ERROR_TITLE,
							description: constants.SQL_TARGET_CONNECTION_ERROR(error.message),
						};
						await this._showConnectionResults(
							targetDatabases,
							constants.AZURE_SQL_TARGET_CONNECTION_ERROR_TITLE);
					}
					finally {
						connectionButtonLoadingContainer.loading = false;
					}
				}
				await this._populateResourceMappingTable(targetDatabases);
			}));

		const connectionContainer = this._view.modelBuilder.flexContainer()
			.withItems([
				connectionButtonLoadingContainer,
				this._connectionResultsInfoBox],
				{ flex: '0 0 auto' })
			.withLayout({
				flexFlow: 'row',
				alignContent: 'center',
				alignItems: 'center',
			})
			.withProps({ CSSStyles: { 'margin': '15px 0 0 0' } })
			.component();

		const mapSourceHeading = this._view.modelBuilder.text()
			.withProps({
				value: constants.MAP_SOURCE_TARGET_HEADING,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					'font-weight': '600',
					'font-size': '16px',
					'margin': '15px 0 0 0',
				},
			})
			.component();
		const mapSourceDetails = this._view.modelBuilder.text()
			.withProps({
				value: constants.MAP_SOURCE_TARGET_DESCRIPTION,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: {
					'font-size': '13px',
					'margin': '15px 0 15px 0',
				},
			})
			.component();
		this._azureResourceTable = this._createResourceTable();

		return this._view.modelBuilder.flexContainer()
			.withItems([
				targetUserNameLabel,
				this._targetUserNameInputBox,
				targetPasswordLabel,
				this._targetPasswordInputBox,
				connectionContainer,
				mapSourceHeading,
				mapSourceDetails,
				this._azureResourceTable])
			.withLayout({ flexFlow: 'column' })
			.withProps({ CSSStyles: { 'margin': '15px 0 0 0' } })
			.component();
	}

	private async _resetTargetMapping(): Promise<void> {
		this._initializeSourceTargetDatabaseMap();
		this._updateConnectionButtonState();
		await this._azureResourceTable.setDataValues([]);
		await utils.updateControlDisplay(this._connectionResultsInfoBox, false);
	}

	private async _showConnectionResults(
		databases: TargetDatabaseInfo[],
		errorMessage?: string): Promise<void> {

		const hasError = errorMessage !== undefined;
		const hasDatabases = databases.length > 0;
		this._connectionResultsInfoBox.style = hasError
			? 'error'
			: hasDatabases
				? 'success'
				: 'warning';
		this._connectionResultsInfoBox.text = hasError
			? constants.SQL_TARGET_CONNECTION_ERROR(errorMessage)
			: hasDatabases
				? constants.SQL_TARGET_CONNECTION_SUCCESS(databases.length.toLocaleString())
				: constants.SQL_TARGET_MISSING_SOURCE_DATABASES;
		await utils.updateControlDisplay(this._connectionResultsInfoBox, true);
	}

	private _createResourceDropdowns(): azdata.FlexContainer {
		this._azureResourceGroupLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.RESOURCE_GROUP,
				description: constants.TARGET_RESOURCE_GROUP_INFO,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: { ...styles.LABEL_CSS }
			}).component();
		this._azureResourceGroupDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.RESOURCE_GROUP,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				required: true,
				fireOnTextChange: true,
				placeholder: constants.SELECT_A_RESOURCE_GROUP,
				CSSStyles: { 'margin-top': '-1em' },
			}).component();
		this._disposables.push(
			this._azureResourceGroupDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined' && value !== constants.RESOURCE_GROUP_NOT_FOUND) {
					const selectedResourceGroup = this.migrationStateModel._resourceGroups?.find(rg => rg.name === value);
					this.migrationStateModel._resourceGroup = (selectedResourceGroup)
						? utils.deepClone(selectedResourceGroup)!
						: undefined!;
				}
				await this.populateResourceInstanceDropdown();
			}));

		this._azureResourceDropdownLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.AZURE_SQL_DATABASE_MANAGED_INSTANCE,
				description: constants.TARGET_RESOURCE_INFO,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: { ...styles.LABEL_CSS }
			}).component();
		this._azureResourceDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.AZURE_SQL_DATABASE_MANAGED_INSTANCE,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				required: true,
				fireOnTextChange: true,
				placeholder: constants.SELECT_SERVICE_PLACEHOLDER,
				CSSStyles: { 'margin-top': '-1em' },
				loading: false,
			}).component();
		this._disposables.push(
			this._azureResourceDropdown.onValueChanged(async (value) => {
				const isSqlDbTarget = this.migrationStateModel._targetType === MigrationTargetType.SQLDB;
				if (value && value !== 'undefined' &&
					value !== constants.NO_MANAGED_INSTANCE_FOUND &&
					value !== constants.NO_SQL_DATABASE_SERVER_FOUND &&
					value !== constants.NO_VIRTUAL_MACHINE_FOUND) {

					switch (this.migrationStateModel._targetType) {
						case MigrationTargetType.SQLVM:
							const selectedVm = this.migrationStateModel._targetSqlVirtualMachines?.find(vm => vm.name === value
								|| constants.UNAVAILABLE_TARGET_PREFIX(vm.name) === value);

							if (selectedVm) {
								this.migrationStateModel._targetServerInstance = utils.deepClone(selectedVm)! as SqlVMServer;
								this.migrationStateModel._vmInstanceView = await getVMInstanceView(this.migrationStateModel._targetServerInstance, this.migrationStateModel._azureAccount, this.migrationStateModel._targetSubscription);
								this.wizard.message = { text: '' };

								// validate power state from VM instance view
								if (!this.migrationStateModel._vmInstanceView.statuses.some(status => status.code.toLowerCase() === 'PowerState/running'.toLowerCase())) {
									this.wizard.message = {
										text: constants.VM_NOT_READY_POWER_STATE_ERROR(this.migrationStateModel._targetServerInstance.name),
										level: azdata.window.MessageLevel.Error
									};
								}

								// validate IaaS extension mode
								if (this.migrationStateModel._targetServerInstance.properties.sqlManagement.toLowerCase() !== 'Full'.toLowerCase()) {
									this.wizard.message = {
										text: constants.VM_NOT_READY_IAAS_EXTENSION_ERROR(this.migrationStateModel._targetServerInstance.name, this.migrationStateModel._targetServerInstance.properties.sqlManagement),
										level: azdata.window.MessageLevel.Error
									};
								}
							}
							break;
						case MigrationTargetType.SQLMI:
							const selectedMi = this.migrationStateModel._targetManagedInstances?.find(
								mi => mi.name === value ||
									constants.UNAVAILABLE_TARGET_PREFIX(mi.name) === value);

							if (selectedMi) {
								this.migrationStateModel._targetServerInstance = utils.deepClone(selectedMi)! as azureResource.AzureSqlManagedInstance;
								this.wizard.message = { text: '' };

								if (this.migrationStateModel._targetServerInstance.properties.state.toLowerCase() !== 'Ready'.toLowerCase()) {
									this.wizard.message = {
										text: constants.MI_NOT_READY_ERROR(
											this.migrationStateModel._targetServerInstance.name,
											this.migrationStateModel._targetServerInstance.properties.state),
										level: azdata.window.MessageLevel.Error
									};
								}
							}
							break;
						case MigrationTargetType.SQLDB:
							const sqlDatabaseServer = this.migrationStateModel._targetSqlDatabaseServers?.find(
								sqldb => sqldb.name === value || constants.UNAVAILABLE_TARGET_PREFIX(sqldb.name) === value);

							if (sqlDatabaseServer) {
								this.migrationStateModel._targetServerInstance = utils.deepClone(sqlDatabaseServer)! as AzureSqlDatabaseServer;
								this.wizard.message = { text: '' };
								if (this.migrationStateModel._targetServerInstance.properties.state.toLowerCase() === 'Ready'.toLowerCase()) {
									this._targetUserNameInputBox.value = this.migrationStateModel._targetServerInstance.properties.administratorLogin;
								} else {
									this.wizard.message = {
										text: constants.SQLDB_NOT_READY_ERROR(
											this.migrationStateModel._targetServerInstance.name,
											this.migrationStateModel._targetServerInstance.properties.state),
										level: azdata.window.MessageLevel.Error
									};
								}
							}
							break;
					}

					await this._validateFields();
				} else {
					this.migrationStateModel._targetServerInstance = undefined!;
					if (isSqlDbTarget) {
						this._targetUserNameInputBox.value = '';
					}
				}

				this.migrationStateModel._sqlMigrationServices = undefined!;
				if (isSqlDbTarget) {
					await this._resetTargetMapping();
					this._targetPasswordInputBox.value = '';
				}
			}));

		return this._view.modelBuilder.flexContainer()
			.withItems([
				this._azureResourceGroupLabel,
				this._azureResourceGroupDropdown,
				this._azureResourceDropdownLabel,
				this._azureResourceDropdown])
			.withLayout({ flexFlow: 'column' })
			.component();
	}

	private _initializeSourceTargetDatabaseMap(): void {
		// initialize source / target database map
		this.migrationStateModel._sourceTargetMapping = new Map();
		this.migrationStateModel._targetDatabaseNames = [];
		this.migrationStateModel._databasesForMigration.forEach(
			sourceDatabaseName => this.migrationStateModel._sourceTargetMapping.set(
				sourceDatabaseName, undefined));
	}

	private _updateConnectionButtonState(): void {
		const targetDatabaseServer = (this._azureResourceDropdown.value as azdata.CategoryValue)?.name ?? '';
		const userName = this.migrationStateModel._targetUserName ?? '';
		const password = this.migrationStateModel._targetPassword ?? '';
		this._testConectionButton.enabled = targetDatabaseServer.length > 0
			&& userName.length > 0
			&& password.length > 0;
	}

	private _createResourceTable(): azdata.DeclarativeTableComponent {
		const columWidth = '50%';
		const headerStyles = {
			'padding': '0px',
			'border-style': 'none',
			'text-align': 'left',
			'font-weight': '600',
		};
		const rowStyles = {
			'padding': '1px 0px',
			'border-style': 'none',
			'text-align': 'left',
			'white-space': 'nowrap',
			'text-overflow': 'ellipsis',
			'overflow': 'hidden',
		};

		return this._view.modelBuilder.declarativeTable()
			.withProps({
				ariaLabel: constants.MAP_SOURCE_TARGET_HEADING,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				data: [],
				display: 'inline-block',
				CSSStyles: { 'padding': '0px' },
				columns: [
					{
						displayName: constants.MAP_SOURCE_COLUMN,
						valueType: azdata.DeclarativeDataType.string,
						width: columWidth,
						isReadOnly: true,
						rowCssStyles: rowStyles,
						headerCssStyles: headerStyles,
					},
					{
						displayName: constants.MAP_TARGET_COLUMN,
						valueType: azdata.DeclarativeDataType.component,
						width: columWidth,
						isReadOnly: false,
						rowCssStyles: rowStyles,
						headerCssStyles: headerStyles,
					},
				],
			})
			.withValidation(
				table =>
					this.migrationStateModel._targetType !== MigrationTargetType.SQLDB
					|| (table.dataValues !== undefined && table.dataValues.length > 0))
			.component();
	}

	private async populateAzureAccountsDropdown(): Promise<void> {
		try {
			this._azureAccountsDropdown.loading = true;
			this.migrationStateModel._azureAccounts = await utils.getAzureAccounts();

			this._azureAccountsDropdown.values = await utils.getAzureAccountsDropdownValues(this.migrationStateModel._azureAccounts);
		} finally {
			this._azureAccountsDropdown.loading = false;
			const accountId =
				this.migrationStateModel._azureAccount?.displayInfo?.userId ??
				this._serviceContext?.azureAccount?.displayInfo?.userId;

			utils.selectDefaultDropdownValue(
				this._azureAccountsDropdown,
				accountId,
				false);
		}
	}

	private async populateTenantsDropdown(): Promise<void> {
		try {
			this._accountTenantDropdown.loading = true;
			if (this.migrationStateModel._azureAccount?.isStale === false &&
				this.migrationStateModel._azureAccount?.properties?.tenants?.length > 0) {
				this.migrationStateModel._accountTenants = utils.getAzureTenants(this.migrationStateModel._azureAccount);

				this._accountTenantDropdown.values = await utils.getAzureTenantsDropdownValues(this.migrationStateModel._accountTenants);
			}
			const tenantId =
				this.migrationStateModel._azureTenant?.id ??
				this._serviceContext?.tenant?.id;

			utils.selectDefaultDropdownValue(
				this._accountTenantDropdown,
				tenantId,
				true);
			await this._accountTenantFlexContainer.updateCssStyles(
				this.migrationStateModel._azureAccount?.properties?.tenants?.length > 1
					? { 'display': 'inline' }
					: { 'display': 'none' }
			);
			await this._azureAccountsDropdown.validate();
		} finally {
			this._accountTenantDropdown.loading = false;
		}
	}

	private async populateSubscriptionDropdown(): Promise<void> {
		try {
			this._azureSubscriptionDropdown.loading = true;
			this.migrationStateModel._subscriptions = await utils.getAzureSubscriptions(this.migrationStateModel._azureAccount);
			this._azureSubscriptionDropdown.values = await utils.getAzureSubscriptionsDropdownValues(this.migrationStateModel._subscriptions);
		} catch (e) {
			console.log(e);
		} finally {
			this._azureSubscriptionDropdown.loading = false;
			const subscriptionId =
				this.migrationStateModel._targetSubscription?.id ??
				this._serviceContext?.subscription?.id;

			utils.selectDefaultDropdownValue(
				this._azureSubscriptionDropdown,
				subscriptionId,
				false);
		}
	}

	public async populateLocationDropdown(): Promise<void> {
		try {
			this._azureLocationDropdown.loading = true;
			switch (this.migrationStateModel._targetType) {
				case MigrationTargetType.SQLMI:
					this.migrationStateModel._targetManagedInstances = await utils.getManagedInstances(
						this.migrationStateModel._azureAccount,
						this.migrationStateModel._targetSubscription);
					this.migrationStateModel._locations = await utils.getResourceLocations(
						this.migrationStateModel._azureAccount,
						this.migrationStateModel._targetSubscription,
						this.migrationStateModel._targetManagedInstances);
					break;
				case MigrationTargetType.SQLVM:
					this.migrationStateModel._targetSqlVirtualMachines = await utils.getVirtualMachines(
						this.migrationStateModel._azureAccount,
						this.migrationStateModel._targetSubscription);
					this.migrationStateModel._locations = await utils.getResourceLocations(
						this.migrationStateModel._azureAccount,
						this.migrationStateModel._targetSubscription,
						this.migrationStateModel._targetSqlVirtualMachines);
					break;
				case MigrationTargetType.SQLDB:
					this.migrationStateModel._targetSqlDatabaseServers = await utils.getAzureSqlDatabaseServers(
						this.migrationStateModel._azureAccount,
						this.migrationStateModel._targetSubscription);
					this.migrationStateModel._locations = await utils.getResourceLocations(
						this.migrationStateModel._azureAccount,
						this.migrationStateModel._targetSubscription,
						this.migrationStateModel._targetSqlDatabaseServers);
					break;
			}
			this._azureLocationDropdown.values = await utils.getAzureLocationsDropdownValues(this.migrationStateModel._locations);
		} catch (e) {
			console.log(e);
		} finally {
			this._azureLocationDropdown.loading = false;
			const location =
				this.migrationStateModel._location?.displayName ??
				this._serviceContext?.location?.displayName;

			utils.selectDefaultDropdownValue(
				this._azureLocationDropdown,
				location,
				true);
		}
	}

	public async populateResourceGroupDropdown(): Promise<void> {
		try {
			this._azureResourceGroupDropdown.loading = true;
			switch (this.migrationStateModel._targetType) {
				case MigrationTargetType.SQLMI:
					this.migrationStateModel._resourceGroups = utils.getServiceResourceGroupsByLocation(
						this.migrationStateModel._targetManagedInstances,
						this.migrationStateModel._location);
					break;
				case MigrationTargetType.SQLVM:
					this.migrationStateModel._resourceGroups = utils.getServiceResourceGroupsByLocation(
						this.migrationStateModel._targetSqlVirtualMachines,
						this.migrationStateModel._location);
					break;
				case MigrationTargetType.SQLDB:
					this.migrationStateModel._resourceGroups = utils.getServiceResourceGroupsByLocation(
						this.migrationStateModel._targetSqlDatabaseServers,
						this.migrationStateModel._location);
					break;
			}
			this._azureResourceGroupDropdown.values = utils.getResourceDropdownValues(
				this.migrationStateModel._resourceGroups,
				constants.RESOURCE_GROUP_NOT_FOUND);
		} catch (e) {
			console.log(e);
		} finally {
			this._azureResourceGroupDropdown.loading = false;

			utils.selectDefaultDropdownValue(
				this._azureResourceGroupDropdown,
				this.migrationStateModel._resourceGroup?.id,
				false);
		}
	}

	private async populateResourceInstanceDropdown(): Promise<void> {
		try {
			this._azureResourceDropdown.loading = true;
			switch (this.migrationStateModel._targetType) {
				case MigrationTargetType.SQLMI:
					this._azureResourceDropdown.values = await utils.getManagedInstancesDropdownValues(
						this.migrationStateModel._targetManagedInstances,
						this.migrationStateModel._location,
						this.migrationStateModel._resourceGroup);
					break;
				case MigrationTargetType.SQLVM:
					this._azureResourceDropdown.values = await utils.getVirtualMachinesDropdownValues(
						this.migrationStateModel._targetSqlVirtualMachines,
						this.migrationStateModel._location,
						this.migrationStateModel._resourceGroup,
						this.migrationStateModel._azureAccount,
						this.migrationStateModel._targetSubscription);
					break;
				case MigrationTargetType.SQLDB:
					this._azureResourceDropdown.values = utils.getAzureResourceDropdownValues(
						this.migrationStateModel._targetSqlDatabaseServers,
						this.migrationStateModel._location,
						this.migrationStateModel._resourceGroup?.name,
						constants.NO_SQL_DATABASE_SERVER_FOUND);
					break;
			}
		} finally {
			this._azureResourceDropdown.loading = false;
			let targetName = '';
			switch (this.migrationStateModel._targetType) {
				case MigrationTargetType.SQLMI:
					targetName = (this.migrationStateModel._targetServerInstance as azureResource.AzureSqlManagedInstance)?.name;
					break;
				case MigrationTargetType.SQLVM:
					targetName = (this.migrationStateModel._targetServerInstance as SqlVMServer)?.name;
					break;
				case MigrationTargetType.SQLDB:
					targetName = (this.migrationStateModel._targetServerInstance as AzureSqlDatabaseServer)?.name;
					break;
			}

			utils.selectDefaultDropdownValue(
				this._azureResourceDropdown,
				targetName,
				true);
		}
	}

	private async _populateResourceMappingTable(targetDatabases: TargetDatabaseInfo[]): Promise<void> {
		// populate target database list
		const databaseValues = this._getTargetDatabaseDropdownValues(
			targetDatabases,
			constants.NO_SQL_DATABASE_FOUND);

		const data: azdata.DeclarativeTableCellValue[][] = this.migrationStateModel._databasesForMigration
			.map(sourceDatabase => {
				// target database dropdown
				const targetDatabaseDropDown = this._view.modelBuilder.dropDown()
					.withProps({
						width: '100%',
						required: true,
						editable: true,
						fireOnTextChange: true,
						values: databaseValues,
						placeholder: constants.MAP_TARGET_PLACEHOLDER,
					})
					.component();
				this._disposables.push(
					targetDatabaseDropDown.onValueChanged((targetDatabaseName: string) => {
						const targetDatabaseInfo = targetDatabases?.find(
							targetDb => targetDb.databaseName === targetDatabaseName);
						this.migrationStateModel._sourceTargetMapping.set(
							sourceDatabase,
							targetDatabaseInfo);
						this.migrationStateModel.refreshDatabaseBackupPage = true;
						this.migrationStateModel._didDatabaseMappingChange = true;
					}));

				const targetDatabaseName = this.migrationStateModel._sourceTargetMapping.get(sourceDatabase)?.databaseName ?? '';
				if (targetDatabaseName.length > 0) {
					utils.selectDefaultDropdownValue(
						targetDatabaseDropDown,
						targetDatabaseName);
				}

				return [
					<azdata.DeclarativeTableCellValue>{ value: sourceDatabase },
					<azdata.DeclarativeTableCellValue>{ value: targetDatabaseDropDown },
				];
			}) || [];

		await this._azureResourceTable.setDataValues(data);
	}

	private _getTargetDatabaseDropdownValues(
		databases: TargetDatabaseInfo[],
		resourceNotFoundMessage: string): azdata.CategoryValue[] {

		if (databases?.length > 0) {
			return databases.map<azdata.CategoryValue>(database => {
				const databaseName = database.databaseName;
				return { name: databaseName, displayName: databaseName };
			});
		}

		return [{ name: '', displayName: resourceNotFoundMessage }];
	}

	private _getSourceTargetMappingErrors(): string[] {
		// Validate source/target database mappings:
		var errors: string[] = [];
		const collationErrors: string[] = [];
		const targetDatabaseKeys = new Map<string, string>();
		const migrationDatabaseCount = this._azureResourceTable.dataValues?.length ?? 0;
		this.migrationStateModel._targetDatabaseNames = [];
		const databaseInfosForMigration = new Map(this.migrationStateModel._databaseInfosForMigration.map(o => [o.databaseName, o]));

		if (migrationDatabaseCount === 0) {
			errors.push(constants.SQL_TARGET_MAPPING_ERROR_MISSING_TARGET);
		} else {
			for (let i = 0; i < this.migrationStateModel._databasesForMigration.length; i++) {
				const sourceDatabaseName = this.migrationStateModel._databasesForMigration[i];
				const sourceDatabaseInfo = databaseInfosForMigration.get(sourceDatabaseName);
				const targetDatabaseInfo = this.migrationStateModel._sourceTargetMapping.get(sourceDatabaseName);
				const targetDatabaseName = targetDatabaseInfo?.databaseName;
				const sourceDatabaseCollation = sourceDatabaseInfo?.databaseCollation;
				const targetDatabaseCollation = targetDatabaseInfo?.databaseCollation;
				if (targetDatabaseName && targetDatabaseName.length > 0) {
					if (!targetDatabaseKeys.has(targetDatabaseName)) {
						targetDatabaseKeys.set(targetDatabaseName, sourceDatabaseName);
						this.migrationStateModel._targetDatabaseNames.push(targetDatabaseName);
					} else {
						const mappedSourceDatabaseName = targetDatabaseKeys.get(targetDatabaseName) ?? '';
						// target mapped only once
						errors.push(
							constants.SQL_TARGET_CONNECTION_DUPLICATE_TARGET_MAPPING(
								targetDatabaseName,
								sourceDatabaseName,
								mappedSourceDatabaseName));
					}

					// Collation validation
					if (!this._isCollationSame(sourceDatabaseCollation, targetDatabaseCollation)) {
						collationErrors.push(
							constants.SQL_TARGET_SOURCE_COLLATION_NOT_SAME(
								sourceDatabaseName,
								targetDatabaseName,
								sourceDatabaseCollation,
								targetDatabaseCollation));
					}
				} else {
					// source/target has mapping
					errors.push(constants.SQL_TARGET_CONNECTION_SOURCE_NOT_MAPPED(sourceDatabaseName));
				}
			}
		}

		if (collationErrors.length > 0) {
			collationErrors.push(constants.SQL_MIGRATION_TROUBLESHOOTING_LINK);
			errors = errors.concat(collationErrors);
		}

		return errors;
	}

	private async _validateFields(): Promise<void> {
		await this._azureAccountsDropdown.validate();
		await this._accountTenantDropdown.validate();
		await this._azureSubscriptionDropdown.validate();
		await this._azureLocationDropdown.validate();
		await this._azureResourceGroupDropdown.validate();
		await this._azureResourceDropdown.validate();
		await this._targetPasswordInputBox.validate();
		await this._targetUserNameInputBox.validate();
		await this._azureResourceTable.validate();
	}

	private _isCollationSame(sourceDatabaseCollation: string | undefined, targetDatabaseCollation: string | undefined): boolean {
		return sourceDatabaseCollation !== undefined &&
			sourceDatabaseCollation.length > 0 &&
			targetDatabaseCollation !== undefined &&
			targetDatabaseCollation.length > 0 &&
			sourceDatabaseCollation.toLocaleLowerCase() === targetDatabaseCollation.toLocaleLowerCase();
	}
}
