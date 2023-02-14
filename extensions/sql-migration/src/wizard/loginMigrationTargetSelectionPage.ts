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
import { collectSourceLogins, collectTargetLogins, getSourceConnectionId, getSourceConnectionProfile, isSourceConnectionSysAdmin, LoginTableInfo } from '../api/sqlUtils';
import { NetworkInterfaceModel } from '../api/dataModels/azure/networkInterfaceModel';
import { logError, TelemetryViews } from '../telemetry';

export class LoginMigrationTargetSelectionPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _disposables: vscode.Disposable[] = [];

	private _pageDescription!: azdata.TextComponent;
	private _azureSqlTargetTypeDropdown!: azdata.DropDownComponent;
	private _azureAccountsDropdown!: azdata.DropDownComponent;
	private _accountTenantDropdown!: azdata.DropDownComponent;
	private _accountTenantFlexContainer!: azdata.FlexContainer;
	private _azureSubscriptionDropdown!: azdata.DropDownComponent;
	private _azureLocationDropdown!: azdata.DropDownComponent;
	private _azureResourceGroupLabel!: azdata.TextComponent;
	private _azureResourceGroupDropdown!: azdata.DropDownComponent;
	private _azureResourceDropdownLabel!: azdata.TextComponent;
	private _azureResourceDropdown!: azdata.DropDownComponent;
	private _resourceSelectionContainer!: azdata.FlexContainer;
	private _resourceAuthenticationContainer!: azdata.FlexContainer;
	private _targetUserNameInputBox!: azdata.InputBoxComponent;
	private _targetPasswordInputBox!: azdata.InputBoxComponent;
	private _testConectionButton!: azdata.ButtonComponent;
	private _connectionResultsInfoBox!: azdata.InfoBoxComponent;
	private _migrationTargetPlatform!: MigrationTargetType;

	constructor(
		wizard: azdata.window.Wizard,
		migrationStateModel: MigrationStateModel) {
		super(
			wizard,
			azdata.window.createWizardPage(constants.LOGIN_MIGRATIONS_AZURE_SQL_TARGET_PAGE_TITLE),
			migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;

		const loginMigrationPreviewInfoBox = this._view.modelBuilder.infoBox()
			.withProps({
				style: 'information',
				text: constants.LOGIN_MIGRATIONS_TARGET_SELECTION_PAGE_PREVIEW_WARNING,
				CSSStyles: { ...styles.BODY_CSS }
			}).component();

		const loginMigrationInfoBox = this._view.modelBuilder.infoBox()
			.withProps({
				style: 'information',
				text: constants.LOGIN_MIGRATIONS_TARGET_SELECTION_PAGE_DATA_MIGRATION_WARNING,
				CSSStyles: { ...styles.BODY_CSS }
			}).component();

		const hasSysAdminPermissions: boolean = await isSourceConnectionSysAdmin();
		const connectionProfile: azdata.connection.ConnectionProfile = await getSourceConnectionProfile();
		const permissionsInfoBox = this._view.modelBuilder.infoBox()
			.withProps({
				style: 'warning',
				text: constants.LOGIN_MIGRATIONS_TARGET_SELECTION_PAGE_PERMISSIONS_WARNING(connectionProfile.userName, connectionProfile.serverName),
				CSSStyles: { ...styles.BODY_CSS },
			}).component();

		if (hasSysAdminPermissions) {
			await permissionsInfoBox.updateProperties({
				'CSSStyles': { 'display': 'none' },
			});
		}

		this._pageDescription = this._view.modelBuilder.text()
			.withProps({
				value: constants.LOGIN_MIGRATIONS_TARGET_SELECTION_PAGE_DESCRIPTION,
				CSSStyles: { ...styles.BODY_CSS, 'margin': '0' }
			}).component();

		const form = this._view.modelBuilder.formContainer()
			.withFormItems([
				{ component: loginMigrationPreviewInfoBox },
				{ component: loginMigrationInfoBox },
				{ component: permissionsInfoBox },
				{ component: this._pageDescription },
				{ component: this.createAzureSqlTargetTypeDropdown() },
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
		await this._view.initializeModel(form);
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.nextButton.enabled = false;
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			this.wizard.message = {
				text: '',
				level: azdata.window.MessageLevel.Error
			};
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}
			if (!this.migrationStateModel._targetServerInstance || !this.migrationStateModel._targetUserName || !this.migrationStateModel._targetPassword) {
				this.wizard.message = {
					text: constants.SELECT_DATABASE_TO_CONTINUE,
					level: azdata.window.MessageLevel.Error
				}; ``
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
				break;
		}

		if (this._targetUserNameInputBox) {
			await this._targetUserNameInputBox.updateProperty('required', true);
		}

		if (this._targetPasswordInputBox) {
			await this._targetPasswordInputBox.updateProperty('required', true);
		}

		await utils.updateControlDisplay(this._resourceAuthenticationContainer, true);
		await this.populateAzureAccountsDropdown();

		if (this._migrationTargetPlatform !== this.migrationStateModel._targetType) {
			// if the user had previously selected values on this page, then went back to change the migration target platform
			// and came back, forcibly reload the location/resource group/resource values since they will now be different
			this._migrationTargetPlatform = this.migrationStateModel._targetType;

			this._targetPasswordInputBox.value = '';
			this.migrationStateModel._sqlMigrationServices = undefined!;
			this.migrationStateModel._targetServerInstance = undefined!;
			this.migrationStateModel._targetServerName = undefined!;
			this.migrationStateModel._resourceGroup = undefined!;
			this.migrationStateModel._location = undefined!;
			await this.populateLocationDropdown();
		}

		if (this.migrationStateModel._didUpdateDatabasesForMigration) {
			this._updateConnectionButtonState();
		}

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
					if (targetMi.properties.state !== 'Ready') {
						errors.push(constants.MI_NOT_READY_ERROR(targetMi.name, targetMi.properties.state));
					}
					break;
				case MigrationTargetType.SQLVM:
					const targetVm = this.migrationStateModel._targetServerInstance as SqlVMServer;
					if (!targetVm || resourceDropdownValue === constants.NO_VIRTUAL_MACHINE_FOUND) {
						errors.push(constants.INVALID_VIRTUAL_MACHINE_ERROR);
					}
					break;
				case MigrationTargetType.SQLDB:
					const targetSqlDB = this.migrationStateModel._targetServerInstance as AzureSqlDatabaseServer;
					if (!targetSqlDB || resourceDropdownValue === constants.NO_SQL_DATABASE_FOUND) {
						errors.push(constants.INVALID_SQL_DATABASE_ERROR);
					}
					// TODO: verify what state check is needed/possible?
					if (targetSqlDB.properties.state !== 'Ready') {
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
	}

	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.registerNavigationValidator(async (pageChangeInfo) => true);
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private createAzureSqlTargetTypeDropdown(): azdata.FlexContainer {
		const azureSqlTargetTypeLabel = this._view.modelBuilder.text().withProps({
			value: constants.LOGIN_MIGRATIONS_TARGET_TYPE_SELECTION_TITLE,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS,
				'margin-top': '-1em'
			}
		}).component();

		this._azureSqlTargetTypeDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.LOGIN_MIGRATIONS_TARGET_TYPE_SELECTION_TITLE,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			editable: true,
			required: true,
			fireOnTextChange: true,
			placeholder: constants.SELECT_AN_TARGET_TYPE,
			CSSStyles: {
				'margin-top': '-1em'
			},
		}).component();

		this._azureSqlTargetTypeDropdown.values = [/* constants.LOGIN_MIGRATIONS_DB_TEXT, */ constants.LOGIN_MIGRATIONS_MI_TEXT, constants.LOGIN_MIGRATIONS_VM_TEXT];

		this._disposables.push(this._azureSqlTargetTypeDropdown.onValueChanged(async (value) => {
			switch (value) {
				case constants.LOGIN_MIGRATIONS_DB_TEXT: {
					this.migrationStateModel._targetType = MigrationTargetType.SQLDB;
					break;
				}
				case constants.LOGIN_MIGRATIONS_MI_TEXT: {
					this.migrationStateModel._targetType = MigrationTargetType.SQLMI;
					break;
				}
				case constants.LOGIN_MIGRATIONS_VM_TEXT: {
					this.migrationStateModel._targetType = MigrationTargetType.SQLVM;
					break;
				}
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
					break;
			}
			await this.populateAzureAccountsDropdown();
			await this.populateSubscriptionDropdown();
			await this.populateLocationDropdown();

			// Collect source login info here, as it will speed up loading the next page
			const sourceLogins: LoginTableInfo[] = [];
			sourceLogins.push(...await collectSourceLogins(
				await getSourceConnectionId(),
				this.migrationStateModel.isWindowsAuthMigrationSupported));
			this.migrationStateModel._loginMigrationModel.collectedSourceLogins = true;
			this.migrationStateModel._loginMigrationModel.loginsOnSource = sourceLogins;
		}));

		const flexContainer = this._view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column'
			})
			.withItems([
				azureSqlTargetTypeLabel,
				this._azureSqlTargetTypeDropdown
			])
			.component();
		return flexContainer;
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
					const selectedAccount = this.migrationStateModel._azureAccounts.find(account => account.displayInfo.displayName === value);
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
					const selectedTenant = this.migrationStateModel._accountTenants.find(tenant => tenant.displayName === value);
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
					const selectedSubscription = this.migrationStateModel._subscriptions.find(subscription => `${subscription.name} - ${subscription.id}` === value);
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
					const selectedLocation = this.migrationStateModel._locations.find(location => location.displayName === value);
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
				(value: string) => {
					this.migrationStateModel._targetUserName = value ?? '';
					this._updateConnectionButtonState();
				}));

		this._disposables.push(
			this._targetUserNameInputBox.onValidityChanged(
				valid => this._updateConnectionButtonState()));

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
				(value: string) => {
					this.migrationStateModel._targetPassword = value ?? '';
					this._updateConnectionButtonState();
				}));

		this._disposables.push(
			this._targetPasswordInputBox.onValidityChanged(
				valid => this._updateConnectionButtonState()));

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

				const targetDatabaseServer = this.migrationStateModel._targetServerInstance;
				const userName = this.migrationStateModel._targetUserName;
				const password = this.migrationStateModel._targetPassword;
				const loginsOnTarget: string[] = [];
				if (targetDatabaseServer && userName && password) {
					try {
						connectionButtonLoadingContainer.loading = true;
						await utils.updateControlDisplay(this._connectionResultsInfoBox, false);
						this.wizard.nextButton.enabled = false;
						loginsOnTarget.push(
							...await collectTargetLogins(
								this.migrationStateModel.targetServerName,
								targetDatabaseServer.id,
								userName,
								password,
								this.migrationStateModel.isWindowsAuthMigrationSupported));
						this.migrationStateModel._loginMigrationModel.collectedTargetLogins = true;
						this.migrationStateModel._loginMigrationModel.loginsOnTarget = loginsOnTarget;

						await this._showConnectionResults(loginsOnTarget);
					} catch (error) {
						this.wizard.message = {
							level: azdata.window.MessageLevel.Error,
							text: constants.AZURE_SQL_TARGET_CONNECTION_ERROR_TITLE,
							description: constants.SQL_TARGET_CONNECTION_ERROR(error.message),
						};
						await this._showConnectionResults(
							loginsOnTarget,
							constants.AZURE_SQL_TARGET_CONNECTION_ERROR_TITLE);

						logError(TelemetryViews.LoginMigrationWizard, 'ConnectingToTargetFailed', error);
					}
					finally {
						connectionButtonLoadingContainer.loading = false;
					}
				}
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

		return this._view.modelBuilder.flexContainer()
			.withItems([
				targetUserNameLabel,
				this._targetUserNameInputBox,
				targetPasswordLabel,
				this._targetPasswordInputBox,
				connectionContainer])
			.withLayout({ flexFlow: 'column' })
			.withProps({ CSSStyles: { 'margin': '15px 0 0 0' } })
			.component();
	}

	private async _showConnectionResults(
		logins: string[],
		errorMessage?: string): Promise<void> {

		const hasError = errorMessage !== undefined;
		this._connectionResultsInfoBox.style = hasError
			? 'error'
			: 'success';
		this._connectionResultsInfoBox.text = hasError
			? constants.SQL_TARGET_CONNECTION_ERROR(errorMessage)
			: constants.SQL_TARGET_CONNECTION_SUCCESS_LOGINS(logins.length.toLocaleString());
		await utils.updateControlDisplay(this._connectionResultsInfoBox, true);

		if (!hasError) {
			this.wizard.nextButton.enabled = true;
		}
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
					const selectedResourceGroup = this.migrationStateModel._resourceGroups.find(rg => rg.name === value);
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
							const selectedVm = this.migrationStateModel._targetSqlVirtualMachines.find(vm => vm.name === value);
							if (selectedVm) {
								this.migrationStateModel._targetServerInstance = utils.deepClone(selectedVm)! as SqlVMServer;
								this.migrationStateModel._vmInstanceView = await getVMInstanceView(this.migrationStateModel._targetServerInstance, this.migrationStateModel._azureAccount, this.migrationStateModel._targetSubscription);
								this.migrationStateModel._targetServerInstance.networkInterfaces = await NetworkInterfaceModel.getVmNetworkInterfaces(
									this.migrationStateModel._azureAccount,
									this.migrationStateModel._targetSubscription,
									this.migrationStateModel._targetServerInstance);
								this.migrationStateModel.setTargetServerName();

								this.wizard.message = { text: '' };

								// validate power state from VM instance view
								const runningState = 'PowerState/running'.toLowerCase();
								if (!this.migrationStateModel._vmInstanceView.statuses.some(status => status.code.toLowerCase() === runningState)) {
									this.wizard.message = {
										text: constants.VM_NOT_READY_POWER_STATE_ERROR(this.migrationStateModel._targetServerInstance.name),
										level: azdata.window.MessageLevel.Warning
									};
								}

								// validate IaaS extension mode
								const fullMode = 'Full'.toLowerCase();
								if (this.migrationStateModel._targetServerInstance.properties.sqlManagement.toLowerCase() !== fullMode) {
									this.wizard.message = {
										text: constants.VM_NOT_READY_IAAS_EXTENSION_ERROR(this.migrationStateModel._targetServerInstance.name, this.migrationStateModel._targetServerInstance.properties.sqlManagement),
										level: azdata.window.MessageLevel.Warning
									};
								}
							}
							break;
						case MigrationTargetType.SQLMI:
							const selectedMi = this.migrationStateModel._targetManagedInstances
								.find(mi => mi.name === value
									|| constants.UNAVAILABLE_TARGET_PREFIX(mi.name) === value);

							if (selectedMi) {
								this.migrationStateModel._targetServerInstance = utils.deepClone(selectedMi)! as azureResource.AzureSqlManagedInstance;
								this.migrationStateModel.setTargetServerName();

								this.wizard.message = { text: '' };
								if (this.migrationStateModel._targetServerInstance.properties.state !== 'Ready') {
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
							const sqlDatabaseServer = this.migrationStateModel._targetSqlDatabaseServers.find(
								sqldb => sqldb.name === value || constants.UNAVAILABLE_TARGET_PREFIX(sqldb.name) === value);

							if (sqlDatabaseServer) {
								this.migrationStateModel._targetServerInstance = utils.deepClone(sqlDatabaseServer)! as AzureSqlDatabaseServer;
								this.migrationStateModel.setTargetServerName();
								this.wizard.message = { text: '' };
								if (this.migrationStateModel._targetServerInstance.properties.state === 'Ready') {
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
				} else {
					this.migrationStateModel._targetServerInstance = undefined!;
					this.migrationStateModel._targetServerName = undefined!;
					if (isSqlDbTarget) {
						this._targetUserNameInputBox.value = '';
					}
				}

				this.migrationStateModel._sqlMigrationServices = undefined!;
				if (isSqlDbTarget) {
					this._targetPasswordInputBox.value = '';
					this._updateConnectionButtonState();
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

	private _updateConnectionButtonState(): void {
		const targetDatabaseServer = (this._azureResourceDropdown.value as azdata.CategoryValue)?.name ?? '';
		const userName = this._targetUserNameInputBox.value ?? '';
		const password = this._targetPasswordInputBox.value ?? '';
		this._testConectionButton.enabled = targetDatabaseServer.length > 0
			&& userName.length > 0
			&& password.length > 0;
	}

	private async populateAzureAccountsDropdown(): Promise<void> {
		try {
			this._azureAccountsDropdown.loading = true;
			this.migrationStateModel._azureAccounts = await utils.getAzureAccounts();
			this._azureAccountsDropdown.values = await utils.getAzureAccountsDropdownValues(this.migrationStateModel._azureAccounts);
		} finally {
			this._azureAccountsDropdown.loading = false;
			utils.selectDefaultDropdownValue(
				this._azureAccountsDropdown,
				this.migrationStateModel._azureAccount?.displayInfo?.userId,
				false);
		}
	}

	private async populateTenantsDropdown(): Promise<void> {
		try {
			this._accountTenantDropdown.loading = true;
			if (this.migrationStateModel._azureAccount && this.migrationStateModel._azureAccount.isStale === false && this.migrationStateModel._azureAccount.properties.tenants.length > 0) {
				this.migrationStateModel._accountTenants = utils.getAzureTenants(this.migrationStateModel._azureAccount);
				this._accountTenantDropdown.values = utils.getAzureTenantsDropdownValues(this.migrationStateModel._accountTenants);
			}
			utils.selectDefaultDropdownValue(
				this._accountTenantDropdown,
				this.migrationStateModel._azureTenant?.id,
				true);
			await this._accountTenantFlexContainer.updateCssStyles(this.migrationStateModel._azureAccount.properties.tenants.length > 1
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
			utils.selectDefaultDropdownValue(
				this._azureSubscriptionDropdown,
				this.migrationStateModel._targetSubscription?.id,
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
			this._azureLocationDropdown.values = utils.getAzureLocationsDropdownValues(this.migrationStateModel._locations);
		} catch (e) {
			console.log(e);
		} finally {
			this._azureLocationDropdown.loading = false;
			utils.selectDefaultDropdownValue(
				this._azureLocationDropdown,
				this.migrationStateModel._location?.displayName,
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
					this._azureResourceDropdown.values = utils.getAzureResourceDropdownValues(
						this.migrationStateModel._targetSqlVirtualMachines,
						this.migrationStateModel._location,
						this.migrationStateModel._resourceGroup?.name,
						constants.NO_VIRTUAL_MACHINE_FOUND);

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
			utils.selectDefaultDropdownValue(
				this._azureResourceDropdown,
				this.migrationStateModel._targetServerInstance?.name,
				true);
		}
	}
}
