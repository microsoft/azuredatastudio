/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/sqlConnection';
import { Builder, $ } from 'vs/base/browser/builder';
import { Button } from 'sql/base/browser/ui/button/button';
import { MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import * as DialogHelper from 'sql/base/browser/ui/modal/dialogHelper';
import { IConnectionComponentCallbacks } from 'sql/parts/connection/connectionDialog/connectionDialogService';
import * as lifecycle from 'vs/base/common/lifecycle';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { ConnectionOptionSpecialType } from 'sql/workbench/api/common/sqlExtHostTypes';
import * as Constants from 'sql/parts/connection/common/constants';
import { ConnectionProfileGroup, IConnectionProfileGroup } from 'sql/parts/connection/common/connectionProfileGroup';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import * as styler from 'vs/platform/theme/common/styler';
import { attachInputBoxStyler, attachButtonStyler, attachEditableDropdownStyler } from 'sql/common/theme/styler';
import * as DOM from 'vs/base/browser/dom';
import data = require('data');
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { localize } from 'vs/nls';
import { OS, OperatingSystem } from 'vs/base/common/platform';
import { Dropdown } from 'sql/base/browser/ui/editableDropdown/dropdown';

export class ConnectionWidget {
	private _builder: Builder;
	private _serverGroupSelectBox: SelectBox;
	private _previousGroupOption: string;
	private _serverGroupOptions: IConnectionProfileGroup[];
	private _serverNameInputBox: InputBox;
	private _databaseNameInputBox: Dropdown;
	private _userNameInputBox: InputBox;
	private _passwordInputBox: InputBox;
	private _password: string;
	private _rememberPasswordCheckBox: Checkbox;
	private _advancedButton: Button;
	private _callbacks: IConnectionComponentCallbacks;
	private _authTypeSelectBox: SelectBox;
	private _toDispose: lifecycle.IDisposable[];
	private _optionsMaps: { [optionType: number]: data.ConnectionOption };
	private _tableContainer: Builder;
	private _focusedBeforeHandleOnConnection: HTMLElement;
	private _providerName: string;
	private _authTypeMap: { [providerName: string]: AuthenticationType[] } = {
		[Constants.mssqlProviderName]: [new AuthenticationType(Constants.integrated, false), new AuthenticationType(Constants.sqlLogin, true)]
	};
	private _saveProfile: boolean;
	private _defaultDatabaseName: string = localize('defaultDatabaseOption', '<Default>');
	private _loadingDatabaseName: string = localize('loadingDatabaseOption', 'Loading...');
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
		name: localize('noneServerGroup', '<None>'),
		parentId: undefined,
		color: undefined,
		description: undefined,
	};
	constructor(options: data.ConnectionOption[],
		callbacks: IConnectionComponentCallbacks,
		providerName: string,
		@IThemeService private _themeService: IThemeService,
		@IContextViewService private _contextViewService: IContextViewService) {
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
				authTypeOption.defaultValue = this.getAuthTypeDisplayName(Constants.integrated);
			} else {
				authTypeOption.defaultValue = this.getAuthTypeDisplayName(Constants.sqlLogin);
			}
			this._authTypeSelectBox = new SelectBox(authTypeOption.categoryValues.map(c => c.displayName), authTypeOption.defaultValue);
		}
		this._providerName = providerName;
	}

	public createConnectionWidget(container: HTMLElement): void {
		this._serverGroupOptions = [this.DefaultServerGroup];
		this._serverGroupSelectBox = new SelectBox(this._serverGroupOptions.map(g => g.name), this.DefaultServerGroup.name);
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
		DOM.append(container, this._builder.getHTMLElement());
	}

	private fillInConnectionForm(): void {
		let errorMessage = localize('missingRequireField', ' is required.');

		let serverNameOption = this._optionsMaps[ConnectionOptionSpecialType.serverName];
		let serverNameBuilder = DialogHelper.appendRow(this._tableContainer, serverNameOption.displayName, 'connection-label', 'connection-input');
		this._serverNameInputBox = new InputBox(serverNameBuilder.getHTMLElement(), this._contextViewService, {
			validationOptions: {
				validation: (value: string) => !value ? ({ type: MessageType.ERROR, content: serverNameOption.displayName + errorMessage }) : null
			},
		});

		if (this._optionsMaps[ConnectionOptionSpecialType.authType]) {
			let authTypeBuilder = DialogHelper.appendRow(this._tableContainer, this._optionsMaps[ConnectionOptionSpecialType.authType].displayName, 'connection-label', 'connection-input');
			DialogHelper.appendInputSelectBox(authTypeBuilder, this._authTypeSelectBox);
		}

		let self = this;
		let userNameOption = this._optionsMaps[ConnectionOptionSpecialType.userName];
		let userNameBuilder = DialogHelper.appendRow(this._tableContainer, userNameOption.displayName, 'connection-label', 'connection-input');
		this._userNameInputBox = new InputBox(userNameBuilder.getHTMLElement(), this._contextViewService, {
			validationOptions: {
				validation: (value: string) => self.validateUsername(value, userNameOption.isRequired) ? ({ type: MessageType.ERROR, content: userNameOption.displayName + errorMessage }) : null
			}
		});

		let passwordOption = this._optionsMaps[ConnectionOptionSpecialType.password];
		let passwordBuilder = DialogHelper.appendRow(this._tableContainer, passwordOption.displayName, 'connection-label', 'connection-input');
		this._passwordInputBox = new InputBox(passwordBuilder.getHTMLElement(), this._contextViewService);
		this._passwordInputBox.inputElement.type = 'password';
		this._password = '';

		let rememberPasswordLabel = localize('rememberPassword', 'Remember password');
		this._rememberPasswordCheckBox = this.appendCheckbox(this._tableContainer, rememberPasswordLabel, 'connection-checkbox', 'connection-input', false);

		let databaseOption = this._optionsMaps[ConnectionOptionSpecialType.databaseName];
		let databaseNameBuilder = DialogHelper.appendRow(this._tableContainer, databaseOption.displayName, 'connection-label', 'connection-input');

		this._databaseNameInputBox = new Dropdown(databaseNameBuilder.getHTMLElement(), this._contextViewService, this._themeService, {
			values: [this._defaultDatabaseName, this._loadingDatabaseName],
			strictSelection : false,
			placeholder: this._defaultDatabaseName,
			maxHeight: 125
		});

		let serverGroupLabel = localize('serverGroup', 'Server group');
		let serverGroupBuilder = DialogHelper.appendRow(this._tableContainer, serverGroupLabel, 'connection-label', 'connection-input');
		DialogHelper.appendInputSelectBox(serverGroupBuilder, this._serverGroupSelectBox);

		let AdvancedLabel = localize('advanced', 'Advanced...');
		this._advancedButton = this.createAdvancedButton(this._tableContainer, AdvancedLabel);
	}

	private validateUsername(value: string, isOptionRequired: boolean): boolean {
		let currentAuthType = this._authTypeSelectBox ? this.getMatchingAuthType(this._authTypeSelectBox.value) : undefined;
		if (!currentAuthType || currentAuthType.showUsernameAndPassword) {
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
					button = new Button(divContainer);
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

	private appendCheckbox(container: Builder, label: string, checkboxClass: string, cellContainerClass: string, isChecked: boolean): Checkbox {
		let checkbox: Checkbox;
		container.element('tr', {}, (rowContainer) => {
			rowContainer.element('td');
			rowContainer.element('td', { class: cellContainerClass }, (inputCellContainer) => {
				checkbox = new Checkbox(inputCellContainer.getHTMLElement(), { label, checked: isChecked });
			});
		});
		return checkbox;
	}

	private registerListeners(): void {
		// Theme styler
		this._toDispose.push(attachInputBoxStyler(this._serverNameInputBox, this._themeService));
		this._toDispose.push(attachEditableDropdownStyler(this._databaseNameInputBox, this._themeService));
		this._toDispose.push(attachInputBoxStyler(this._userNameInputBox, this._themeService));
		this._toDispose.push(attachInputBoxStyler(this._passwordInputBox, this._themeService));
		this._toDispose.push(styler.attachSelectBoxStyler(this._serverGroupSelectBox, this._themeService));
		this._toDispose.push(attachButtonStyler(this._advancedButton, this._themeService));

		if (this._authTypeSelectBox) {
			// Theme styler
			this._toDispose.push(styler.attachSelectBoxStyler(this._authTypeSelectBox, this._themeService));
			this._toDispose.push(this._authTypeSelectBox.onDidSelect(selectedAuthType => {
				this.onAuthTypeSelected(selectedAuthType.selected);
				this.setConnectButton();
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
			if (this.serverName) {
				this._databaseNameInputBox.values = [this._loadingDatabaseName];
				this._callbacks.onFetchDatabases(this.serverName, this.authenticationType, this.userName, this._password).then(databases => {
					if (databases) {
						this._databaseNameInputBox.values = databases;
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
		let authDisplayName: string = this.getAuthTypeDisplayName(this.authenticationType);
		let authType: AuthenticationType = this.getMatchingAuthType(authDisplayName);
		let showUsernameAndPassword: boolean = true;
		if (authType) {
			showUsernameAndPassword = authType.showUsernameAndPassword;
		}
		showUsernameAndPassword ? this._callbacks.onSetConnectButton(!!this.serverName && !!this.userName) :
			this._callbacks.onSetConnectButton(!!this.serverName);
	}

	private onAuthTypeSelected(selectedAuthType: string) {
		let currentAuthType = this.getMatchingAuthType(selectedAuthType);
		if (!currentAuthType.showUsernameAndPassword) {
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
		this._serverNameInputBox.focus();
	}

	private getModelValue(value: string): string {
		return value ? value : '';
	}

	public fillInConnectionInputs(connectionInfo: IConnectionProfile) {
		if (connectionInfo) {
			this._serverNameInputBox.value = this.getModelValue(connectionInfo.serverName);
			this._databaseNameInputBox.value = this.getModelValue(connectionInfo.databaseName);
			this._userNameInputBox.value = this.getModelValue(connectionInfo.userName);
			this._passwordInputBox.value = connectionInfo.password ? Constants.passwordChars : '';
			this._password = this.getModelValue(connectionInfo.password);
			this._saveProfile = connectionInfo.saveProfile;
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

			}
			// Disable connect button if -
			// 1. Authentication type is SQL Login and no username is provided
			// 2. No server name is provided
			this.setConnectButton();
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
		this._rememberPasswordCheckBox.enabled = false;
		if (this._authTypeSelectBox) {
			this._authTypeSelectBox.disable();
		}
	}

	public handleResetConnection(): void {
		this._advancedButton.enabled = true;

		this._serverGroupSelectBox.enable();
		this._serverNameInputBox.enable();
		this._databaseNameInputBox.enabled = true;
		let currentAuthType: AuthenticationType = undefined;
		if (this._authTypeSelectBox) {
			this._authTypeSelectBox.enable();
			currentAuthType = this.getMatchingAuthType(this._authTypeSelectBox.value);
		}

		if (!currentAuthType || currentAuthType.showUsernameAndPassword) {
			this._userNameInputBox.enable();
			this._passwordInputBox.enable();
			this._rememberPasswordCheckBox.enabled = true;
		}

		if (this._focusedBeforeHandleOnConnection) {
			this._focusedBeforeHandleOnConnection.focus();
		}
	}

	public get serverName(): string {
		return this._serverNameInputBox.value;
	}

	public get databaseName(): string {
		return this._databaseNameInputBox.value;
	}

	public get userName(): string {
		return this._userNameInputBox.value;
	}

	public get password(): string {
		return this._password;
	}

	public get authenticationType(): string {
		return this._authTypeSelectBox ? this.getAuthTypeName(this._authTypeSelectBox.value) : undefined;
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
		return validateServerName && validateUserName && validatePassword;
	}

	public connect(model: IConnectionProfile): boolean {
		let validInputs = this.validateInputs();
		if (validInputs) {
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
		return authType ? authType.find(authType => this.getAuthTypeDisplayName(authType.name) === displayName) : undefined;
	}
}

class AuthenticationType {
	public name: string;
	public showUsernameAndPassword: boolean;

	constructor(name: string, showUsernameAndPassword: boolean) {
		this.name = name;
		this.showUsernameAndPassword = showUsernameAndPassword;
	}
}