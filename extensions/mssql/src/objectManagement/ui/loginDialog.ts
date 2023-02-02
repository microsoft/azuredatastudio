/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { DefaultInputWidth, ObjectManagementDialogBase } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { NodeType } from '../constants';

export class LoginDialog extends ObjectManagementDialogBase {
	private dialogInfo: ObjectManagement.LoginViewInfo;
	private formContainer: azdata.DivContainer;
	private generalGroup: azdata.GroupContainer;
	private sqlAuthGroup: azdata.GroupContainer;
	private advancedGroup: azdata.GroupContainer;
	private nameInput: azdata.InputBoxComponent;
	private authTypeDropdown: azdata.DropDownComponent;
	private passwordInput: azdata.InputBoxComponent;
	private confirmPasswordInput: azdata.InputBoxComponent;
	private specifyOldPasswordCheckbox: azdata.CheckBoxComponent;
	private oldPasswordInput: azdata.InputBoxComponent;
	private enforcePasswordPolicyCheckbox: azdata.CheckBoxComponent;
	private enforcePasswordExpirationCheckbox: azdata.CheckBoxComponent;
	private changePasswordCheckbox: azdata.CheckBoxComponent;
	private defaultDatabaseDropdown: azdata.DropDownComponent;
	private defaultLanguageDropdown: azdata.DropDownComponent;
	// private serverRolesList: azdata.ListBoxComponent;
	private connectPermissionCheckbox: azdata.CheckBoxComponent;
	private enabledCheckbox: azdata.CheckBoxComponent;
	private lockedOutCheckbox: azdata.CheckBoxComponent;

	constructor(objectManagementService: IObjectManagementService, connectionUri: string, isNewObject: boolean, name?: string) {
		super(NodeType.Login, objectManagementService, connectionUri, isNewObject, name);
	}

	protected override async onConfirmation(): Promise<boolean> {
		if (!this.passwordInput.value) {
			const result = await vscode.window.showWarningMessage(localizedConstants.BlankPasswordConfirmationText, { modal: true }, localizedConstants.YesText);
			return result === localizedConstants.YesText;
		}
		return true;
	}

	protected getFinalObjectName(): string {
		return this.nameInput?.value;
	}

	protected async validate(): Promise<string[]> {
		const errors: string[] = [];
		if (!this.nameInput.value) {
			errors.push(localizedConstants.NameCannotBeEmptyError);
		}

		if (this.passwordInput.value !== this.confirmPasswordInput.value) {
			errors.push(localizedConstants.PasswordsNotMatchError);
		}

		if (this.specifyOldPasswordCheckbox.checked && !this.oldPasswordInput.value) {
			errors.push(localizedConstants.OldPasswordCannotBeEmptyError);
		}
		return errors;
	}

	protected async onComplete(): Promise<void> {
		this.dialogInfo.login.name = this.nameInput.value;
		this.dialogInfo.login.authenticationType = this.getAuthenticationType(<string>this.authTypeDropdown.value);
		this.dialogInfo.login.password = this.passwordInput.value;
		this.dialogInfo.login.oldPassword = this.oldPasswordInput.value;
		this.dialogInfo.login.enforcePasswordExpiration = this.enforcePasswordExpirationCheckbox.checked;
		this.dialogInfo.login.enforcePasswordPolicy = this.enforcePasswordPolicyCheckbox.checked;
		this.dialogInfo.login.mustChangePassword = this.changePasswordCheckbox.checked;
		this.dialogInfo.login.defaultDatabase = <string>this.defaultDatabaseDropdown.value;
		this.dialogInfo.login.defaultLanguage = <string>this.defaultLanguageDropdown.value;
		this.dialogInfo.login.isLockedOut = this.lockedOutCheckbox.checked;
		this.dialogInfo.login.connectPermission = this.connectPermissionCheckbox.checked;
		this.dialogInfo.login.isEnabled = this.enabledCheckbox.checked;
		if (this.isNewObject) {
			await this.objectManagementService.createLogin(this.contextId, this.dialogInfo.login);
		} else {
			await this.objectManagementService.updateLogin(this.contextId, this.dialogInfo.login);
		}
	}

	protected async onDispose(): Promise<void> {
		await this.objectManagementService.disposeLoginView(this.contextId);
	}

