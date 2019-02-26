/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/sqlConnection';

import { Button } from 'sql/base/browser/ui/button/button';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import * as DialogHelper from 'sql/workbench/browser/modal/dialogHelper';
import { IConnectionComponentCallbacks } from 'sql/workbench/services/connection/browser/connectionDialogService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ConnectionOptionSpecialType } from 'sql/workbench/api/common/sqlExtHostTypes';
import * as Constants from 'sql/platform/connection/common/constants';
import { ConnectionProfileGroup, IConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { Dropdown } from 'sql/base/browser/ui/editableDropdown/dropdown';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import * as styler from 'sql/platform/theme/common/styler';
import { IAccountManagementService } from 'sql/platform/accountManagement/common/interfaces';

import * as sqlops from 'sqlops';

import * as lifecycle from 'vs/base/common/lifecycle';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { OS, OperatingSystem } from 'vs/base/common/platform';
import { Builder, $ } from 'sql/base/browser/builder';
import { MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { endsWith, startsWith } from 'vs/base/common/strings';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

export class ConnectionWidget {
	private _builder: Builder;
	private _serverGroupSelectBox: SelectBox;
	private _previousGroupOption: string;
	private _serverGroupOptions: IConnectionProfileGroup[];
	private _connectionNameInputBox: InputBox;
	private _serverNameInputBox: InputBox;
	private _databaseNameInputBox: Dropdown;
	private _userNameInputBox: InputBox;
	private _passwordInputBox: InputBox;
	private _password: string;
	private _rememberPasswordCheckBox: Checkbox;
	private _azureAccountDropdown: SelectBox;
	private _azureTenantDropdown: SelectBox;
	private _refreshCredentialsLinkBuilder: Builder;
	private _addAzureAccountMessage: string = localize('connectionWidget.AddAzureAccount', 'Add an account...');
	private readonly _azureProviderId = 'azurePublicCloud';
	private _azureTenantId: string;
	private _azureAccountList: sqlops.Account[];
	private _advancedButton: Button;
	private _callbacks: IConnectionComponentCallbacks;
	private _authTypeSelectBox: SelectBox;
	private _toDispose: lifecycle.IDisposable[];
	private _optionsMaps: { [optionType: number]: sqlops.ConnectionOption };
	private _tableContainer: Builder;
	private _focusedBeforeHandleOnConnection: HTMLElement;
	private _providerName: string;
	private _authTypeMap: { [providerName: string]: AuthenticationType[] } = {
		[Constants.mssqlProviderName]: [AuthenticationType.SqlLogin, AuthenticationType.Integrated, AuthenticationType.AzureMFA]
	};
	private _saveProfile: boolean;
	private _databaseDropdownExpanded: boolean = false;
	private _defaultDatabaseName: string = localize('defaultDatabaseOption', '<Default>');
	private _loadingDatabaseName: string = localize('loadingDatabaseOption', 'Loading...');
	private _serverGroupDisplayString: string = localize('serverGroup', 'Server group');
	public DefaultServerGroup: IConnectionProfileGroup = {
		id: '',
		name: localize('defaultServerGroup', '<Default>'),
		parentId: undefined,
		color: undefined,
		description: undefined,
	};

	private _addNewServerGroup = {
		id: '',
		name: localize('addNewServerGroup', 'Add new group...'),
		parentId: undefined,
		color: undefined,
		description: undefined,
	};
	public NoneServerGroup: IConnectionProfileGroup = {
		id: '',
		name: localize('noneServerGroup', '<Do not save>'),
		parentId: undefined,
		color: undefined,
		description: undefined,
	};
	constructor(options: sqlops.ConnectionOption[],
		callbacks: IConnectionComponentCallbacks,
		providerName: string,
		@IThemeService private _themeService: IThemeService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IClipboardService private _clipboardService: IClipboardService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@IAccountManagementService private _accountManagementService: IAccountManagementService
	) {
		this._callbacks = callbacks;
		this._toDispose = [];
		this._optionsMaps = {};
		for (var i = 0; i < options.length; i++) {
			var option = options[i];
			this._optionsMaps[option.specialValueType] = option;
		}

		var authTypeOption = this._optionsMaps[ConnectionOptionSpecialType.authType];
		if (authTypeOption) {
			if (OS === OperatingSystem.Windows) {
				authTypeOption.defaultValue = this.getAuthTypeDisplayName(AuthenticationType.Integrated);
			} else {
				authTypeOption.defaultValue = this.getAuthTypeDisplayName(AuthenticationType.SqlLogin);
			}
			this._authTypeSelectBox = new SelectBox(authTypeOption.categoryValues.map(c => c.displayName), authTypeOption.defaultValue, this._contextViewService, undefined, { ariaLabel: authTypeOption.displayName });
		}
		this._providerName = providerName;
	}

	public createConnectionWidget(container: HTMLElement): void {
		this._serverGroupOptions = [this.DefaultServerGroup];
		this._serverGroupSelectBox = new SelectBox(this._serverGroupOptions.map(g => g.name), this.DefaultServerGroup.name, this._contextViewService, undefined, { ariaLabel: this._serverGroupDisplayString });
		this._previousGroupOption = this._serverGroupSelectBox.value;
		this._builder = $().div({ class: 'connection-table' }, (modelTableContent) => {
			modelTableContent.element('table', { class: 'connection-table-content' }, (tableContainer) => {
				this._tableContainer = tableContainer;
			});
		});
		this.fillInConnectionForm();
		this.registerListeners();
		if (this._authTypeSelectBox) {
			this.onAuthTypeSelected(this._authTypeSelectBox.value);
		}

		DOM.addDisposableListener(container, 'paste', e => {
			this._handleClipboard();
		});

		DOM.append(container, this._builder.getHTMLElement());
	}

	private _handleClipboard(): void {
		if (this._configurationService.getValue<boolean>('connection.parseClipboardForConnectionString')) {
			let paste = this._clipboardService.readText();
			this._connectionManagementService.buildConnectionInfo(paste, this._providerName).then(e => {
				if (e) {
					let profile = new ConnectionProfile(this._capabilitiesService, this._providerName);
					profile.options = e.options;
					if (profile.serverName) {
						this.initDialog(profile);
					}
				}
			});
		}
	}

	private fillInConnectionForm(): void {
		// Server name
		let serverNameOption = this._optionsMaps[ConnectionOptionSpecialType.serverName];
		let serverNameBuilder = DialogHelper.appendRow(this._tableContainer, serverNameOption.displayName, 'connection-label', 'connection-input');
		this._serverNameInputBox = new InputBox(serverNameBuilder.getHTMLElement(), this._contextViewService, {
			validationOptions: {
				validation: (value: string) => {
					if (!value) {
						return ({ type: MessageType.ERROR, content: localize('connectionWidget.missingRequireField', '{0} is required.', serverNameOption.displayName) });
					} else if (startsWith(value, ' ') || endsWith(value, ' ')) {
						return ({ type: MessageType.WARNING, content: localize('connectionWidget.fieldWillBeTrimmed', '{0} will be trimmed.', serverNameOption.displayName) });
					}
					return undefined;
				}
			},
			ariaLabel: serverNameOption.displayName
		});

		// Authentication type
		if (this._optionsMaps[ConnectionOptionSpecialType.authType]) {
			let authTypeBuilder = DialogHelper.appendRow(this._tableContainer, this._optionsMaps[ConnectionOptionSpecialType.authType].displayName, 'connection-label', 'connection-input');
			DialogHelper.appendInputSelectBox(authTypeBuilder, this._authTypeSelectBox);
		}

		// Username
		let self = this;
		let userNameOption = this._optionsMaps[ConnectionOptionSpecialType.userName];
		let userNameBuilder = DialogHelper.appendRow(this._tableContainer, userNameOption.displayName, 'connection-label', 'connection-input', 'username-password-row');
		this._userNameInputBox = new InputBox(userNameBuilder.getHTMLElement(), this._contextViewService, {
			validationOptions: {
				validation: (value: string) => self.validateUsername(value, userNameOption.isRequired) ? ({ type: MessageType.ERROR, content: localize('connectionWidget.missingRequireField', '{0} is required.', userNameOption.displayName) }) : null
			},
			ariaLabel: userNameOption.displayName
		});
		// Password
		let passwordOption = this._optionsMaps[ConnectionOptionSpecialType.password];
		let passwordBuilder = DialogHelper.appendRow(this._tableContainer, passwordOption.displayName, 'connection-label', 'connection-input', 'username-password-row');
		this._passwordInputBox = new InputBox(passwordBuilder.getHTMLElement(), this._contextViewService, { ariaLabel: passwordOption.displayName });
		this._passwordInputBox.inputElement.type = 'password';
		this._password = '';

		// Remember password
		let rememberPasswordLabel = localize('rememberPassword', 'Remember password');
		this._rememberPasswordCheckBox = this.appendCheckbox(this._tableContainer, rememberPasswordLabel, 'connection-checkbox', 'connection-input', 'username-password-row', false);

		// Azure account picker
		let accountLabel = localize('connection.azureAccountDropdownLabel', 'Account');
		let accountDropdownBuilder = DialogHelper.appendRow(this._tableContainer, accountLabel, 'connection-label', 'connection-input', 'azure-account-row');
		this._azureAccountDropdown = new SelectBox([], undefined, this._contextViewService, accountDropdownBuilder.getContainer(), { ariaLabel: accountLabel });
		DialogHelper.appendInputSelectBox(accountDropdownBuilder, this._azureAccountDropdown);
		let refreshCredentialsBuilder = DialogHelper.appendRow(this._tableContainer, '', 'connection-label', 'connection-input', 'azure-account-row refresh-credentials-link');
		this._refreshCredentialsLinkBuilder = refreshCredentialsBuilder.a({ href: '#' }).text(localize('connectionWidget.refreshAzureCredentials', 'Refresh account credentials'));

		// Azure tenant picker
		let tenantLabel = localize('connection.azureTenantDropdownLabel', 'Azure AD tenant');
		let tenantDropdownBuilder = DialogHelper.appendRow(this._tableContainer, tenantLabel, 'connection-label', 'connection-input', 'azure-account-row azure-tenant-row');
		this._azureTenantDropdown = new SelectBox([], undefined, this._contextViewService, tenantDropdownBuilder.getContainer(), { ariaLabel: tenantLabel });
		DialogHelper.appendInputSelectBox(tenantDropdownBuilder, this._azureTenantDropdown);

		// Database
		let databaseOption = this._optionsMaps[ConnectionOptionSpecialType.databaseName];
		let databaseNameBuilder = DialogHelper.appendRow(this._tableContainer, databaseOption.displayName, 'connection-label', 'connection-input');

		this._databaseNameInputBox = new Dropdown(databaseNameBuilder.getHTMLElement(), this._contextViewService, this._themeService, {
			values: [this._defaultDatabaseName, this._loadingDatabaseName],
			strictSelection: false,
			placeholder: this._defaultDatabaseName,
			maxHeight: 125,
			ariaLabel: databaseOption.displayName,
			actionLabel: localize('connectionWidget.toggleDatabaseNameDropdown', 'Select Database Toggle Dropdown')
		});

		// Server group
		let serverGroupBuilder = DialogHelper.appendRow(this._tableContainer, this._serverGroupDisplayString, 'connection-label', 'connection-input');
		DialogHelper.appendInputSelectBox(serverGroupBuilder, this._serverGroupSelectBox);

		// Connection name
		let connectionNameOption = this._optionsMaps[ConnectionOptionSpecialType.connectionName];
		let connectionNameBuilder = DialogHelper.appendRow(this._tableContainer, connectionNameOption.displayName, 'connection-label', 'connection-input');
		this._connectionNameInputBox = new InputBox(connectionNameBuilder.getHTMLElement(), this._contextViewService, { ariaLabel: connectionNameOption.displayName });

		let AdvancedLabel = localize('advanced', 'Advanced...');
		this._advancedButton = this.createAdvancedButton(this._tableContainer, AdvancedLabel);
	}

	private validateUsername(value: string, isOptionRequired: boolean): boolean {
		let currentAuthType = this._authTypeSelectBox ? this.getMatchingAuthType(this._authTypeSelectBox.value) : undefined;
		if (!currentAuthType || currentAuthType === AuthenticationType.SqlLogin) {
			if (!value && isOptionRequired) {
				return true;
			}
		}
		return false;
	}

	private createAdvancedButton(container: Builder, title: string): Button {
		let button;
		container.element('tr', {}, (rowContainer) => {
			rowContainer.element('td');
			rowContainer.element('td', { align: 'right' }, (cellContainer) => {
				cellContainer.div({ class: 'advanced-button' }, (divContainer) => {
					button = new Button(divContainer.getHTMLElement());
					button.label = title;
					button.onDidClick(() => {
						//open advanced page
						this._callbacks.onAdvancedProperties();
					});
				});
			});
		});
		return button;
	}

	private appendCheckbox(container: Builder, label: string, checkboxClass: string, cellContainerClass: string, rowContainerClass: string, isChecked: boolean): Checkbox {
		let checkbox: Checkbox;
		container.element('tr', { class: rowContainerClass }, (rowContainer) => {
			rowContainer.element('td');
			rowContainer.element('td', { class: cellContainerClass }, (inputCellContainer) => {
				checkbox = new Checkbox(inputCellContainer.getHTMLElement(), { label, checked: isChecked, ariaLabel: label });
			});
		});
		return checkbox;
	}

	private registerListeners(): void {
		// Theme styler
		this._toDispose.push(styler.attachInputBoxStyler(this._serverNameInputBox, this._themeService));
		this._toDispose.push(styler.attachEditableDropdownStyler(this._databaseNameInputBox, this._themeService));
		this._toDispose.push(styler.attachInputBoxStyler(this._connectionNameInputBox, this._themeService));
		this._toDispose.push(styler.attachInputBoxStyler(this._userNameInputBox, this._themeService));
		this._toDispose.push(styler.attachInputBoxStyler(this._passwordInputBox, this._themeService));
		this._toDispose.push(styler.attachSelectBoxStyler(this._serverGroupSelectBox, this._themeService));
		this._toDispose.push(styler.attachButtonStyler(this._advancedButton, this._themeService));
		this._toDispose.push(styler.attachCheckboxStyler(this._rememberPasswordCheckBox, this._themeService));
		this._toDispose.push(styler.attachSelectBoxStyler(this._azureAccountDropdown, this._themeService));

		if (this._authTypeSelectBox) {
			// Theme styler
			this._toDispose.push(styler.attachSelectBoxStyler(this._authTypeSelectBox, this._themeService));
			this._toDispose.push(this._authTypeSelectBox.onDidSelect(selectedAuthType => {
				this.onAuthTypeSelected(selectedAuthType.selected);
				this.setConnectButton();
			}));
		}

		if (this._azureAccountDropdown) {
			this._toDispose.push(styler.attachSelectBoxStyler(this._azureAccountDropdown, this._themeService));
			this._toDispose.push(this._azureAccountDropdown.onDidSelect(() => {
				this.onAzureAccountSelected();
			}));
		}

		if (this._azureTenantDropdown) {
			this._toDispose.push(styler.attachSelectBoxStyler(this._azureTenantDropdown, this._themeService));
			this._toDispose.push(this._azureTenantDropdown.onDidSelect((selectInfo) => {
				this.onAzureTenantSelected(selectInfo.index);
			}));
		}

		if (this._refreshCredentialsLinkBuilder) {
			this._toDispose.push(this._refreshCredentialsLinkBuilder.on(DOM.EventType.CLICK, async () => {
				let account = this._azureAccountList.find(account => account.key.accountId === this._azureAccountDropdown.value);
				if (account) {
					await this._accountManagementService.refreshAccount(account);
					this.fillInAzureAccountOptions();
				}
			}));
		}

		this._toDispose.push(this._serverGroupSelectBox.onDidSelect(selectedGroup => {
			this.onGroupSelected(selectedGroup.selected);
		}));

		this._toDispose.push(this._serverNameInputBox.onDidChange(serverName => {
			this.serverNameChanged(serverName);
		}));

		this._toDispose.push(this._userNameInputBox.onDidChange(userName => {
			this.setConnectButton();
		}));

		this._toDispose.push(this._passwordInputBox.onDidChange(passwordInput => {
			this._password = passwordInput;
		}));

		this._toDispose.push(this._databaseNameInputBox.onFocus(() => {
			this._databaseDropdownExpanded = true;
			if (this.serverName) {
				this._databaseNameInputBox.values = [this._loadingDatabaseName];
				this._callbacks.onFetchDatabases(this.serverName, this.authenticationType, this.userName, this._password).then(databases => {
					if (databases) {
						this._databaseNameInputBox.values = databases.sort((a, b) => a.localeCompare(b));
					} else {
						this._databaseNameInputBox.values = [this._defaultDatabaseName];
					}
				}).catch(() => {
					this._databaseNameInputBox.values = [this._defaultDatabaseName];
				});
			} else {
				this._databaseNameInputBox.values = [this._defaultDatabaseName];
			}
		}));

		this._toDispose.push(this._databaseNameInputBox.onValueChange(s => {
			if (s === this._defaultDatabaseName || s === this._loadingDatabaseName) {
				this._databaseNameInputBox.value = '';
			} else {
				this._databaseNameInputBox.value = s;
			}
		}));

	}

	private onGroupSelected(selectedGroup: string) {
		if (selectedGroup === this._addNewServerGroup.name) {
			// Select previous non-AddGroup option in case AddServerGroup dialog is cancelled
			this._serverGroupSelectBox.selectWithOptionName(this._previousGroupOption);
			this._callbacks.onCreateNewServerGroup();
		} else {
			this._previousGroupOption = selectedGroup;
		}
	}

	private setConnectButton(): void {
		let showUsernameAndPassword: boolean = true;
		if (this.authType) {
			showUsernameAndPassword = this.authType === AuthenticationType.SqlLogin;
		}
		showUsernameAndPassword ? this._callbacks.onSetConnectButton(!!this.serverName && !!this.userName) :
			this._callbacks.onSetConnectButton(!!this.serverName);
	}

	private onAuthTypeSelected(selectedAuthType: string) {
		let currentAuthType = this.getMatchingAuthType(selectedAuthType);
		if (currentAuthType !== AuthenticationType.SqlLogin) {
			this._userNameInputBox.disable();
			this._passwordInputBox.disable();
			this._userNameInputBox.hideMessage();
			this._passwordInputBox.hideMessage();
			this._userNameInputBox.value = '';
			this._passwordInputBox.value = '';
			this._password = '';

			this._rememberPasswordCheckBox.checked = false;
			this._rememberPasswordCheckBox.enabled = false;
		} else {
			this._userNameInputBox.enable();
			this._passwordInputBox.enable();
			this._rememberPasswordCheckBox.enabled = true;
		}

		if (currentAuthType === AuthenticationType.AzureMFA) {
			this.fillInAzureAccountOptions();
			this._azureAccountDropdown.enable();
			let tableContainer = this._tableContainer.getContainer();
			tableContainer.classList.add('hide-username-password');
			tableContainer.classList.remove('hide-azure-accounts');
		} else {
			this._azureAccountDropdown.disable();
			let tableContainer = this._tableContainer.getContainer();
			tableContainer.classList.remove('hide-username-password');
			tableContainer.classList.add('hide-azure-accounts');
			this._azureAccountDropdown.hideMessage();
		}
	}

	private async fillInAzureAccountOptions(): Promise<void> {
		let oldSelection = this._azureAccountDropdown.value;
		this._azureAccountList = await this._accountManagementService.getAccountsForProvider(this._azureProviderId);
		let accountDropdownOptions = this._azureAccountList.map(account => account.key.accountId);
		if (accountDropdownOptions.length === 0) {
			// If there are no accounts add a blank option so that add account isn't automatically selected
			accountDropdownOptions.unshift('');
		}
		accountDropdownOptions.push(this._addAzureAccountMessage);
		this._azureAccountDropdown.setOptions(accountDropdownOptions);
		this._azureAccountDropdown.selectWithOptionName(oldSelection);
		await this.onAzureAccountSelected();
	}

	private async updateRefreshCredentialsLink(): Promise<void> {
		let chosenAccount = this._azureAccountList.find(account => account.key.accountId === this._azureAccountDropdown.value);
		if (chosenAccount && chosenAccount.isStale) {
			this._tableContainer.getContainer().classList.remove('hide-refresh-link');
		} else {
			this._tableContainer.getContainer().classList.add('hide-refresh-link');
		}
	}

	private async onAzureAccountSelected(): Promise<void> {
		// Reset the dropdown's validation message if the old selection was not valid but the new one is
		this.validateAzureAccountSelection(false);

		// Open the add account dialog if needed, then select the added account
		if (this._azureAccountDropdown.value === this._addAzureAccountMessage) {
			let oldAccountIds = this._azureAccountList.map(account => account.key.accountId);
			await this._accountManagementService.addAccount(this._azureProviderId);

			// Refresh the dropdown's list to include the added account
			await this.fillInAzureAccountOptions();

			// If a new account was added find it and select it, otherwise select the first account
			let newAccount = this._azureAccountList.find(option => !oldAccountIds.some(oldId => oldId === option.key.accountId));
			if (newAccount) {
				this._azureAccountDropdown.selectWithOptionName(newAccount.key.accountId);
			} else {
				this._azureAccountDropdown.select(0);
			}
		}

		this.updateRefreshCredentialsLink();

		// Display the tenant select box if needed
		const hideTenantsClassName = 'hide-azure-tenants';
		let selectedAccount = this._azureAccountList.find(account => account.key.accountId === this._azureAccountDropdown.value);
		if (selectedAccount && selectedAccount.properties.tenants && selectedAccount.properties.tenants.length > 1) {
			// There are multiple tenants available so let the user select one
			let options = selectedAccount.properties.tenants.map(tenant => tenant.displayName);
			this._azureTenantDropdown.setOptions(options);
			this._tableContainer.getContainer().classList.remove(hideTenantsClassName);
			this.onAzureTenantSelected(0);
		} else {
			if (selectedAccount && selectedAccount.properties.tenants && selectedAccount.properties.tenants.length === 1) {
				this._azureTenantId = selectedAccount.properties.tenants[0].id;
			} else {
				this._azureTenantId = undefined;
			}
			this._tableContainer.getContainer().classList.add(hideTenantsClassName);
		}
	}

	private onAzureTenantSelected(tenantIndex: number): void {
		this._azureTenantId = undefined;
		let account = this._azureAccountList.find(account => account.key.accountId === this._azureAccountDropdown.value);
		if (account && account.properties.tenants) {
			let tenant = account.properties.tenants[tenantIndex];
			if (tenant) {
				this._azureTenantId = tenant.id;
			}
		}
	}

	private serverNameChanged(serverName: string) {
		this.setConnectButton();
		if (serverName.toLocaleLowerCase().includes('database.windows.net')) {
			this._callbacks.onSetAzureTimeOut();
		}
	}

	public focusOnAdvancedButton() {
		this._advancedButton.focus();
	}

	public focusOnServerGroup() {
		this._serverGroupSelectBox.focus();
	}

	public updateServerGroup(connectionGroups: IConnectionProfileGroup[], groupName?: string) {
		this._serverGroupOptions = connectionGroups;
		this._serverGroupOptions.push(this._addNewServerGroup);
		this._serverGroupSelectBox.setOptions(this._serverGroupOptions.map(g => g.name));
		if (groupName) {
			this._serverGroupSelectBox.selectWithOptionName(groupName);
			this._previousGroupOption = this._serverGroupSelectBox.value;
		}
	}

	public initDialog(connectionInfo: IConnectionProfile): void {
		this.fillInConnectionInputs(connectionInfo);
	}

	public focusOnOpen(): void {
		this._handleClipboard();
		this._serverNameInputBox.focus();
		this.focusPasswordIfNeeded();
		this.clearValidationMessages();
	}

	private clearValidationMessages(): void {
		this._serverNameInputBox.hideMessage();
		this._userNameInputBox.hideMessage();
		this._azureAccountDropdown.hideMessage();
	}

	private getModelValue(value: string): string {
		return value ? value : '';
	}

	public fillInConnectionInputs(connectionInfo: IConnectionProfile) {
		if (connectionInfo) {
			this._serverNameInputBox.value = this.getModelValue(connectionInfo.serverName);
			this._databaseNameInputBox.value = this.getModelValue(connectionInfo.databaseName);
			this._connectionNameInputBox.value = this.getModelValue(connectionInfo.connectionName);
			this._userNameInputBox.value = this.getModelValue(connectionInfo.userName);
			this._passwordInputBox.value = connectionInfo.password ? Constants.passwordChars : '';
			this._password = this.getModelValue(connectionInfo.password);
			this._saveProfile = connectionInfo.saveProfile;
			this._azureTenantId = connectionInfo.azureTenantId;
			let groupName: string;
			if (this._saveProfile) {
				if (!connectionInfo.groupFullName) {
					groupName = this.DefaultServerGroup.name;
				} else {
					groupName = connectionInfo.groupFullName.replace('root/', '');
				}
			} else {
				groupName = this.NoneServerGroup.name;
			}
			this._serverGroupSelectBox.selectWithOptionName(groupName);
			this._previousGroupOption = this._serverGroupSelectBox.value;

			// To handle the empty password case
			if (this.getModelValue(connectionInfo.password) === '') {
				this._rememberPasswordCheckBox.checked = false;
			} else {
				this._rememberPasswordCheckBox.checked = connectionInfo.savePassword;
			}

			if (connectionInfo.authenticationType !== null && connectionInfo.authenticationType !== undefined) {
				var authTypeDisplayName = this.getAuthTypeDisplayName(connectionInfo.authenticationType);
				this._authTypeSelectBox.selectWithOptionName(authTypeDisplayName);
			}

			if (this._authTypeSelectBox) {
				this.onAuthTypeSelected(this._authTypeSelectBox.value);
			} else {
				let tableContainerElement = this._tableContainer.getContainer();
				tableContainerElement.classList.remove('hide-username-password');
				tableContainerElement.classList.add('hide-azure-accounts');
			}

			if (this.authType === AuthenticationType.AzureMFA) {
				this.fillInAzureAccountOptions().then(async () => {
					this._azureAccountDropdown.selectWithOptionName(this.getModelValue(connectionInfo.userName));
					await this.onAzureAccountSelected();
					let tenantId = connectionInfo.azureTenantId;
					let account = this._azureAccountList.find(account => account.key.accountId === this._azureAccountDropdown.value);
					if (account && account.properties.tenants.length > 1) {
						let tenant = account.properties.tenants.find(tenant => tenant.id === tenantId);
						if (tenant) {
							this._azureTenantDropdown.selectWithOptionName(tenant.displayName);
						}
						this.onAzureTenantSelected(this._azureTenantDropdown.values.indexOf(this._azureTenantDropdown.value));
					}
				});
			}

			// Disable connect button if -
			// 1. Authentication type is SQL Login and no username is provided
			// 2. No server name is provided
			this.setConnectButton();
			this.focusPasswordIfNeeded();
		}
	}

	private getAuthTypeDisplayName(authTypeName: string) {
		var displayName: string;
		var authTypeOption = this._optionsMaps[ConnectionOptionSpecialType.authType];

		if (authTypeOption) {
			authTypeOption.categoryValues.forEach(c => {
				if (c.name === authTypeName) {
					displayName = c.displayName;
				}
			});
		}
		return displayName;
	}

	private getAuthTypeName(authTypeDisplayName: string) {
		var authTypeName: string;
		var authTypeOption = this._optionsMaps[ConnectionOptionSpecialType.authType];
		authTypeOption.categoryValues.forEach(c => {
			if (c.displayName === authTypeDisplayName) {
				authTypeName = c.name;
			}
		});
		return authTypeName;
	}

	public handleOnConnecting(): void {
		this._focusedBeforeHandleOnConnection = <HTMLElement>document.activeElement;
		this._advancedButton.enabled = false;

		this._serverGroupSelectBox.disable();
		this._serverNameInputBox.disable();
		this._databaseNameInputBox.enabled = false;
		this._userNameInputBox.disable();
		this._passwordInputBox.disable();
		this._connectionNameInputBox.disable();
		this._rememberPasswordCheckBox.enabled = false;
		if (this._authTypeSelectBox) {
			this._authTypeSelectBox.disable();
		}
	}

	public handleResetConnection(): void {
		this._advancedButton.enabled = true;

		this._serverGroupSelectBox.enable();
		this._serverNameInputBox.enable();
		this._connectionNameInputBox.enable();
		this._databaseNameInputBox.enabled = true;
		let currentAuthType: AuthenticationType = undefined;
		if (this._authTypeSelectBox) {
			this._authTypeSelectBox.enable();
			currentAuthType = this.getMatchingAuthType(this._authTypeSelectBox.value);
		}

		if (!currentAuthType || currentAuthType === AuthenticationType.SqlLogin) {
			this._userNameInputBox.enable();
			this._passwordInputBox.enable();
			this._rememberPasswordCheckBox.enabled = true;
		}

		if (this._focusedBeforeHandleOnConnection) {
			this._focusedBeforeHandleOnConnection.focus();
		}
	}

	public get connectionName(): string {
		return this._connectionNameInputBox.value;
	}

	public get serverName(): string {
		return this._serverNameInputBox.value;
	}

	public get databaseName(): string {
		return this._databaseNameInputBox.value;
	}

	public get userName(): string {
		return this.authenticationType === AuthenticationType.AzureMFA ? this._azureAccountDropdown.value : this._userNameInputBox.value;
	}

	public get password(): string {
		return this._password;
	}

	public get authenticationType(): string {
		return this._authTypeSelectBox ? this.getAuthTypeName(this._authTypeSelectBox.value) : undefined;
	}

	private validateAzureAccountSelection(showMessage: boolean = true): boolean {
		if (this.authType !== AuthenticationType.AzureMFA) {
			return true;
		}

		let selected = this._azureAccountDropdown.value;
		if (selected === '' || selected === this._addAzureAccountMessage) {
			if (showMessage) {
				this._azureAccountDropdown.showMessage({
					content: localize('connectionWidget.invalidAzureAccount', 'You must select an account'),
					type: MessageType.ERROR
				});
			}
			return false;
		} else {
			this._azureAccountDropdown.hideMessage();
		}

		return true;
	}

	private validateInputs(): boolean {
		let isFocused = false;
		let validateServerName = this._serverNameInputBox.validate();
		if (!validateServerName) {
			this._serverNameInputBox.focus();
			isFocused = true;
		}
		let validateUserName = this._userNameInputBox.validate();
		if (!validateUserName && !isFocused) {
			this._userNameInputBox.focus();
			isFocused = true;
		}
		let validatePassword = this._passwordInputBox.validate();
		if (!validatePassword && !isFocused) {
			this._passwordInputBox.focus();
			isFocused = true;
		}
		let validateAzureAccount = this.validateAzureAccountSelection();
		if (!validateAzureAccount && !isFocused) {
			this._azureAccountDropdown.focus();
			isFocused = true;
		}
		return validateServerName && validateUserName && validatePassword && validateAzureAccount;
	}

	public connect(model: IConnectionProfile): boolean {
		let validInputs = this.validateInputs();
		if (validInputs) {
			model.connectionName = this.connectionName;
			model.serverName = this.serverName;
			model.databaseName = this.databaseName;
			model.userName = this.userName;
			model.password = this.password;
			model.authenticationType = this.authenticationType;
			model.savePassword = this._rememberPasswordCheckBox.checked;
			if (this._serverGroupSelectBox.value === this.DefaultServerGroup.name) {
				model.groupFullName = '';
				model.saveProfile = true;
				model.groupId = this.findGroupId(model.groupFullName);
			} else if (this._serverGroupSelectBox.value === this.NoneServerGroup.name) {
				model.groupFullName = '';
				model.saveProfile = false;
			} else if (this._serverGroupSelectBox.value !== this._addNewServerGroup.name) {
				model.groupFullName = this._serverGroupSelectBox.value;
				model.saveProfile = true;
				model.groupId = this.findGroupId(model.groupFullName);
			}
			if (this.authType === AuthenticationType.AzureMFA) {
				model.azureTenantId = this._azureTenantId;
			}
		}
		return validInputs;
	}

	private findGroupId(groupFullName: string): string {
		let group: IConnectionProfileGroup;
		if (ConnectionProfileGroup.isRoot(groupFullName)) {
			group = this._serverGroupOptions.find(g => ConnectionProfileGroup.isRoot(g.name));
			if (group === undefined) {
				group = this._serverGroupOptions.find(g => g.name === this.DefaultServerGroup.name);
			}
		} else {
			group = this._serverGroupOptions.find(g => g.name === groupFullName);
		}
		return group ? group.id : undefined;
	}

	public dispose(): void {
		this._toDispose = lifecycle.dispose(this._toDispose);
	}

	private getMatchingAuthType(displayName: string): AuthenticationType {
		const authType = this._authTypeMap[this._providerName];
		return authType ? authType.find(authType => this.getAuthTypeDisplayName(authType) === displayName) : undefined;
	}

	public closeDatabaseDropdown(): void {
		this._databaseNameInputBox.blur();
	}

	public get databaseDropdownExpanded(): boolean {
		return this._databaseDropdownExpanded;
	}

	public set databaseDropdownExpanded(val: boolean) {
		this._databaseDropdownExpanded = val;
	}

	private get authType(): AuthenticationType {
		let authDisplayName: string = this.getAuthTypeDisplayName(this.authenticationType);
		return this.getMatchingAuthType(authDisplayName);
	}

	private focusPasswordIfNeeded(): void {
		if (this.authType && this.authType === AuthenticationType.SqlLogin && this.userName && !this.password) {
			this._passwordInputBox.focus();
		}
	}
}

enum AuthenticationType {
	SqlLogin = 'SqlLogin',
	Integrated = 'Integrated',
	AzureMFA = 'AzureMFA'
}