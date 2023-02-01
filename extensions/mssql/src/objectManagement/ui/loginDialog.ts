/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { DefaultInputWidth, DialogBase } from './dialogBase';
import * as nls from 'vscode-nls';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { BlankPasswordConfirmationText, YesText } from '../localizedConstants';
const localize = nls.loadMessageBundle();

const GeneralSectionHeader = localize('LoginDialog.GeneralSectionHeader', "General");
const SQLAuthenticationSectionHeader = localize('LoginDialog.SQLAuthenticationSectionHeader', "SQL Authentication");
const AdvancedSectionHeader = localize('LoginDialog.AdvancedSectionHeader', "Advanced");
//const ServerRoleSectionHeader = localize('LoginDialog.ServerRoleSectionHeader', "Server Roles");
const NewLoginDialogTitle = localize('LoginDialogNew.Title', 'Login - New');
function EditLoginDialogTitle(name: string): string { return localize({ key: 'LoginDialogEdit.Title', comment: ['{0} is the placeholder for the name of the login'] }, 'Login - {0}', name); }
const NameText = localize('LoginDialog.NameLabel', "Name");
const TypeText = localize('LoginDialog.Type', "Type");
const PasswordText = localize('LoginDialog.PasswordLabel', "Password");
const ConfirmPasswordText = localize('LoginDialog.ConfirmPasswordLabel', "Confirm password");
const SpecifyOldPasswordText = localize('LoginDialog.SpecifyOldPasswordLabel', "Specify old password");
const OldPasswordText = localize('LoginDialog.OldPasswordLabel', "Old password");
const EnforcePasswordPolicyText = localize('LoginDialog.EnforcePasswordPolicyLabel', "Enforce password policy");
const EnforcePasswordExpirationText = localize('LoginDialog.EnforcePasswordExpirationLabel', "Enforce password expiration");
const MustChangePasswordOnNextLoginText = localize('LoginDialog.MustChangePasswordOnNextLoginLabel', "User must change password at next login");
const DefaultDatabaseText = localize('LoginDialog.DefaultDatabaseLabel', "Default database");
const DefaultLanguageText = localize('LoginDialog.DefaultLanguageLabel', "Default language");
const PermissionToConnectText = localize('LoginDialog.PermissionToConnectLabel', "Permission to connect to database engine");
const EnabledText = localize('LoginDialog.EnabledLabel', "Enabled");
const LoginLockedOutText = localize('LoginDialog.LoginLockedOutLabel', "Login is locked out");

const WindowsAuthenticationType = localize('LoginDialog.WindowsAuthenticationType', "Windows Authentication");
const SQLAuthenticationType = localize('LoginDialog.SQLAuthenticationType', "SQL Authentication");
const AADAuthenticationType = localize('LoginDialog.AADAuthenticationType', "Azure Active Directory Authentication");