	protected async initialize(): Promise<void> {
		this.dialogInfo = await this.objectManagementService.initializeLoginView(this.connectionUri, this.contextId, this.isNewObject, this.objectName);
		const tab = azdata.window.createTab('');
		tab.registerContent(async view => {
			// General Group
			this.nameInput = view.modelBuilder.inputBox().withProps({
				ariaLabel: localizedConstants.ObjectNameLabel,
				enabled: this.isNewObject,
				value: this.dialogInfo.login.name,
				required: this.dialogInfo.canEditName,
				width: DefaultInputWidth
			}).component();

			const nameContainer = this.createLabelInputContainer(view, localizedConstants.ObjectNameLabel, this.nameInput);
			const authTypes = [];
			if (this.dialogInfo.supportWindowsAuthentication) {
				authTypes.push(localizedConstants.WindowsAuthenticationTypeDisplayText);
			}
			if (this.dialogInfo.supportSQLAuthentication) {
				authTypes.push(localizedConstants.SQLAuthenticationTypeDisplayText);
			}
			if (this.dialogInfo.supportAADAuthentication) {
				authTypes.push(localizedConstants.AADAuthenticationTypeDisplayText);
			}
			this.authTypeDropdown = view.modelBuilder.dropDown().withProps({
				ariaLabel: localizedConstants.AuthTypeText,
				values: authTypes,
				value: this.getAuthenticationTypeDisplayValue(this.dialogInfo.login.authenticationType),
				width: DefaultInputWidth,
				enabled: this.isNewObject
			}).component();

			const typeContainer = this.createLabelInputContainer(view, localizedConstants.AuthTypeText, this.authTypeDropdown);
			this.generalGroup = this.createGroup(view, localizedConstants.GeneralSectionHeader, [nameContainer, typeContainer], false);

			// SQL Authentication Group
			this.passwordInput = this.createPasswordInputBox(view, localizedConstants.PasswordText, this.dialogInfo.login.password ?? '');
			const passwordRow = this.createLabelInputContainer(view, localizedConstants.PasswordText, this.passwordInput);
			this.confirmPasswordInput = this.createPasswordInputBox(view, localizedConstants.ConfirmPasswordText, this.dialogInfo.login.password ?? '');
			const confirmPasswordRow = this.createLabelInputContainer(view, localizedConstants.ConfirmPasswordText, this.confirmPasswordInput);
			this.specifyOldPasswordCheckbox = this.createCheckbox(view, localizedConstants.SpecifyOldPasswordText);
			this.oldPasswordInput = this.createPasswordInputBox(view, localizedConstants.OldPasswordText, '', false);
			const oldPasswordRow = this.createLabelInputContainer(view, localizedConstants.OldPasswordText, this.oldPasswordInput);
			this.enforcePasswordPolicyCheckbox = this.createCheckbox(view, localizedConstants.EnforcePasswordPolicyText, this.dialogInfo.login.enforcePasswordPolicy);
			this.enforcePasswordExpirationCheckbox = this.createCheckbox(view, localizedConstants.EnforcePasswordExpirationText, this.dialogInfo.login.enforcePasswordPolicy);
			this.changePasswordCheckbox = this.createCheckbox(view, localizedConstants.MustChangePasswordText, this.dialogInfo.login.mustChangePassword);

			const sqlAuthGroupItems: azdata.Component[] = [passwordRow, confirmPasswordRow];
			if (!this.isNewObject) {
				sqlAuthGroupItems.push(this.specifyOldPasswordCheckbox, oldPasswordRow);
			}

			if (this.dialogInfo.supportPasswordPolicy) {
				sqlAuthGroupItems.push(this.enforcePasswordPolicyCheckbox,
					this.enforcePasswordExpirationCheckbox,
					this.changePasswordCheckbox);
			}
			this.sqlAuthGroup = view.modelBuilder.groupContainer().withLayout({
				header: localizedConstants.SQLAuthenticationSectionHeader,
				collapsible: true,
				collapsed: false
			}).withItems(sqlAuthGroupItems).component();

			// Advanced Group
			this.defaultDatabaseDropdown = view.modelBuilder.dropDown().withProps({
				ariaLabel: localizedConstants.DefaultDatabaseText,
				values: this.dialogInfo.databases,
				value: this.dialogInfo.login.defaultDatabase,
				width: DefaultInputWidth
			}).component();
			const defaultDatabaseContainer = this.createLabelInputContainer(view, localizedConstants.DefaultDatabaseText, this.defaultDatabaseDropdown);
			this.defaultLanguageDropdown = view.modelBuilder.dropDown().withProps({
				ariaLabel: localizedConstants.DefaultLanguageText,
				values: this.dialogInfo.languages,
				value: this.dialogInfo.login.defaultLanguage,
				width: DefaultInputWidth
			}).component();
			const defaultLanguageContainer = this.createLabelInputContainer(view, localizedConstants.DefaultLanguageText, this.defaultLanguageDropdown);

			this.connectPermissionCheckbox = this.createCheckbox(view, localizedConstants.PermissionToConnectText, this.dialogInfo.login.connectPermission);
			this.enabledCheckbox = this.createCheckbox(view, localizedConstants.EnabledText, this.dialogInfo.login.isEnabled);
			this.lockedOutCheckbox = this.createCheckbox(view, localizedConstants.LoginLockedOutText, this.dialogInfo.login.isLockedOut, this.dialogInfo.canEditLockedOutState);
			this.advancedGroup = view.modelBuilder.groupContainer().withLayout({
				header: localizedConstants.AdvancedSectionHeader,
				collapsed: false,
				collapsible: true
			}).withItems([
				defaultDatabaseContainer,
				defaultLanguageContainer,
				this.connectPermissionCheckbox,
				this.enabledCheckbox,
				this.lockedOutCheckbox
			]).component();
			this.setupEventHandlers();
			const groups = this.dialogInfo.login.authenticationType === 'Sql' ? [this.generalGroup, this.sqlAuthGroup, this.advancedGroup] : [this.generalGroup, this.advancedGroup];
			this.formContainer = this.createFormContainer(view, groups);
			return view.initializeModel(this.formContainer)
		});
		this.dialogObject.content = [tab];
	}

