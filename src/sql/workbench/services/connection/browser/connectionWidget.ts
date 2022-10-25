/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/sqlConnection';

import { Button } from 'sql/base/browser/ui/button/button';
import { SelectBox, SelectOptionItemSQL } from 'sql/base/browser/ui/selectBox/selectBox';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import * as DialogHelper from 'sql/workbench/browser/modal/dialogHelper';
import { IConnectionComponentCallbacks } from 'sql/workbench/services/connection/browser/connectionDialogService';
import { IConnectionProfile, ServiceOptionType } from 'sql/platform/connection/common/interfaces';
import { ConnectionOptionSpecialType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ConnectionProfileGroup, IConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import * as styler from 'sql/platform/theme/common/styler';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';

import * as azdata from 'azdata';

import * as lifecycle from 'vs/base/common/lifecycle';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { OS, OperatingSystem } from 'vs/base/common/platform';
import { IMessage, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { ILogService } from 'vs/platform/log/common/log';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { Dropdown } from 'sql/base/browser/ui/editableDropdown/browser/dropdown';
import { RadioButton } from 'sql/base/browser/ui/radioButton/radioButton';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import Severity from 'vs/base/common/severity';
import { ConnectionStringOptions } from 'sql/platform/capabilities/common/capabilitiesService';
import { isFalsyOrWhitespace } from 'vs/base/common/strings';
import { AuthenticationType } from 'sql/platform/connection/common/constants';

const ConnectionStringText = localize('connectionWidget.connectionString', "Connection string");

export class ConnectionWidget extends lifecycle.Disposable {
	private _defaultInputOptionRadioButton: RadioButton;
	private _connectionStringRadioButton: RadioButton;
	private _previousGroupOption: string;
	private _serverGroupOptions: IConnectionProfileGroup[];
	private _connectionStringInputBox: InputBox;
	private _serverNameInputBox: InputBox;
	private _userNameInputBox: InputBox;
	private _passwordInputBox: InputBox;
	private _rememberPasswordCheckBox: Checkbox;
	private _azureAccountDropdown: SelectBox;
	private _azureTenantDropdown: SelectBox;
	private _refreshCredentialsLink: HTMLLinkElement;
	private _addAzureAccountMessage: string = localize('connectionWidget.AddAzureAccount', "Add an account...");
	private readonly _azureProviderId = 'azure_publicCloud';
	private _azureTenantId: string;
	private _azureAccountList: azdata.Account[];
	private _callbacks: IConnectionComponentCallbacks;
	private _focusedBeforeHandleOnConnection: HTMLElement;
	private _saveProfile: boolean;
	private _databaseDropdownExpanded: boolean = false;
	private _defaultDatabaseName: string = localize('defaultDatabaseOption', "<Default>");
	private _loadingDatabaseName: string = localize('loadingDatabaseOption', "Loading...");
	private _serverGroupDisplayString: string = localize('serverGroup', "Server group");
	private _token: string;
	private _connectionStringOptions: ConnectionStringOptions;
	protected _container: HTMLElement;
	protected _serverGroupSelectBox: SelectBox;
	protected _authTypeSelectBox: SelectBox;
	protected _customOptions: azdata.ConnectionOption[];
	protected _optionsMaps: { [optionType: number]: azdata.ConnectionOption };
	protected _tableContainer: HTMLElement;
	protected _providerName: string;
	protected _connectionNameInputBox: InputBox;
	protected _databaseNameInputBox: Dropdown;
	protected _customOptionWidgets: (InputBox | SelectBox)[];
	protected _advancedButton: Button;
	private static readonly _authTypes: AuthenticationType[] =
		[AuthenticationType.AzureMFA, AuthenticationType.AzureMFAAndUser, AuthenticationType.Integrated, AuthenticationType.SqlLogin, AuthenticationType.DSTSAuth, AuthenticationType.None];
	private static readonly _osByName = {
		Windows: OperatingSystem.Windows,
		Macintosh: OperatingSystem.Macintosh,
		Linux: OperatingSystem.Linux
	};
	public DefaultServerGroup: IConnectionProfileGroup = {
		id: '',
		name: localize('defaultServerGroup', "<Default>"),
		parentId: undefined,
		color: undefined,
		description: undefined,
	};

	private _addNewServerGroup = {
		id: '',
		name: localize('addNewServerGroup', "Add new group..."),
		parentId: undefined,
		color: undefined,
		description: undefined,
	};
	public NoneServerGroup: IConnectionProfileGroup = {
		id: '',
		name: localize('noneServerGroup', "<Do not save>"),
		parentId: undefined,
		color: undefined,
		description: undefined,
	};
	constructor(options: azdata.ConnectionOption[],
		callbacks: IConnectionComponentCallbacks,
		providerName: string,
		@IThemeService protected _themeService: IThemeService,
		@IContextViewService protected _contextViewService: IContextViewService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IAccountManagementService private _accountManagementService: IAccountManagementService,
		@ILogService protected _logService: ILogService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService
	) {
		super();
		this._callbacks = callbacks;
		this._customOptions = options.filter(a => a.showOnConnectionDialog === true);
		this._optionsMaps = {};
		for (let i = 0; i < options.length; i++) {
			let option = options[i];
			this._optionsMaps[option.specialValueType] = option;
		}

		let authTypeOption = this._optionsMaps[ConnectionOptionSpecialType.authType];
		if (authTypeOption) {
			let authTypeDefault = this.getAuthTypeDefault(authTypeOption, OS);
			let authTypeDefaultDisplay = this.getAuthTypeDisplayName(authTypeDefault);
			this._authTypeSelectBox = new SelectBox(authTypeOption.categoryValues.map(c => c.displayName), authTypeDefaultDisplay, this._contextViewService, undefined, { ariaLabel: authTypeOption.displayName });
			this._register(this._authTypeSelectBox);
		}
		this._providerName = providerName;
		this._connectionStringOptions = this._connectionManagementService.getProviderProperties(this._providerName).connectionStringOptions;
	}

	protected getAuthTypeDefault(option: azdata.ConnectionOption, os: OperatingSystem): string {
		// Check for OS-specific default value
		if (option.defaultValueOsOverrides) {
			let result = option.defaultValueOsOverrides.find(d => ConnectionWidget._osByName[d.os] === os);
			if (result) {
				return result.defaultValueOverride;
			}
		}

		// No OS-specific default, and so return global default, if any.
		if (option.defaultValue) {
			return option.defaultValue;
		}

		// No default value specified at all. Return first category value.
		if (option.categoryValues.length > 0) {
			return option.categoryValues[0].name;
		}

		// Give up.
		return undefined;
	}

	public createConnectionWidget(container: HTMLElement, authTypeChanged: boolean = false): void {
		this._serverGroupOptions = [this.DefaultServerGroup];
		this._serverGroupSelectBox = new SelectBox(this._serverGroupOptions.map(g => g.name), this.DefaultServerGroup.name, this._contextViewService, undefined, { ariaLabel: this._serverGroupDisplayString });
		this._register(this._serverGroupSelectBox);
		this._previousGroupOption = this._serverGroupSelectBox.value;
		this._container = DOM.append(container, DOM.$('div.connection-table'));
		this._tableContainer = DOM.append(this._container, DOM.$('table.connection-table-content'));
		this._tableContainer.setAttribute('role', 'presentation');
		this.fillInConnectionForm(authTypeChanged);
		this.registerListeners();
		if (this._authTypeSelectBox) {
			this.onAuthTypeSelected(this._authTypeSelectBox.value);
		}
	}

	protected fillInConnectionForm(authTypeChanged: boolean = false): void {
		this.addInputOptionRadioButtons();
		this.addConnectionStringInput();
		this.addServerNameOption();
		this.addAuthenticationTypeOption(authTypeChanged);
		this.addLoginOptions();
		this.addDatabaseOption();
		this.addCustomConnectionOptions();
		this.addServerGroupOption();
		this.addConnectionNameOptions();
		this.addAdvancedOptions();
		this.updateRequiredStateForOptions();
		if (this._connectionStringOptions.isEnabled) {
			// update the UI based on connection string setting after initialization
			this.handleConnectionStringOptionChange();
		}
	}

	private validateRequiredOptionValue(value: string, optionName: string): IMessage | undefined {
		return isFalsyOrWhitespace(value) ? ({ type: MessageType.ERROR, content: localize('connectionWidget.missingRequireField', "{0} is required.", optionName) }) : undefined;
	}

	private addInputOptionRadioButtons(): void {
		if (this._connectionStringOptions.isEnabled) {
			const groupName = 'input-option-type';
			const inputOptionsContainer = DialogHelper.appendRow(this._tableContainer, '', 'connection-label', 'connection-input', 'connection-input-options');
			this._defaultInputOptionRadioButton = new RadioButton(inputOptionsContainer, { label: 'Parameters', checked: !this._connectionStringOptions.isDefault });
			this._connectionStringRadioButton = new RadioButton(inputOptionsContainer, { label: 'Connection String', checked: this._connectionStringOptions.isDefault });
			this._defaultInputOptionRadioButton.name = groupName;
			this._connectionStringRadioButton.name = groupName;
			this._register(this._defaultInputOptionRadioButton);
			this._register(this._connectionStringRadioButton);
			this._register(this._defaultInputOptionRadioButton.onDidChangeCheckedState(() => {
				this.handleConnectionStringOptionChange();
			}));
		}
	}

	private addConnectionStringInput(): void {
		if (this._connectionStringOptions.isEnabled) {
			const connectionStringContainer = DialogHelper.appendRow(this._tableContainer, ConnectionStringText, 'connection-label', 'connection-input', 'connection-string-row', true);
			this._connectionStringInputBox = new InputBox(connectionStringContainer, this._contextViewService, {
				validationOptions: {
					validation: (value: string) => {
						return this.validateRequiredOptionValue(value, ConnectionStringText);
					}
				},
				ariaLabel: ConnectionStringText,
				flexibleHeight: true,
				flexibleMaxHeight: 100
			});
			this._register(this._connectionStringInputBox);
			this._register(this._connectionStringInputBox.onDidChange(() => {
				this.setConnectButton();
			}));
		}
	}

	private updateRequiredStateForOptions(): void {
		if (this._connectionStringInputBox) {
			this._connectionStringInputBox.required = this.useConnectionString;
		}
		const userNameOption: azdata.ConnectionOption = this._optionsMaps[ConnectionOptionSpecialType.userName];
		this._serverNameInputBox.required = !this.useConnectionString;
		this._userNameInputBox.required = (!this.useConnectionString) && userNameOption?.isRequired;
		this._userNameInputBox.value = '';
		if (this.useConnectionString) {
			this._tableContainer.classList.add('hide-customOptions');
		} else {
			this._tableContainer.classList.remove('hide-customOptions');
		}
	}

	protected addAuthenticationTypeOption(authTypeChanged: boolean = false): void {
		if (this._optionsMaps[ConnectionOptionSpecialType.authType]) {
			let authType = DialogHelper.appendRow(this._tableContainer, this._optionsMaps[ConnectionOptionSpecialType.authType].displayName, 'connection-label', 'connection-input', 'auth-type-row');
			DialogHelper.appendInputSelectBox(authType, this._authTypeSelectBox);
		}
	}

	protected addCustomConnectionOptions(): void {
		if (this._customOptions.length > 0) {
			this._customOptionWidgets = [];
			this._customOptions.forEach((option, i) => {
				let customOptionsContainer = DialogHelper.appendRow(this._tableContainer, option.displayName, 'connection-label', 'connection-input', 'custom-connection-options');
				switch (option.valueType) {
					case ServiceOptionType.boolean:
						this._customOptionWidgets[i] = new SelectBox([localize('boolean.true', 'True'), localize('boolean.false', 'False')], option.defaultValue, this._contextViewService, customOptionsContainer, { ariaLabel: option.displayName });
						DialogHelper.appendInputSelectBox(customOptionsContainer, this._customOptionWidgets[i] as SelectBox);
						this._register(styler.attachSelectBoxStyler(this._customOptionWidgets[i] as SelectBox, this._themeService));
						break;
					case ServiceOptionType.category:
						this._customOptionWidgets[i] = new SelectBox(option.categoryValues.map(c => c.displayName), option.defaultValue, this._contextViewService, customOptionsContainer, { ariaLabel: option.displayName });
						DialogHelper.appendInputSelectBox(customOptionsContainer, this._customOptionWidgets[i] as SelectBox);
						this._register(styler.attachSelectBoxStyler(this._customOptionWidgets[i] as SelectBox, this._themeService));
						break;
					default:
						this._customOptionWidgets[i] = new InputBox(customOptionsContainer, this._contextViewService, { ariaLabel: option.displayName });
						this._register(styler.attachInputBoxStyler(this._customOptionWidgets[i] as InputBox, this._themeService));
						break;
				}
				this._register(this._customOptionWidgets[i]);
			});
		}
	}

	protected addServerNameOption(): void {
		// Server name
		let serverNameOption = this._optionsMaps[ConnectionOptionSpecialType.serverName];
		let serverName = DialogHelper.appendRow(this._tableContainer, serverNameOption.displayName, 'connection-label', 'connection-input', 'server-name-row', true);
		this._serverNameInputBox = new InputBox(serverName, this._contextViewService, {
			validationOptions: {
				validation: (value: string) => {
					return this.validateRequiredOptionValue(value, serverNameOption.displayName);
				}
			},
			ariaLabel: serverNameOption.displayName
		});
		this._register(this._serverNameInputBox);
	}

	protected addLoginOptions(): void {
		// Username
		let self = this;
		let userNameOption = this._optionsMaps[ConnectionOptionSpecialType.userName];
		let userName = DialogHelper.appendRow(this._tableContainer, userNameOption.displayName, 'connection-label', 'connection-input', 'username-row', userNameOption.isRequired);
		this._userNameInputBox = new InputBox(userName, this._contextViewService, {
			validationOptions: {
				validation: (value: string) => self.validateUsername(value, userNameOption.isRequired) ? ({ type: MessageType.ERROR, content: localize('connectionWidget.missingRequireField', "{0} is required.", userNameOption.displayName) }) : null
			},
			ariaLabel: userNameOption.displayName
		});
		this._register(this._userNameInputBox);
		// Password
		let passwordOption = this._optionsMaps[ConnectionOptionSpecialType.password];
		let password = DialogHelper.appendRow(this._tableContainer, passwordOption.displayName, 'connection-label', 'connection-input', 'password-row');
		this._passwordInputBox = new InputBox(password, this._contextViewService, { ariaLabel: passwordOption.displayName });
		this._passwordInputBox.inputElement.type = 'password';
		this._register(this._passwordInputBox);

		// Remember password
		let rememberPasswordLabel = localize('rememberPassword', "Remember password");
		this._rememberPasswordCheckBox = this.appendCheckbox(this._tableContainer, rememberPasswordLabel, 'connection-input', 'password-row', false);
		this._register(this._rememberPasswordCheckBox);

		// Azure account picker
		let accountLabel = localize('connection.azureAccountDropdownLabel', "Account");
		let accountDropdown = DialogHelper.appendRow(this._tableContainer, accountLabel, 'connection-label', 'connection-input', 'azure-account-row');
		this._azureAccountDropdown = new SelectBox([], undefined, this._contextViewService, accountDropdown, { ariaLabel: accountLabel });
		this._register(this._azureAccountDropdown);
		DialogHelper.appendInputSelectBox(accountDropdown, this._azureAccountDropdown);
		let refreshCredentials = DialogHelper.appendRow(this._tableContainer, '', 'connection-label', 'connection-input', ['azure-account-row', 'refresh-credentials-link']);
		this._refreshCredentialsLink = DOM.append(refreshCredentials, DOM.$('a'));
		this._refreshCredentialsLink.href = '#';
		this._refreshCredentialsLink.innerText = localize('connectionWidget.refreshAzureCredentials', "Refresh account credentials");
		// Azure tenant picker
		let tenantLabel = localize('connection.azureTenantDropdownLabel', "Azure AD tenant");
		let tenantDropdown = DialogHelper.appendRow(this._tableContainer, tenantLabel, 'connection-label', 'connection-input', ['azure-account-row', 'azure-tenant-row']);
		this._azureTenantDropdown = new SelectBox([], undefined, this._contextViewService, tenantDropdown, { ariaLabel: tenantLabel });
		this._register(this._azureTenantDropdown);
		DialogHelper.appendInputSelectBox(tenantDropdown, this._azureTenantDropdown);
	}

	private addDatabaseOption(): void {
		// Database
		let databaseOption = this._optionsMaps[ConnectionOptionSpecialType.databaseName];
		if (databaseOption) {
			let databaseName = DialogHelper.appendRow(this._tableContainer, databaseOption.displayName, 'connection-label', 'connection-input', 'database-row');
			this._databaseNameInputBox = new Dropdown(databaseName, this._contextViewService, {
				values: [this._defaultDatabaseName, this._loadingDatabaseName],
				strictSelection: false,
				placeholder: this._defaultDatabaseName,
				maxHeight: 125,
				ariaLabel: databaseOption.displayName
			});
			this._register(this._databaseNameInputBox);
		}
	}

	private addServerGroupOption(): void {
		// Server group
		if (this._serverGroupSelectBox) {
			let serverGroup = DialogHelper.appendRow(this._tableContainer, this._serverGroupDisplayString, 'connection-label', 'connection-input');
			DialogHelper.appendInputSelectBox(serverGroup, this._serverGroupSelectBox);
		}
	}

	protected addConnectionNameOptions(): void {
		// Connection name
		let connectionNameOption = this._optionsMaps[ConnectionOptionSpecialType.connectionName];
		connectionNameOption.displayName = localize('connectionName', "Name (optional)");
		let connectionNameBuilder = DialogHelper.appendRow(this._tableContainer, connectionNameOption.displayName, 'connection-label', 'connection-input');
		this._connectionNameInputBox = new InputBox(connectionNameBuilder, this._contextViewService, { ariaLabel: connectionNameOption.displayName });
		this._register(this._connectionNameInputBox);
	}

	protected addAdvancedOptions(): void {
		const rowContainer = DOM.append(this._tableContainer, DOM.$('tr.advanced-options-row'));
		DOM.append(rowContainer, DOM.$('td'));
		const buttonContainer = DOM.append(rowContainer, DOM.$('td'));
		buttonContainer.setAttribute('align', 'right');
		const divContainer = DOM.append(buttonContainer, DOM.$('div.advanced-button'));
		this._advancedButton = new Button(divContainer, { secondary: true });
		this._register(this._advancedButton);
		this._advancedButton.label = localize('advanced', "Advanced...");
		this._register(this._advancedButton.onDidClick(() => {
			//open advanced page
			this._callbacks.onAdvancedProperties();
		}));
	}

	private handleConnectionStringOptionChange(): void {
		const connectionStringClass = 'use-connection-string';
		if (this.useConnectionString) {
			this._tableContainer.classList.add(connectionStringClass);
			this._connectionStringInputBox.layout();
		} else {
			this._tableContainer.classList.remove(connectionStringClass);
		}
		this.updateRequiredStateForOptions();
		this.setConnectButton();
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

	private appendCheckbox(container: HTMLElement, label: string, cellContainerClass: string, rowContainerClass: string, isChecked: boolean): Checkbox {
		let rowContainer = DOM.append(container, DOM.$(`tr.${rowContainerClass}`));
		DOM.append(rowContainer, DOM.$('td'));
		let checkboxContainer = DOM.append(rowContainer, DOM.$(`td.${cellContainerClass}`));
		return new Checkbox(checkboxContainer, { label, checked: isChecked, ariaLabel: label });
	}

	protected registerListeners(): void {
		// Theme styler
		this._register(styler.attachInputBoxStyler(this._serverNameInputBox, this._themeService));
		this._register(styler.attachInputBoxStyler(this._connectionNameInputBox, this._themeService));
		this._register(styler.attachInputBoxStyler(this._userNameInputBox, this._themeService));
		this._register(styler.attachInputBoxStyler(this._passwordInputBox, this._themeService));
		this._register(attachButtonStyler(this._advancedButton, this._themeService));
		this._register(styler.attachCheckboxStyler(this._rememberPasswordCheckBox, this._themeService));
		this._register(styler.attachSelectBoxStyler(this._azureAccountDropdown, this._themeService));
		if (this._serverGroupSelectBox) {
			this._register(styler.attachSelectBoxStyler(this._serverGroupSelectBox, this._themeService));
			this._register(this._serverGroupSelectBox.onDidSelect(selectedGroup => {
				this.onGroupSelected(selectedGroup.selected);
			}));
		}
		if (this._databaseNameInputBox) {
			this._register(styler.attachEditableDropdownStyler(this._databaseNameInputBox, this._themeService));
			this._register(this._databaseNameInputBox.onFocus(() => {
				this._databaseDropdownExpanded = true;
				if (this.serverName) {
					this._databaseNameInputBox.values = [this._loadingDatabaseName];
					this._callbacks.onFetchDatabases(this.serverName, this.authenticationType, this.userName, this.password, this.authToken).then(databases => {
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

			this._register(this._databaseNameInputBox.onValueChange(s => {
				if (s === this._defaultDatabaseName || s === this._loadingDatabaseName) {
					this._databaseNameInputBox.value = '';
				} else {
					this._databaseNameInputBox.value = s;
				}
			}));
		}

		if (this._connectionStringInputBox) {
			this._register(styler.attachInputBoxStyler(this._connectionStringInputBox, this._themeService));
		}

		if (this._authTypeSelectBox) {
			// Theme styler
			this._register(styler.attachSelectBoxStyler(this._authTypeSelectBox, this._themeService));
			this._register(this._authTypeSelectBox.onDidSelect(selectedAuthType => {
				this.onAuthTypeSelected(selectedAuthType.selected);
				this.setConnectButton();
			}));
		}

		if (this._azureAccountDropdown) {
			this._register(styler.attachSelectBoxStyler(this._azureAccountDropdown, this._themeService));
			this._register(this._azureAccountDropdown.onDidSelect(() => {
				this.onAzureAccountSelected().catch(err => this._logService.error(`Unexpeted error handling Azure Account dropdown click : ${err}`));
			}));
		}

		if (this._azureTenantDropdown) {
			this._register(styler.attachSelectBoxStyler(this._azureTenantDropdown, this._themeService));
			this._register(this._azureTenantDropdown.onDidSelect((selectInfo) => {
				this.onAzureTenantSelected(selectInfo.index);
			}));
		}

		if (this._refreshCredentialsLink) {
			this._register(DOM.addDisposableListener(this._refreshCredentialsLink, DOM.EventType.CLICK, async () => {
				let account = this._azureAccountList.find(account => account.key.accountId === this._azureAccountDropdown.value);
				if (account) {
					await this._accountManagementService.refreshAccount(account);
					await this.fillInAzureAccountOptions();
					this.updateRefreshCredentialsLink();
				}
			}));
		}

		this._register(this._serverNameInputBox.onDidChange(serverName => {
			this.serverNameChanged(serverName);
		}));

		this._register(this._userNameInputBox.onDidChange(userName => {
			this.setConnectButton();
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
		let shouldEnableConnectButton: boolean;
		if (this.useConnectionString) {
			shouldEnableConnectButton = this._connectionStringInputBox.isInputValid();
		} else {
			const showUsername: boolean = this.authType && (this.authType === AuthenticationType.SqlLogin || this.authType === AuthenticationType.AzureMFAAndUser);
			shouldEnableConnectButton = showUsername ? (this._serverNameInputBox.isInputValid() && this._userNameInputBox.isInputValid()) : this._serverNameInputBox.isInputValid();
		}
		this._callbacks.onSetConnectButton(shouldEnableConnectButton);
	}

	protected onAuthTypeSelected(selectedAuthType: string) {
		let currentAuthType = this.getMatchingAuthType(selectedAuthType);
		this._userNameInputBox.value === '';
		this._passwordInputBox.value === '';
		this._userNameInputBox.hideMessage();
		this._passwordInputBox.hideMessage();
		this._azureAccountDropdown.hideMessage();
		this._azureTenantDropdown.hideMessage();
		this._tableContainer.classList.add('hide-username');
		this._tableContainer.classList.add('hide-password');
		this._tableContainer.classList.add('hide-azure-accounts');

		if (currentAuthType === AuthenticationType.AzureMFA) {
			this.fillInAzureAccountOptions().then(async () => {
				// Don't enable the control until we've populated it
				this._azureAccountDropdown.enable();
				// Populate tenants
				await this.onAzureAccountSelected();
				this._azureTenantDropdown.enable();
			}).catch(err => this._logService.error(`Unexpected error populating Azure Account dropdown : ${err}`));
			// Immediately show/hide appropriate elements though so user gets immediate feedback while we load accounts
			this._tableContainer.classList.remove('hide-azure-accounts');
		} else if (currentAuthType === AuthenticationType.AzureMFAAndUser) {
			this.fillInAzureAccountOptions().then(async () => {
				// Don't enable the control until we've populated it
				this._azureAccountDropdown.enable();
				// Populate tenants
				await this.onAzureAccountSelected();
				this._azureTenantDropdown.enable();
			}).catch(err => this._logService.error(`Unexpected error populating Azure Account dropdown : ${err}`));
			// Immediately show/hide appropriate elements though so user gets immediate feedback while we load accounts
			this._tableContainer.classList.remove('hide-username');
			this._tableContainer.classList.remove('hide-azure-accounts');
		} else if (currentAuthType === AuthenticationType.DSTSAuth) {
			this._accountManagementService.getAccountsForProvider('dstsAuth').then(accounts => {
				if (accounts && accounts.length > 0) {
					accounts[0].key.providerArgs = {
						serverName: this.serverName,
						databaseName: this.databaseName
					};

					this._accountManagementService.getAccountSecurityToken(accounts[0], undefined, undefined).then(securityToken => {
						this._token = securityToken.token;
					});
				}
			});
		} else if (currentAuthType === AuthenticationType.SqlLogin) {
			this._tableContainer.classList.remove('hide-username');
			this._tableContainer.classList.remove('hide-password');
			this._userNameInputBox.enable();
			this._passwordInputBox.enable();
			this._rememberPasswordCheckBox.enabled = true;
		}
	}

	private async fillInAzureAccountOptions(): Promise<void> {
		let oldSelection = this._azureAccountDropdown.value;
		const accounts = await this._accountManagementService.getAccounts();
		this._azureAccountList = accounts.filter(a => a.key.providerId.startsWith('azure'));
		let accountDropdownOptions: SelectOptionItemSQL[] = this._azureAccountList.map(account => {
			return {
				text: account.displayInfo.displayName,
				value: account.key.accountId
			} as SelectOptionItemSQL;
		});

		if (accountDropdownOptions.length === 0) {
			// If there are no accounts add a blank option so that add account isn't automatically selected
			accountDropdownOptions.unshift({ text: '', value: '' });
		}
		accountDropdownOptions.push({ text: this._addAzureAccountMessage, value: this._addAzureAccountMessage });
		this._azureAccountDropdown.setOptions(accountDropdownOptions);
		this._azureAccountDropdown.selectWithOptionName(oldSelection);
	}

	private updateRefreshCredentialsLink(): void {
		let chosenAccount = this._azureAccountList.find(account => account.key.accountId === this._azureAccountDropdown.value);
		if (chosenAccount && chosenAccount.isStale) {
			this._tableContainer.classList.remove('hide-refresh-link');
		} else {
			this._tableContainer.classList.add('hide-refresh-link');
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
			this._tableContainer.classList.remove(hideTenantsClassName);
			this.onAzureTenantSelected(0);
		} else {
			if (selectedAccount && selectedAccount.properties.tenants && selectedAccount.properties.tenants.length === 1) {
				this._azureTenantId = selectedAccount.properties.tenants[0].id;
			} else {
				this._azureTenantId = undefined;
			}
			this._tableContainer.classList.add(hideTenantsClassName);
		}
	}

	private onAzureTenantSelected(tenantIndex: number): void {
		this._azureTenantId = undefined;
		let account = this._azureAccountList.find(account => account.key.accountId === this._azureAccountDropdown.value);
		if (account && account.properties.tenants) {
			let tenant = account.properties.tenants[tenantIndex];
			if (tenant) {
				this._azureTenantId = tenant.id;
				this._callbacks.onAzureTenantSelection(tenant.id);
			}
		}
	}

	private serverNameChanged(serverName: string) {
		this.setConnectButton();
		if (serverName.toLocaleLowerCase().indexOf('database.windows.net') > -1) {
			this._callbacks.onSetAzureTimeOut();
		}
	}

	public focusOnAdvancedButton() {
		this._advancedButton.focus();
	}

	public focusOnServerGroup() {
		if (this._serverGroupSelectBox) {
			this._serverGroupSelectBox.focus();
		}
	}

	public updateServerGroup(connectionGroups: IConnectionProfileGroup[], groupName?: string) {
		if (this._serverGroupSelectBox) {
			this._serverGroupOptions = connectionGroups;
			this._serverGroupOptions.push(this._addNewServerGroup);
			this._serverGroupSelectBox.setOptions(this._serverGroupOptions.map(g => {
				if (g instanceof ConnectionProfileGroup) {
					return g.fullName;
				}
				return g.name;
			}));
			if (groupName) {
				this._serverGroupSelectBox.selectWithOptionName(groupName);
				this._previousGroupOption = this._serverGroupSelectBox.value;
			}
		}
	}

	public initDialog(connectionInfo: IConnectionProfile): void {
		this.fillInConnectionInputs(connectionInfo);
	}

	public focusOnOpen(): void {
		if (this.useConnectionString) {
			this._connectionStringInputBox.focus();
		} else {
			this._serverNameInputBox.focus();
			this.focusPasswordIfNeeded();
		}
		this.clearValidationMessages();
	}

	private clearValidationMessages(): void {
		this._serverNameInputBox.hideMessage();
		this._userNameInputBox.hideMessage();
		this._azureAccountDropdown.hideMessage();
		this._connectionStringInputBox?.hideMessage();
	}

	private getModelValue(value: string): string {
		return value ? value : '';
	}

	public fillInConnectionInputs(connectionInfo: IConnectionProfile) {
		if (connectionInfo) {
			// If initializing from an existing connection, always switch to the parameters view.
			if (connectionInfo.serverName && this._connectionStringOptions.isEnabled) {
				this._defaultInputOptionRadioButton.checked = true;
			}
			this._serverNameInputBox.value = this.getModelValue(connectionInfo.serverName);
			this._connectionNameInputBox.value = this.getModelValue(connectionInfo.connectionName);
			this._userNameInputBox.value = this.getModelValue(connectionInfo.userName);
			this._passwordInputBox.value = this.getModelValue(connectionInfo.password);
			this._saveProfile = connectionInfo.saveProfile;
			this._azureTenantId = connectionInfo.azureTenantId;
			if (this._databaseNameInputBox) {
				this._databaseNameInputBox.value = this.getModelValue(connectionInfo.databaseName);
			}
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
			if (this._serverGroupSelectBox) {
				this._serverGroupSelectBox.selectWithOptionName(groupName);
				this._previousGroupOption = this._serverGroupSelectBox.value;
			}

			// To handle the empty password case
			if (this.getModelValue(connectionInfo.password) === '') {
				this._rememberPasswordCheckBox.checked = false;
			} else {
				this._rememberPasswordCheckBox.checked = connectionInfo.savePassword;
			}

			if (connectionInfo.authenticationType !== null && connectionInfo.authenticationType !== undefined) {
				let authTypeDisplayName = this.getAuthTypeDisplayName(connectionInfo.authenticationType);
				this._authTypeSelectBox.selectWithOptionName(authTypeDisplayName);
			}

			if (this._authTypeSelectBox) {
				this.onAuthTypeSelected(this._authTypeSelectBox.value);
			} else {
				this._tableContainer.classList.remove('hide-username');
				this._tableContainer.classList.remove('hide-password');
				this._tableContainer.classList.add('hide-azure-accounts');
			}

			if (this._customOptionWidgets) {
				this._customOptionWidgets.forEach((widget, i) => {
					if (widget instanceof SelectBox) {
						widget.selectWithOptionName(this.getModelValue(connectionInfo.options[this._customOptions[i].name]));
					} else {
						widget.value = this.getModelValue(connectionInfo.options[this._customOptions[i].name]);
					}
				});
			}

			if (this.authType === AuthenticationType.AzureMFA || this.authType === AuthenticationType.AzureMFAAndUser) {
				this.fillInAzureAccountOptions().then(async () => {
					let tenantId = connectionInfo.azureTenantId;
					let accountName = (this.authType === AuthenticationType.AzureMFA)
						? connectionInfo.azureAccount : connectionInfo.userName;
					this._azureAccountDropdown.selectWithOptionName(this.getModelValue(accountName));
					await this.onAzureAccountSelected();
					let account = this._azureAccountList.find(account => account.key.accountId === this._azureAccountDropdown.value);
					if (account && account.properties.tenants.length > 1) {
						let tenant = account.properties.tenants.find(tenant => tenant.id === tenantId);
						if (tenant) {
							this._azureTenantDropdown.selectWithOptionName(tenant.displayName);
						}
						this.onAzureTenantSelected(this._azureTenantDropdown.values.indexOf(this._azureTenantDropdown.value));
					}
				}).catch(err => this._logService.error(`Unexpected error populating initial Azure Account options : ${err}`));
			}

			// Disable connect button if -
			// 1. Authentication type is SQL Login and no username is provided
			// 2. No server name is provided
			this.setConnectButton();
			this.focusPasswordIfNeeded();
		}
	}

	protected getAuthTypeDisplayName(authTypeName: string) {
		let displayName: string;
		let authTypeOption: azdata.ConnectionOption = this._optionsMaps[ConnectionOptionSpecialType.authType];

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
		let authTypeName: string;
		let authTypeOption: azdata.ConnectionOption = this._optionsMaps[ConnectionOptionSpecialType.authType];
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
		this._serverNameInputBox.disable();
		this._userNameInputBox.disable();
		this._passwordInputBox.disable();
		this._connectionNameInputBox.disable();
		this._rememberPasswordCheckBox.enabled = false;
		if (this._serverGroupSelectBox) {
			this._serverGroupSelectBox.disable();
		}
		if (this._databaseNameInputBox) {
			this._databaseNameInputBox.enabled = false;
		}
		if (this._authTypeSelectBox) {
			this._authTypeSelectBox.disable();
		}
		if (this._customOptionWidgets) {
			this._customOptionWidgets.forEach(widget => {
				widget.disable();
			});
		}
		if (this._connectionStringOptions.isEnabled) {
			this._connectionStringInputBox.disable();
			this._defaultInputOptionRadioButton.enabled = false;
			this._connectionStringRadioButton.enabled = false;
		}
	}

	public handleResetConnection(): void {
		this._advancedButton.enabled = true;
		this._serverNameInputBox.enable();
		this._connectionNameInputBox.enable();

		let currentAuthType: AuthenticationType = undefined;
		if (this._authTypeSelectBox) {
			this._authTypeSelectBox.enable();
			currentAuthType = this.getMatchingAuthType(this._authTypeSelectBox.value);
		}

		if (!currentAuthType || currentAuthType === AuthenticationType.SqlLogin) {
			this._userNameInputBox.enable();
			this._passwordInputBox.enable();
			this._rememberPasswordCheckBox.enabled = true;
		} else if (currentAuthType === AuthenticationType.AzureMFAAndUser) {
			this._userNameInputBox.enable();
		}

		if (this._focusedBeforeHandleOnConnection) {
			this._focusedBeforeHandleOnConnection.focus();
		}

		if (this._serverGroupSelectBox) {
			this._serverGroupSelectBox.enable();
		}

		if (this._databaseNameInputBox) {
			this._databaseNameInputBox.enabled = true;
		}
		if (this._customOptionWidgets) {
			this._customOptionWidgets.forEach(widget => {
				widget.enable();
			});
		}
		if (this._connectionStringOptions.isEnabled) {
			this._connectionStringInputBox.enable();
			this._defaultInputOptionRadioButton.enabled = true;
			this._connectionStringRadioButton.enabled = true;
		}
	}

	public get useConnectionString(): boolean {
		return !!(this._connectionStringRadioButton?.checked);
	}

	public get connectionString(): string {
		return this._connectionStringInputBox?.value;
	}

	public get connectionName(): string {
		return this._connectionNameInputBox.value;
	}

	public get serverName(): string {
		return this._serverNameInputBox.value;
	}

	public get databaseName(): string {
		return this._databaseNameInputBox ? this._databaseNameInputBox.value : undefined;
	}

	public get userName(): string {
		return this.authenticationType === AuthenticationType.AzureMFA ? this._azureAccountDropdown.label : this._userNameInputBox.value;
	}

	public get password(): string {
		return this._passwordInputBox.value;
	}

	public get authenticationType(): string {
		return this._authTypeSelectBox ? this.getAuthTypeName(this._authTypeSelectBox.value) : undefined;
	}

	public get authToken(): string | undefined {
		if (this.authenticationType === AuthenticationType.AzureMFAAndUser || this.authenticationType === AuthenticationType.AzureMFA) {
			return this._azureAccountDropdown.value;
		}
		if (this.authenticationType === AuthenticationType.DSTSAuth) {
			return this._token;
		}
		return undefined;
	}

	private validateAzureAccountSelection(showMessage: boolean = true): boolean {
		if (this.authType !== AuthenticationType.AzureMFA && this.authType !== AuthenticationType.AzureMFAAndUser) {
			return true;
		}

		let selected = this._azureAccountDropdown.value;
		if (selected === '' || selected === this._addAzureAccountMessage) {
			if (showMessage) {
				this._azureAccountDropdown.showMessage({
					content: localize('connectionWidget.invalidAzureAccount', "You must select an account"),
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
		if (this.useConnectionString) {
			const isConnectionStringValid = this._connectionStringInputBox.validate() === undefined;
			if (!isConnectionStringValid) {
				this._connectionStringInputBox.focus();
			}
			return isConnectionStringValid;
		} else {
			let isFocused = false;
			const isServerNameValid = this._serverNameInputBox.validate() === undefined;
			if (!isServerNameValid) {
				this._serverNameInputBox.focus();
				isFocused = true;
			}
			const isUserNameValid = this._userNameInputBox.validate() === undefined;
			if (!isUserNameValid && !isFocused) {
				this._userNameInputBox.focus();
				isFocused = true;
			}
			const isPasswordValid = this._passwordInputBox.validate() === undefined;
			if (!isPasswordValid && !isFocused) {
				this._passwordInputBox.focus();
				isFocused = true;
			}
			const isAzureAccountValid = this.validateAzureAccountSelection();
			if (!isAzureAccountValid && !isFocused) {
				this._azureAccountDropdown.focus();
				isFocused = true;
			}
			return isServerNameValid && isUserNameValid && isPasswordValid && isAzureAccountValid;
		}
	}

	public async connect(model: IConnectionProfile): Promise<boolean> {
		let validInputs = this.validateInputs();
		if (validInputs) {
			if (this.useConnectionString) {
				const connInfo = await this._connectionManagementService.buildConnectionInfo(this.connectionString, this._providerName);
				if (connInfo) {
					model.options = connInfo.options;
					model.savePassword = true;
				} else {
					this._errorMessageService.showDialog(Severity.Error, localize('connectionWidget.Error', "Error"), localize('connectionWidget.ConnectionStringError', "Failed to parse the connection string."));
					return false;
				}
			} else {
				model.serverName = this.serverName;
				model.userName = this.userName;
				model.password = this.password;
				model.authenticationType = this.authenticationType;
				model.azureAccount = this.authToken;
				model.savePassword = this._rememberPasswordCheckBox.checked;
				model.connectionName = this.connectionName;
				model.databaseName = this.databaseName;
				if (this._customOptionWidgets) {
					this._customOptionWidgets.forEach((widget, i) => {
						model.options[this._customOptions[i].name] = widget.value;
					});
				}
				if (this._serverGroupSelectBox) {
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
				}
				if (this.authType === AuthenticationType.AzureMFA || this.authType === AuthenticationType.AzureMFAAndUser) {
					model.azureTenantId = this._azureTenantId;
				}
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

	private getMatchingAuthType(displayName: string): AuthenticationType {
		if (!displayName) {
			return undefined;
		}
		return ConnectionWidget._authTypes.find(authType => this.getAuthTypeDisplayName(authType) === displayName);
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