export class LoginDialog extends DialogBase {
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
		super(objectManagementService, connectionUri, isNewObject, name, isNewObject ? NewLoginDialogTitle : EditLoginDialogTitle(name), 'Login');
	}

	protected override async onConfirmation(): Promise<boolean> {
		if (!this.passwordInput.value) {
			const result = await vscode.window.showWarningMessage(BlankPasswordConfirmationText, { modal: true }, YesText);
			return result === YesText;
		}
		return true;
	}

	protected async validate(): Promise<string[]> {
		const errors: string[] = [];
		if (!this.nameInput.value) {
			errors.push(localize('loginDialog.EmptyNameError', "Name cannot be empty."));
		}

		if (this.passwordInput.value !== this.confirmPasswordInput.value) {
			errors.push(localize('loginDialog.PasswordNotMatchError', "Password must match the confirm password."));
		}

		if (this.specifyOldPasswordCheckbox.checked && !this.oldPasswordInput.value) {
			errors.push(localize('loginDialog.oldPasswordEmptyError', "Old password cannot be empty."));
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
				ariaLabel: NameText,
				enabled: this.isNewObject,
				value: this.dialogInfo.login.name,
				required: this.dialogInfo.canEditName,
				width: DefaultInputWidth
			}).component();

			const nameContainer = this.createLabelInputContainer(view, NameText, this.nameInput);
			const authTypes = [];
			if (this.dialogInfo.supportWindowsAuthentication) {
				authTypes.push(WindowsAuthenticationType);
			}
			if (this.dialogInfo.supportSQLAuthentication) {
				authTypes.push(SQLAuthenticationType);
			}
			if (this.dialogInfo.supportAADAuthentication) {
				authTypes.push(AADAuthenticationType);
			}
			this.authTypeDropdown = view.modelBuilder.dropDown().withProps({
				ariaLabel: TypeText,
				values: authTypes,
				value: this.getAuthenticationTypeDisplayValue(this.dialogInfo.login.authenticationType),
				width: DefaultInputWidth,
				enabled: this.isNewObject
			}).component();

			const typeContainer = this.createLabelInputContainer(view, TypeText, this.authTypeDropdown);
			this.generalGroup = this.createGroup(view, GeneralSectionHeader, [nameContainer, typeContainer], false);

			// SQL Authentication Group
			this.passwordInput = this.createPasswordInputBox(view, PasswordText, this.dialogInfo.login.password ?? '');
			const passwordRow = this.createLabelInputContainer(view, PasswordText, this.passwordInput);
			this.confirmPasswordInput = this.createPasswordInputBox(view, ConfirmPasswordText, this.dialogInfo.login.password ?? '');
			const confirmPasswordRow = this.createLabelInputContainer(view, ConfirmPasswordText, this.confirmPasswordInput);
			this.specifyOldPasswordCheckbox = this.createCheckbox(view, SpecifyOldPasswordText);
			this.oldPasswordInput = this.createPasswordInputBox(view, OldPasswordText, '', false);
			const oldPasswordRow = this.createLabelInputContainer(view, OldPasswordText, this.oldPasswordInput);
			this.enforcePasswordPolicyCheckbox = this.createCheckbox(view, EnforcePasswordPolicyText, this.dialogInfo.login.enforcePasswordPolicy);
			this.enforcePasswordExpirationCheckbox = this.createCheckbox(view, EnforcePasswordExpirationText, this.dialogInfo.login.enforcePasswordPolicy);
			this.changePasswordCheckbox = this.createCheckbox(view, MustChangePasswordOnNextLoginText, this.dialogInfo.login.mustChangePassword);
			const sqlAuthGroupItems = this.dialogInfo.login.name ? [passwordRow,
				confirmPasswordRow,
				this.specifyOldPasswordCheckbox,
				oldPasswordRow,
				this.enforcePasswordPolicyCheckbox,
				this.enforcePasswordExpirationCheckbox,
				this.changePasswordCheckbox] : [passwordRow,
				confirmPasswordRow,
				this.enforcePasswordPolicyCheckbox,
				this.enforcePasswordExpirationCheckbox,
				this.changePasswordCheckbox];
			this.sqlAuthGroup = view.modelBuilder.groupContainer().withLayout({
				header: SQLAuthenticationSectionHeader,
				collapsible: true,
				collapsed: false
			}).withItems(sqlAuthGroupItems).component();

			// Advanced Group
			this.defaultDatabaseDropdown = view.modelBuilder.dropDown().withProps({
				ariaLabel: DefaultDatabaseText,
				values: this.dialogInfo.databases,
				value: this.dialogInfo.login.defaultDatabase,
				width: DefaultInputWidth
			}).component();
			const defaultDatabaseContainer = this.createLabelInputContainer(view, DefaultDatabaseText, this.defaultDatabaseDropdown);
			this.defaultLanguageDropdown = view.modelBuilder.dropDown().withProps({
				ariaLabel: DefaultLanguageText,
				values: this.dialogInfo.languages,
				value: this.dialogInfo.login.defaultLanguage,
				width: DefaultInputWidth
			}).component();
			const defaultLanguageContainer = this.createLabelInputContainer(view, DefaultLanguageText, this.defaultLanguageDropdown);

			this.connectPermissionCheckbox = this.createCheckbox(view, PermissionToConnectText, this.dialogInfo.login.connectPermission);
			this.enabledCheckbox = this.createCheckbox(view, EnabledText, this.dialogInfo.login.isEnabled);
			this.lockedOutCheckbox = this.createCheckbox(view, LoginLockedOutText, this.dialogInfo.login.isLockedOut, this.dialogInfo.canEditLockedOutState);
			this.advancedGroup = view.modelBuilder.groupContainer().withLayout({
				header: AdvancedSectionHeader,
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
		if (this.authTypeDropdown.value === SQLAuthenticationType && this.formContainer.items.indexOf(this.sqlAuthGroup) === -1) {
			this.formContainer.insertItem(this.sqlAuthGroup, 1);
		} else if (this.authTypeDropdown.value !== SQLAuthenticationType && this.formContainer.items.indexOf(this.sqlAuthGroup) !== -1) {
			this.formContainer.removeItem(this.sqlAuthGroup);
		}
	}

	private getAuthenticationTypeDisplayValue(authType: ObjectManagement.LoginAuthenticationType): string {
		switch (authType) {
			case 'Windows':
				return WindowsAuthenticationType;
			case 'Sql':
				return SQLAuthenticationType;
			case 'AAD':
				return AADAuthenticationType;
			default:
				throw new Error(`Unknown authentication type: ${authType}`);
		}
	}
	private getAuthenticationType(displayValue: string): ObjectManagement.LoginAuthenticationType {
		switch (displayValue) {
			case WindowsAuthenticationType:
				return 'Windows';
			case SQLAuthenticationType:
				return 'Sql';
			case AADAuthenticationType:
				return 'AAD';
			default:
				throw new Error(`Unknown authentication type display value: ${displayValue}`);
		}
	}
}