	private setupEventHandlers(): void {
		this.authTypeDropdown.onValueChanged(() => {
			this.setViewByAuthenticationType();
		});

		this.nameInput.onTextChanged(async () => {
			await this.runValidation(false);
		});

		this.passwordInput.onTextChanged(async () => {
			await this.runValidation(false);
		});

		this.confirmPasswordInput.onTextChanged(async () => {
			await this.runValidation(false);
		});

		this.specifyOldPasswordCheckbox.onChanged(async () => {
			this.oldPasswordInput.enabled = this.specifyOldPasswordCheckbox.checked;
			await this.runValidation(false);
		});

		this.oldPasswordInput.onTextChanged(async () => {
			await this.runValidation(false);
		});

		this.enforcePasswordPolicyCheckbox.onChanged(() => {
			const enforcePolicy = this.enforcePasswordPolicyCheckbox.checked;
			this.enforcePasswordExpirationCheckbox.enabled = enforcePolicy;
			this.changePasswordCheckbox.enabled = enforcePolicy;
			this.enforcePasswordExpirationCheckbox.checked = enforcePolicy;
			this.changePasswordCheckbox.checked = enforcePolicy;
		});

		this.enforcePasswordExpirationCheckbox.onChanged(() => {
			const enforceExpiration = this.enforcePasswordExpirationCheckbox.checked;
			this.changePasswordCheckbox.enabled = enforceExpiration;
			this.changePasswordCheckbox.checked = enforceExpiration;
		});
	}

	private setViewByAuthenticationType(): void {
		if (this.authTypeDropdown.value === localizedConstants.SQLAuthenticationTypeDisplayText && this.formContainer.items.indexOf(this.sqlAuthGroup) === -1) {
			this.formContainer.insertItem(this.sqlAuthGroup, 1);
		} else if (this.authTypeDropdown.value !== localizedConstants.SQLAuthenticationTypeDisplayText && this.formContainer.items.indexOf(this.sqlAuthGroup) !== -1) {
			this.formContainer.removeItem(this.sqlAuthGroup);
		}
	}

	private getAuthenticationTypeDisplayValue(authType: ObjectManagement.LoginAuthenticationType): string {
		switch (authType) {
			case 'Windows':
				return localizedConstants.WindowsAuthenticationTypeDisplayText;
			case 'Sql':
				return localizedConstants.SQLAuthenticationTypeDisplayText;
			case 'AAD':
				return localizedConstants.AADAuthenticationTypeDisplayText;
			default:
				throw new Error(`Unknown authentication type: ${authType}`);
		}
	}
	private getAuthenticationType(displayValue: string): ObjectManagement.LoginAuthenticationType {
		switch (displayValue) {
			case localizedConstants.WindowsAuthenticationTypeDisplayText:
				return 'Windows';
			case localizedConstants.SQLAuthenticationTypeDisplayText:
				return 'Sql';
			case localizedConstants.AADAuthenticationTypeDisplayText:
				return 'AAD';
			default:
				throw new Error(`Unknown authentication type display value: ${displayValue}`);
		}
	}
}
