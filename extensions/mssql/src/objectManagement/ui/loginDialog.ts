/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { DefaultInputWidth, ObjectManagementDialogBase } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { NodeType, PublicServerRoleName } from '../constants';
import { getAuthenticationTypeByDisplayName, getAuthenticationTypeDisplayName, refreshNode } from '../utils';

// TODO:
// 1. Password validation: when advanced password options are not supported or when password policy check is on.
// 2. only allow empty password when advanced password options are supported
// 3. only submit when there are changes.

export class LoginDialog extends ObjectManagementDialogBase {
	private dialogInfo: ObjectManagement.LoginViewInfo;
	private formContainer: azdata.DivContainer;
	private generalSection: azdata.GroupContainer;
	private sqlAuthSection: azdata.GroupContainer;
	private serverRoleSection: azdata.GroupContainer;
	private advancedSection: azdata.GroupContainer;
	private nameInput: azdata.InputBoxComponent;
	private authTypeDropdown: azdata.DropDownComponent;
	private passwordInput: azdata.InputBoxComponent;
	private confirmPasswordInput: azdata.InputBoxComponent;
	private specifyOldPasswordCheckbox: azdata.CheckBoxComponent;
	private oldPasswordInput: azdata.InputBoxComponent;
	private enforcePasswordPolicyCheckbox: azdata.CheckBoxComponent;
	private enforcePasswordExpirationCheckbox: azdata.CheckBoxComponent;
	private mustChangePasswordCheckbox: azdata.CheckBoxComponent;
	private defaultDatabaseDropdown: azdata.DropDownComponent;
	private defaultLanguageDropdown: azdata.DropDownComponent;
	private serverRoleTable: azdata.TableComponent;
	private connectPermissionCheckbox: azdata.CheckBoxComponent;
	private enabledCheckbox: azdata.CheckBoxComponent;
	private lockedOutCheckbox: azdata.CheckBoxComponent;

	constructor(objectManagementService: IObjectManagementService, connectionUri: string, isNewObject: boolean, name?: string, private readonly objectExplorerContext?: azdata.ObjectExplorerContext) {
		super(NodeType.Login, objectManagementService, connectionUri, isNewObject, name);
	}

	protected override async onConfirmation(): Promise<boolean> {
		if (!this.passwordInput.value) {
			const result = await vscode.window.showWarningMessage(localizedConstants.BlankPasswordConfirmationText, { modal: true }, localizedConstants.YesText);
			return result === localizedConstants.YesText;
		}
		return true;
	}

	protected async validateInput(): Promise<string[]> {
		const errors: string[] = [];
		if (!this.nameInput.value) {
			errors.push(localizedConstants.NameCannotBeEmptyError);
		}

		if (this.passwordInput && this.passwordInput.value !== this.confirmPasswordInput.value) {
			errors.push(localizedConstants.PasswordsNotMatchError);
		}

		if (this.specifyOldPasswordCheckbox && this.specifyOldPasswordCheckbox.checked && !this.oldPasswordInput.value) {
			errors.push(localizedConstants.OldPasswordCannotBeEmptyError);
		}
		return errors;
	}

	protected async onComplete(): Promise<void> {
		if (this.isNewObject) {
			await this.objectManagementService.createLogin(this.contextId, this.dialogInfo.login);
			if (this.objectExplorerContext) {
				await refreshNode(this.objectExplorerContext);
			}
		} else {
			await this.objectManagementService.updateLogin(this.contextId, this.dialogInfo.login);
		}
	}

	protected async onDispose(): Promise<void> {
		await this.objectManagementService.disposeLoginView(this.contextId);
	}

	protected async initialize(): Promise<void> {
		this.dialogInfo = await this.objectManagementService.initializeLoginView(this.connectionUri, this.contextId, this.isNewObject, this.objectName);
		this.dialogObject.registerContent(async view => {
			const sections: azdata.Component[] = [];
			this.initializeGeneralSection(view);
			sections.push(this.generalSection);

			if (this.isNewObject || this.dialogInfo.login.authenticationType === 'Sql') {
				this.initializeSqlAuthSection(view);
				sections.push(this.sqlAuthSection);
			}

			this.initializeServerRolesSection(view);
			sections.push(this.serverRoleSection);

			if (this.dialogInfo.supportAdvancedOptions) {
				this.initializeAdvancedSection(view);
				sections.push(this.advancedSection);
			}

			this.formContainer = this.createFormContainer(view, sections);
			return view.initializeModel(this.formContainer)
		});
	}

