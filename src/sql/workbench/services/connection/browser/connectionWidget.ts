/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';

import * as azdata from 'azdata';

import * as utils from 'vs/base/common/errors';
import * as lifecycle from 'vs/base/common/lifecycle';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { OS, OperatingSystem } from 'vs/base/common/platform';
import { IMessage, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { ILogService } from 'vs/platform/log/common/log';
import { Dropdown } from 'sql/base/browser/ui/editableDropdown/browser/dropdown';
import { RadioButton } from 'sql/base/browser/ui/radioButton/radioButton';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import Severity from 'vs/base/common/severity';
import { ConnectionStringOptions } from 'sql/platform/capabilities/common/capabilitiesService';
import { isFalsyOrWhitespace } from 'vs/base/common/strings';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { AuthenticationType, Actions, mssqlApplicationNameOption, applicationName, mssqlProviderName, mssqlCmsProviderName } from 'sql/platform/connection/common/constants';
import { AdsWidget } from 'sql/base/browser/ui/adsWidget';
import { createCSSRule } from 'vs/base/browser/dom';
import { adjustForMssqlAppName } from 'sql/platform/connection/common/utils';
import { isMssqlAuthProviderEnabled } from 'sql/workbench/services/connection/browser/utils';
import { RequiredIndicatorClassName } from 'sql/base/browser/ui/label/label';
import { FieldSet } from 'sql/base/browser/ui/fieldset/fieldset';
import { defaultButtonStyles, defaultInputBoxStyles } from 'vs/platform/theme/browser/defaultStyles';
import { defaultCheckboxStyles, defaultEditableDropdownStyles, defaultSelectBoxStyles } from 'sql/platform/theme/browser/defaultStyles';

const ConnectionStringText = localize('connectionWidget.connectionString', "Connection string");

export class ConnectionWidget extends lifecycle.Disposable {
	private _initialConnectionInfo: IConnectionProfile;
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
	private _databaseDropdownExpanded: boolean = false;
	private _defaultDatabaseName: string = localize('defaultDatabaseOption', "<Default>");
	private _loadingDatabaseName: string = localize('loadingDatabaseOption', "Loading...");
	private _serverGroupDisplayString: string = localize('serverGroup', "Server group");
	private _trueInputValue: string = localize('boolean.true', 'True');
	private _falseInputValue: string = localize('boolean.false', 'False');
	private _token: string;
	private _mssqlAuthProviderEnabled: boolean;
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
	protected _customOptionWidgets: AdsWidget[];
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
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IConfigurationService private _configurationService: IConfigurationService
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
			this._authTypeSelectBox = new SelectBox(authTypeOption.categoryValues.map(c => c.displayName), authTypeDefaultDisplay, defaultSelectBoxStyles, this._contextViewService, undefined, { ariaLabel: authTypeOption.displayName });
			this._register(this._authTypeSelectBox);
		}
		this._providerName = providerName;
		this._mssqlAuthProviderEnabled = isMssqlAuthProviderEnabled(this._providerName, this._configurationService)
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
		this._serverGroupSelectBox = new SelectBox(this._serverGroupOptions.map(g => g.name), this.DefaultServerGroup.name, defaultSelectBoxStyles, this._contextViewService, undefined, { ariaLabel: this._serverGroupDisplayString });
		this._register(this._serverGroupSelectBox);
		this._previousGroupOption = this._serverGroupSelectBox.value;
		this._container = DOM.append(container, DOM.$('div.connection-table'));
		this._tableContainer = DOM.append(this._container, DOM.$('table.connection-table-content'));
		this._tableContainer.setAttribute('role', 'presentation');
		this.fillInConnectionForm(authTypeChanged);
		this.registerListeners();
		if (this._authTypeSelectBox) {
			this.onAuthTypeSelected(this._authTypeSelectBox.value, false);
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
		this.registerOnSelectionChangeEvents();
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
			const inputTypeLabel = localize('connectionWidget.inputTypeLabel', "Input type");
			const inputOptionsContainer = DialogHelper.appendRow(this._tableContainer, inputTypeLabel, 'connection-label', 'connection-input', 'connection-input-options');
			const inputTypeGroup = new FieldSet(inputOptionsContainer, { ariaLabel: inputTypeLabel });
			this._defaultInputOptionRadioButton = new RadioButton(inputTypeGroup.element, { label: localize('connectionWidget.inputType.parameters', "Parameters"), checked: !this._connectionStringOptions.isDefault });
			this._connectionStringRadioButton = new RadioButton(inputTypeGroup.element, { label: localize('connectionWidget.inputType.connectionString', "Connection String"), checked: this._connectionStringOptions.isDefault });
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
				flexibleMaxHeight: 100,
				inputBoxStyles: defaultInputBoxStyles
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
			let authType = DialogHelper.appendRow(this._tableContainer, this._optionsMaps[ConnectionOptionSpecialType.authType].displayName,
				'connection-label', 'connection-input', 'auth-type-row');
			DialogHelper.appendInputSelectBox(authType, this._authTypeSelectBox);
		}
	}

	protected addCustomConnectionOptions(): void {
		if (this._customOptions.length > 0) {
			this._customOptionWidgets = [];
			this._customOptions.forEach((option, i) => {
				let customOptionsContainer = DialogHelper.appendRow(this._tableContainer, option.displayName, 'connection-label', 'connection-input',
					['custom-connection-options', `option-${option.name}`], false, option.description, 100);
				switch (option.valueType) {
					case ServiceOptionType.boolean:
					case ServiceOptionType.category:

						let selectedValue = option.defaultValue;

						let options = option.valueType === ServiceOptionType.category
							? option.categoryValues.map<SelectOptionItemSQL>(v => {
								return { text: v.displayName, value: v.name } as SelectOptionItemSQL;
							})
							:
							[ // Handle boolean options so we can map displaynames to values.
								{ displayName: this._trueInputValue, value: 'true' },
								{ displayName: this._falseInputValue, value: 'false' }
							].map<SelectOptionItemSQL>(v => {
								return { text: v.displayName, value: v.value } as SelectOptionItemSQL;
							});

						this._customOptionWidgets[i] = new SelectBox(options, selectedValue, defaultSelectBoxStyles, this._contextViewService, customOptionsContainer, { ariaLabel: option.displayName }, option.name);
						DialogHelper.appendInputSelectBox(customOptionsContainer, this._customOptionWidgets[i] as SelectBox);
						break;
					default:
						this._customOptionWidgets[i] = new InputBox(customOptionsContainer, this._contextViewService, {
							ariaLabel: option.displayName,
							placeholder: option.placeholder,
							inputBoxStyles: defaultInputBoxStyles
						});
						break;
				}
				this._register(this._customOptionWidgets[i]);
			});
		}
	}

	/**
	 * Registers on selection change event for connection options configured with 'onSelectionChange' property.
	 * TODO extend this to include collection of other main and advanced option widgets here.
	 */
	protected registerOnSelectionChangeEvents(): void {
		//Register on selection change event for custom options
		this._customOptionWidgets?.forEach((widget, i) => {
			if (widget instanceof SelectBox) {
				this._registerSelectionChangeEvents([this._customOptionWidgets], this._customOptions[i], widget);
			}
		});
	}

	private _registerSelectionChangeEvents(collections: AdsWidget[][], option: azdata.ConnectionOption, widget: SelectBox) {
		if (option.onSelectionChange) {
			option.onSelectionChange.forEach((event) => {
				this._register(widget.onDidSelect(_ => {
					let selectedValue = widget.value;
					event?.dependentOptionActions?.forEach((optionAction) => {
						let defaultValue: string | undefined = this._customOptions.find(o => o.name === optionAction.optionName)?.defaultValue;
						let widget: AdsWidget | undefined = this._findWidget(collections, optionAction.optionName);
						if (widget) {
							createCSSRule(`.hide-${widget.id} .option-${widget.id}`, `display: none;`);
							this._onValueChangeEvent(selectedValue, event.values, widget, defaultValue, optionAction);
						}
					});
				}));
			});
		}
	}

	/**
	 * Finds Widget from provided collection of widgets using option name.
	 * @param collections collections of widgets to search for the widget with the widget Id
	 * @param id Widget Id
	 * @returns Widget if found, undefined otherwise
	 */
	private _findWidget(collections: AdsWidget[][], id: string): AdsWidget | undefined {
		let foundWidget: AdsWidget | undefined;
		collections.forEach((collection) => {
			if (!foundWidget) {
				foundWidget = collection.find(widget => widget.id === id);
			}
		});
		return foundWidget;
	}

	private _onValueChangeEvent(selectedValue: string, acceptedValues: string[],
		widget: AdsWidget, defaultValue: string, optionAction: azdata.DependentOptionAction): void {
		if ((acceptedValues.includes(selectedValue.toLocaleLowerCase()) && optionAction.action === Actions.Show)
			|| (!acceptedValues.includes(selectedValue.toLocaleLowerCase()) && optionAction.action === Actions.Hide)) {
			this._tableContainer.classList.remove(`hide-${widget.id}`);
			if (optionAction.required) {
				let element = DialogHelper.getOptionContainerByName(this._tableContainer, optionAction.optionName);
				if (element) {
					element.classList.add(RequiredIndicatorClassName);
				}
			}
		} else {
			// Support more Widget classes here as needed.
			if (widget instanceof SelectBox) {
				widget.select(widget.values.indexOf(defaultValue));
			} else if (widget instanceof InputBox) {
				widget.value = defaultValue;
			}

			// Reset required indicator.
			let element = DialogHelper.getOptionContainerByName(this._tableContainer, optionAction.optionName);
			if (element && element!.hasChildNodes && element.childElementCount > 1) {
				element!.children.item(1).remove();
			}
			this._tableContainer.classList.add(`hide-${widget.id}`);
			widget.hideMessage();
		}
	}

	protected addServerNameOption(): void {
		// Server name
		let serverNameOption: azdata.ConnectionOption = this._optionsMaps[ConnectionOptionSpecialType.serverName];
		let serverName = DialogHelper.appendRow(this._tableContainer, serverNameOption.displayName, 'connection-label', 'connection-input', 'server-name-row', true);
		this._serverNameInputBox = new InputBox(serverName, this._contextViewService, {
			validationOptions: {
				validation: (value: string) => {
					return this.validateRequiredOptionValue(value, serverNameOption.displayName);
				}
			},
			ariaLabel: serverNameOption.displayName,
			placeholder: serverNameOption.placeholder,
			inputBoxStyles: defaultInputBoxStyles
		});
		this._register(this._serverNameInputBox);
	}

	protected addLoginOptions(): void {
		// Username
		let self = this;
		let userNameOption: azdata.ConnectionOption = this._optionsMaps[ConnectionOptionSpecialType.userName];
		let userName = DialogHelper.appendRow(this._tableContainer, userNameOption.displayName, 'connection-label', 'connection-input', 'username-row', userNameOption.isRequired);
		this._userNameInputBox = new InputBox(userName, this._contextViewService, {
			validationOptions: {
				validation: (value: string) => self.validateUsername(value, userNameOption.isRequired) ? ({ type: MessageType.ERROR, content: localize('connectionWidget.missingRequireField', "{0} is required.", userNameOption.displayName) }) : null
			},
			ariaLabel: userNameOption.displayName,
			placeholder: userNameOption.placeholder,
			inputBoxStyles: defaultInputBoxStyles
		});
		this._register(this._userNameInputBox);
		// Password
		let passwordOption: azdata.ConnectionOption = this._optionsMaps[ConnectionOptionSpecialType.password];
		let password = DialogHelper.appendRow(this._tableContainer, passwordOption.displayName, 'connection-label', 'connection-input', 'password-row');
		this._passwordInputBox = new InputBox(password, this._contextViewService, {
			ariaLabel: passwordOption.displayName,
			placeholder: passwordOption.placeholder,
			inputBoxStyles: defaultInputBoxStyles
		});
		this._passwordInputBox.inputElement.type = 'password';
		this._register(this._passwordInputBox);

		// Remember password
		let rememberPasswordLabel = localize('rememberPassword', "Remember password");
		this._rememberPasswordCheckBox = this.appendCheckbox(this._tableContainer, rememberPasswordLabel, 'connection-input', 'password-row', false);
		this._register(this._rememberPasswordCheckBox);

		// Azure account picker
		let accountLabel = localize('connection.azureAccountDropdownLabel', "Account");
		let accountDropdown = DialogHelper.appendRow(this._tableContainer, accountLabel, 'connection-label', 'connection-input', 'azure-account-row');
		this._azureAccountDropdown = new SelectBox([], undefined, defaultSelectBoxStyles, this._contextViewService, accountDropdown, { ariaLabel: accountLabel });
		this._register(this._azureAccountDropdown);
		DialogHelper.appendInputSelectBox(accountDropdown, this._azureAccountDropdown);
		let refreshCredentials = DialogHelper.appendRow(this._tableContainer, '', 'connection-label', 'connection-input', ['azure-account-row', 'refresh-credentials-link']);
		this._refreshCredentialsLink = DOM.append(refreshCredentials, DOM.$('a'));
		this._refreshCredentialsLink.href = '#';
		this._refreshCredentialsLink.innerText = localize('connectionWidget.refreshAzureCredentials', "Refresh account credentials");
		// Azure tenant picker
		let tenantLabel = localize('connection.azureTenantDropdownLabel', "Microsoft Entra tenant");
		let tenantDropdown = DialogHelper.appendRow(this._tableContainer, tenantLabel, 'connection-label', 'connection-input', ['azure-account-row', 'azure-tenant-row']);
		this._azureTenantDropdown = new SelectBox([], undefined, defaultSelectBoxStyles, this._contextViewService, tenantDropdown, { ariaLabel: tenantLabel });
		this._register(this._azureTenantDropdown);
		DialogHelper.appendInputSelectBox(tenantDropdown, this._azureTenantDropdown);
	}

	private addDatabaseOption(): void {
		// Database
		let databaseOption: azdata.ConnectionOption = this._optionsMaps[ConnectionOptionSpecialType.databaseName];
		if (databaseOption) {
			let databaseName = DialogHelper.appendRow(this._tableContainer, databaseOption.displayName, 'connection-label', 'connection-input', 'database-row');
			this._databaseNameInputBox = new Dropdown(databaseName, this._contextViewService, {
				values: [this._defaultDatabaseName, this._loadingDatabaseName],
				strictSelection: false,
				placeholder: databaseOption.placeholder ?? this._defaultDatabaseName,
				maxHeight: 125,
				ariaLabel: databaseOption.displayName,
				...defaultEditableDropdownStyles
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
		let connectionNameOption: azdata.ConnectionOption = this._optionsMaps[ConnectionOptionSpecialType.connectionName];
		connectionNameOption.displayName = localize('connectionName', "Name (optional)");
		let connectionNameBuilder = DialogHelper.appendRow(this._tableContainer, connectionNameOption.displayName, 'connection-label', 'connection-input');
		this._connectionNameInputBox = new InputBox(connectionNameBuilder, this._contextViewService, {
			ariaLabel: connectionNameOption.displayName,
			placeholder: connectionNameOption.placeholder,
			inputBoxStyles: defaultInputBoxStyles
		});
		this._register(this._connectionNameInputBox);
	}

	protected addAdvancedOptions(): void {
		const rowContainer = DOM.append(this._tableContainer, DOM.$('tr.advanced-options-row'));
		DOM.append(rowContainer, DOM.$('td'));
		const buttonContainer = DOM.append(rowContainer, DOM.$('td'));
		buttonContainer.setAttribute('align', 'right');
		const divContainer = DOM.append(buttonContainer, DOM.$('div.advanced-button'));
		this._advancedButton = new Button(divContainer, { secondary: true, ...defaultButtonStyles });
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
		return new Checkbox(checkboxContainer, { ...defaultCheckboxStyles, label, checked: isChecked, ariaLabel: label });
	}

	protected registerListeners(): void {
		if (this._serverGroupSelectBox) {
			this._register(this._serverGroupSelectBox.onDidSelect(selectedGroup => {
				this.onGroupSelected(selectedGroup.selected);
			}));
		}
		if (this._databaseNameInputBox) {
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

		if (this._authTypeSelectBox) {
			this._register(this._authTypeSelectBox.onDidSelect(selectedAuthType => {
				this.onAuthTypeSelected(selectedAuthType.selected, true);
				this.setConnectButton();
			}));
		}

		if (this._azureAccountDropdown) {
			this._register(this._azureAccountDropdown.onDidSelect(() => {
				this.onAzureAccountSelected().catch(err => this._logService.error(`Unexpected error handling Azure Account dropdown click : ${err}`));
			}));
		}

		if (this._azureTenantDropdown) {
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

	protected onAuthTypeSelected(selectedAuthType: string, clearCredentials: boolean): void {
		let currentAuthType = this.getMatchingAuthType(selectedAuthType);
		if (clearCredentials) {
			this._userNameInputBox.value = '';
			this._passwordInputBox.value = '';
		}
		this._userNameInputBox.hideMessage();
		this._passwordInputBox.hideMessage();
		this._azureAccountDropdown.hideMessage();
		this._azureTenantDropdown.hideMessage();
		if (this._mssqlAuthProviderEnabled) {
			this._tableContainer.classList.add('hide-azure-tenants');
		}
		this._tableContainer.classList.add('hide-username');
		this._tableContainer.classList.add('hide-password');
		this._tableContainer.classList.add('hide-azure-accounts');

		if (currentAuthType === AuthenticationType.AzureMFA) {
			this.fillInAzureAccountOptions().then(async () => {
				// Don't enable the control until we've populated it
				this._azureAccountDropdown.enable();
				// Populate tenants (select first by default for initialization of tenant dialog)
				await this.onAzureAccountSelected(true);
				this._azureTenantDropdown.enable();
			}).catch(err => this._logService.error(`Unexpected error populating Azure Account dropdown : ${err}`));
			// Immediately show/hide appropriate elements though so user gets immediate feedback while we load accounts
			this._tableContainer.classList.remove('hide-azure-accounts');
		} else if (currentAuthType === AuthenticationType.AzureMFAAndUser) {
			this.fillInAzureAccountOptions().then(async () => {
				// Don't enable the control until we've populated it
				this._azureAccountDropdown.enable();
				// Populate tenants (select first by default for initialization of tenant dialog)
				await this.onAzureAccountSelected(true);
				this._azureTenantDropdown.enable();
				// Populate username as 'email' of selected azure account in dropdown, as username is required,
				// and email of Azure account selected applies as username in most cases.
				this._userNameInputBox.value = this.userName ?? this._azureAccountList.find(a => a.displayInfo.displayName === this._azureAccountDropdown.value)?.displayInfo.email!
					?? this._azureAccountList[0]?.displayInfo?.email ?? '';
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

			if (this._initialConnectionInfo) {
				this._initialConnectionInfo.authenticationType = AuthenticationType.SqlLogin;

				if (this._initialConnectionInfo.userName) {
					const setPasswordInputBox = (profile: IConnectionProfile) => {
						this._passwordInputBox.value = profile.password;
					};

					this._rememberPasswordCheckBox.checked = this._initialConnectionInfo.savePassword;
					this._connectionManagementService.addSavedPassword(this._initialConnectionInfo, true).then(setPasswordInputBox)
				}
			}
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
		this._azureAccountDropdown.selectWithOptionName(oldSelection, false);
	}

	private updateRefreshCredentialsLink(): void {
		let chosenAccount = this._azureAccountList.find(account => account.key.accountId === this._azureAccountDropdown.value);
		if (chosenAccount && chosenAccount.isStale) {
			this._tableContainer.classList.remove('hide-refresh-link');
		} else {
			this._tableContainer.classList.add('hide-refresh-link');
		}
	}

	private async onAzureAccountSelected(selectFirstByDefault: boolean = false): Promise<void> {
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
		if (!selectedAccount && selectFirstByDefault && this._azureAccountList.length > 0) {
			selectedAccount = this._azureAccountList[0];
		}

		if (this.authenticationType === AuthenticationType.AzureMFAAndUser && this._userNameInputBox.value === '') {
			// Populate username as 'email' of selected azure account in dropdown, as username is required,
			// and email of Azure account selected applies as username in most cases.
			this._userNameInputBox.value = selectedAccount?.displayInfo?.email! ?? '';
		}

		if (selectedAccount && selectedAccount.properties.tenants && selectedAccount.properties.tenants.length > 1) {
			// There are multiple tenants available so let the user select one
			let options = selectedAccount.properties.tenants.map(tenant => tenant.displayName);
			this._azureTenantDropdown.setOptions(options);
			if (!this._mssqlAuthProviderEnabled) {
				this._tableContainer.classList.remove(hideTenantsClassName);
			}

			// If we have a tenant ID available, select that instead of the first one
			if (this._azureTenantId) {
				let tenant = selectedAccount.properties.tenants.find(tenant => tenant.id === this._azureTenantId);
				if (tenant) {
					this.onAzureTenantSelected(options.indexOf(tenant.displayName));
				}
				else {
					// This should ideally never ever happen!
					this._logService.error(`onAzureAccountSelected : Could not find tenant with ID ${this._azureTenantId} for account ${selectedAccount.displayInfo.displayName}`);
					this.onAzureTenantSelected(0);
				}
			}
			else {
				this.onAzureTenantSelected(0);
			}

		} else {
			if (selectedAccount && selectedAccount.properties.tenants && selectedAccount.properties.tenants.length === 1) {
				let options = selectedAccount.properties.tenants.map(tenant => tenant.displayName);
				this._azureTenantDropdown.setOptions(options);
				this._azureTenantId = selectedAccount.properties.tenants[0].id;
				this.onAzureTenantSelected(0);
			}
			if (!this._mssqlAuthProviderEnabled) {
				this._tableContainer.classList.add(hideTenantsClassName);
			}
		}
	}

	private onAzureTenantSelected(tenantIndex: number): void {
		let account = this._azureAccountList.find(account => account.key.accountId === this._azureAccountDropdown.value);
		if (account && account.properties.tenants) {
			let tenant = account.properties.tenants[tenantIndex];
			if (tenant) {
				this._callbacks.onAzureTenantSelection(tenant.id);
			}
			else {
				// This should ideally never ever happen!
				this._logService.error(`onAzureTenantSelected : Tenant list not found as expected, missing tenant on index ${tenantIndex}`);
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
		this._initialConnectionInfo = connectionInfo;
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

	private getModelValue(value: any): string {
		return value !== undefined ? value.toString() : '';
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
			this._azureTenantId = connectionInfo.azureTenantId;
			if (this._databaseNameInputBox) {
				this._databaseNameInputBox.value = this.getModelValue(connectionInfo.databaseName);
			}
			let groupName: string;
			if (!connectionInfo.groupFullName) {
				groupName = this.DefaultServerGroup.name;
			} else {
				groupName = connectionInfo.groupFullName.replace('root/', '');
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
				this.onAuthTypeSelected(this._authTypeSelectBox.value, false);
			} else {
				this._tableContainer.classList.remove('hide-username');
				this._tableContainer.classList.remove('hide-password');
				this._tableContainer.classList.add('hide-azure-accounts');
			}

			if (this._customOptionWidgets) {
				this._customOptionWidgets.forEach((widget, i) => {
					let value = this.getModelValue(connectionInfo.options[this._customOptions[i].name]);
					if (value !== '') {
						if (widget instanceof SelectBox) {
							widget.selectWithOptionName(value);
						} else if (widget instanceof InputBox) {
							widget.value = value;
						}
					}
				});
			}

			if (this.authType === AuthenticationType.AzureMFA || this.authType === AuthenticationType.AzureMFAAndUser || connectionInfo.azureAccount !== null) {
				this.fillInAzureAccountOptions().then(async () => {
					let accountName = ((this.authType === AuthenticationType.AzureMFA) || connectionInfo.azureAccount !== null)
						? connectionInfo.azureAccount : connectionInfo.userName;
					let account: azdata.Account;
					if (accountName) {
						account = this._azureAccountList?.find(account => account.key.accountId === this.getModelValue(accountName));
						if (account) {
							if (!account.properties.tenants?.find(tenant => tenant.id === this._azureTenantId)) {
								this._azureTenantId = account.properties.tenants[0].id;
							}
							this._azureAccountDropdown.selectWithOptionName(account.key.accountId);
						}
					}
					if (!account) {
						// If account was not filled in from received configuration, select the first account.
						this._azureAccountDropdown.select(0);
						account = this._azureAccountList[0];
						if (this._azureAccountList.length > 0) {
							accountName = account?.key?.accountId;
						} else {
							this._logService.debug('fillInConnectionInputs: No accounts available');
						}
					}
					await this.onAzureAccountSelected();

					let tenantId = connectionInfo.azureTenantId;
					if (account && account.properties.tenants) {
						if (account.properties.tenants.length > 1) {
							if (tenantId) {
								let tenant = account.properties.tenants.find(tenant => tenant.id === tenantId);
								if (tenant) {
									this._azureTenantDropdown.selectWithOptionName(tenant.displayName);
								}
								else {
									// This should ideally never ever happen!
									this._logService.error(`fillInConnectionInputs : Could not find tenant with ID ${this._azureTenantId} for account ${accountName}`);
								}
								if (this._azureTenantDropdown.value) {
									this.onAzureTenantSelected(this._azureTenantDropdown.values.indexOf(this._azureTenantDropdown.value));
								}
							}
							// else don't do anything if tenant Id is not set.
						}
						else if (account.properties.tenants.length === 1) {
							this._azureTenantId = account.properties.tenants[0].id;
							this.onAzureTenantSelected(0);
						}
					}
					else if (accountName) {
						this._logService.error(`fillInConnectionInputs : Could not find any tenants for account ${accountName}`);
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
		if (this.authType === AuthenticationType.AzureMFA || this.authType === AuthenticationType.AzureMFAAndUser) {
			this._azureAccountDropdown.disable();
			this._azureTenantDropdown?.disable();
			if (!this._azureAccountDropdown.value) {
				this._azureAccountDropdown.select(0);
			}
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

		if (this.authType === AuthenticationType.AzureMFA || this.authType === AuthenticationType.AzureMFAAndUser) {
			this._azureAccountDropdown.enable();
			this._azureTenantDropdown?.enable();
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
				try {
					const connInfo = await this._connectionManagementService.buildConnectionInfo(this.connectionString, this._providerName);
					if (!connInfo) {
						throw Error(localize('connectionWidget.ConnectionStringUndefined', 'No connection info returned.'));
					}
					model.options = connInfo.options;
					model.savePassword = true;
				} catch (err) {
					this._logService.error(`${this._providerName} Failed to parse the connection string : ${err}`)
					this._errorMessageService.showDialog(Severity.Error, localize('connectionWidget.Error', "Error"),
						localize('connectionWidget.ConnectionStringError', "Failed to parse the connection string. {0}", utils.getErrorMessage(err)), err.stack);
					return false;
				}
			} else {
				model.serverName = this.serverName;
				model.userName = this.userName;
				model.password = this.password;
				model.authenticationType = this.authenticationType;
				const azureAccount = this.authToken;
				if (azureAccount) {
					// set the azureAccount only if one has been selected, otherwise preserve the initial model value
					model.azureAccount = azureAccount;
				}
				model.savePassword = this._rememberPasswordCheckBox.checked;
				model.databaseName = this.databaseName;
				if (this._customOptionWidgets) {
					this._customOptionWidgets.forEach((widget, i) => {
						model.options[this._customOptions[i].name] = widget.value;
					});
				}
			}
			// Fix Application Name for MSSQL/MSSQL-CMS Providers, to handle special case as we need to apply custom application name in ADS Core connection profile.
			if ((model.providerName === mssqlProviderName || model.providerName === mssqlCmsProviderName)
				&& model.options[mssqlApplicationNameOption] && !model.options[mssqlApplicationNameOption].endsWith(applicationName)) {
				model.options[mssqlApplicationNameOption] = adjustForMssqlAppName(model.options[mssqlApplicationNameOption]);
			}
			model.connectionName = this.connectionName;
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