	private initializeGeneralSection(view: azdata.ModelView): void {
		this.nameInput = view.modelBuilder.inputBox().withProps({
			ariaLabel: localizedConstants.NameText,
			enabled: this.isNewObject,
			value: this.dialogInfo.login.name,
			required: this.isNewObject,
			width: DefaultInputWidth
		}).component();
		this.nameInput.onTextChanged(() => {
			this.dialogInfo.login.name = this.nameInput.value;
		});

		const nameContainer = this.createLabelInputContainer(view, localizedConstants.NameText, this.nameInput);
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
			value: getAuthenticationTypeDisplayName(this.dialogInfo.login.authenticationType),
			width: DefaultInputWidth,
			enabled: this.isNewObject
		}).component();
		this.authTypeDropdown.onValueChanged(() => {
			this.dialogInfo.login.authenticationType = getAuthenticationTypeByDisplayName(<string>this.authTypeDropdown.value);
			this.setViewByAuthenticationType();
		});
		const authTypeContainer = this.createLabelInputContainer(view, localizedConstants.AuthTypeText, this.authTypeDropdown);

		this.enabledCheckbox = this.createCheckbox(view, localizedConstants.EnabledText, this.dialogInfo.login.isEnabled);
		this.enabledCheckbox.onChanged(() => {
			this.dialogInfo.login.isEnabled = this.enabledCheckbox.checked;
		});
		this.generalSection = this.createGroup(view, localizedConstants.GeneralSectionHeader, [nameContainer, authTypeContainer, this.enabledCheckbox], false);
	}

	private initializeSqlAuthSection(view: azdata.ModelView): void {
		const items: azdata.Component[] = [];
		this.passwordInput = this.createPasswordInputBox(view, localizedConstants.PasswordText, this.dialogInfo.login.password ?? '');
		const passwordRow = this.createLabelInputContainer(view, localizedConstants.PasswordText, this.passwordInput);
		this.confirmPasswordInput = this.createPasswordInputBox(view, localizedConstants.ConfirmPasswordText, this.dialogInfo.login.password ?? '');
		this.passwordInput.onTextChanged(() => {
			this.dialogInfo.login.password = this.passwordInput.value;
		});
		const confirmPasswordRow = this.createLabelInputContainer(view, localizedConstants.ConfirmPasswordText, this.confirmPasswordInput);
		items.push(passwordRow, confirmPasswordRow);

		if (!this.isNewObject) {
			this.specifyOldPasswordCheckbox = this.createCheckbox(view, localizedConstants.SpecifyOldPasswordText);
			this.oldPasswordInput = this.createPasswordInputBox(view, localizedConstants.OldPasswordText, '', false);
			const oldPasswordRow = this.createLabelInputContainer(view, localizedConstants.OldPasswordText, this.oldPasswordInput);
			this.specifyOldPasswordCheckbox.onChanged(() => {
				this.oldPasswordInput.enabled = this.specifyOldPasswordCheckbox.checked;
				this.dialogInfo.login.oldPassword = '';
				if (!this.specifyOldPasswordCheckbox.checked) {
					this.oldPasswordInput.value = '';
				}
			});
			this.oldPasswordInput.onTextChanged(() => {
				this.dialogInfo.login.oldPassword = this.oldPasswordInput.value;
			});
			items.push(this.specifyOldPasswordCheckbox, oldPasswordRow);
		}

		if (this.dialogInfo.supportAdvancedPasswordOptions) {
			this.enforcePasswordPolicyCheckbox = this.createCheckbox(view, localizedConstants.EnforcePasswordPolicyText, this.dialogInfo.login.enforcePasswordPolicy);
			this.enforcePasswordExpirationCheckbox = this.createCheckbox(view, localizedConstants.EnforcePasswordExpirationText, this.dialogInfo.login.enforcePasswordPolicy);
			this.mustChangePasswordCheckbox = this.createCheckbox(view, localizedConstants.MustChangePasswordText, this.dialogInfo.login.mustChangePassword);
			this.enforcePasswordPolicyCheckbox.onChanged(() => {
				const enforcePolicy = this.enforcePasswordPolicyCheckbox.checked;
				this.dialogInfo.login.enforcePasswordPolicy = enforcePolicy;
				this.enforcePasswordExpirationCheckbox.enabled = enforcePolicy;
				this.mustChangePasswordCheckbox.enabled = enforcePolicy;
				this.enforcePasswordExpirationCheckbox.checked = enforcePolicy;
				this.mustChangePasswordCheckbox.checked = enforcePolicy;
			});
			this.enforcePasswordExpirationCheckbox.onChanged(() => {
				const enforceExpiration = this.enforcePasswordExpirationCheckbox.checked;
				this.dialogInfo.login.enforcePasswordExpiration = enforceExpiration;
				this.mustChangePasswordCheckbox.enabled = enforceExpiration;
				this.mustChangePasswordCheckbox.checked = enforceExpiration;
			});
			this.mustChangePasswordCheckbox.onChanged(() => {
				this.dialogInfo.login.mustChangePassword = this.mustChangePasswordCheckbox.checked;
			});
			items.push(this.enforcePasswordPolicyCheckbox, this.enforcePasswordExpirationCheckbox, this.mustChangePasswordCheckbox);
			if (!this.isNewObject) {
				this.lockedOutCheckbox = this.createCheckbox(view, localizedConstants.LoginLockedOutText, this.dialogInfo.login.isLockedOut, this.dialogInfo.canEditLockedOutState);
				items.push(this.lockedOutCheckbox);
				this.lockedOutCheckbox.onChanged(() => {
					this.dialogInfo.login.isLockedOut = this.lockedOutCheckbox.checked;
				});
			}
		}

		this.sqlAuthSection = this.createGroup(view, localizedConstants.SQLAuthenticationSectionHeader, items);
	}

	private initializeAdvancedSection(view: azdata.ModelView): void {
		const items: azdata.Component[] = [];
		if (this.dialogInfo.supportAdvancedOptions) {
			this.defaultDatabaseDropdown = view.modelBuilder.dropDown().withProps({
				ariaLabel: localizedConstants.DefaultDatabaseText,
				values: this.dialogInfo.databases,
				value: this.dialogInfo.login.defaultDatabase,
				width: DefaultInputWidth
			}).component();
			const defaultDatabaseContainer = this.createLabelInputContainer(view, localizedConstants.DefaultDatabaseText, this.defaultDatabaseDropdown);
			this.defaultDatabaseDropdown.onValueChanged(() => {
				this.dialogInfo.login.defaultDatabase = <string>this.defaultDatabaseDropdown.value;
			});

			this.defaultLanguageDropdown = view.modelBuilder.dropDown().withProps({
				ariaLabel: localizedConstants.DefaultLanguageText,
				values: this.dialogInfo.languages,
				value: this.dialogInfo.login.defaultLanguage,
				width: DefaultInputWidth
			}).component();
			const defaultLanguageContainer = this.createLabelInputContainer(view, localizedConstants.DefaultLanguageText, this.defaultLanguageDropdown);
			this.defaultLanguageDropdown.onValueChanged(() => {
				this.dialogInfo.login.defaultLanguage = <string>this.defaultLanguageDropdown.value;
			});

			this.connectPermissionCheckbox = this.createCheckbox(view, localizedConstants.PermissionToConnectText, this.dialogInfo.login.connectPermission);
			this.connectPermissionCheckbox.onChanged(() => {
				this.dialogInfo.login.connectPermission = this.connectPermissionCheckbox.checked;
			});
			items.push(defaultDatabaseContainer, defaultLanguageContainer, this.connectPermissionCheckbox);
		}

		this.advancedSection = this.createGroup(view, localizedConstants.AdvancedSectionHeader, items);
	}

	private initializeServerRolesSection(view: azdata.ModelView): void {
		const serverRolesData = this.dialogInfo.serverRoles.map(name => {
			const isRoleSelected = this.dialogInfo.login.serverRoles.indexOf(name) !== -1;
			const isRoleSelectionEnabled = name !== PublicServerRoleName;
			return [{ enabled: isRoleSelectionEnabled, checked: isRoleSelected }, name];
		});
		this.serverRoleTable = this.createTableList(view, localizedConstants.ServerRoleSectionHeader, this.dialogInfo.serverRoles, this.dialogInfo.login.serverRoles, serverRolesData);
		this.serverRoleSection = this.createGroup(view, localizedConstants.ServerRoleSectionHeader, [this.serverRoleTable]);
	}

	private setViewByAuthenticationType(): void {
		if (this.authTypeDropdown.value === localizedConstants.SQLAuthenticationTypeDisplayText) {
			this.addItem(this.formContainer, this.sqlAuthSection, 1);
		} else if (this.authTypeDropdown.value !== localizedConstants.SQLAuthenticationTypeDisplayText) {
			this.removeItem(this.formContainer, this.sqlAuthSection);
		}
	}
}
