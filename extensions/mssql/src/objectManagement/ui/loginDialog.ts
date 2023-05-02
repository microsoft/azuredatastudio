/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { AlterLoginDocUrl, CreateLoginDocUrl, PublicServerRoleName } from '../constants';
import { isValidSQLPassword } from '../utils';
import { DefaultMaxTableHeight } from './dialogBase';
import { PrincipalDialogBase } from './principalDialogBase';

export class LoginDialog extends PrincipalDialogBase<ObjectManagement.Login, ObjectManagement.LoginViewInfo> {
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

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options, false);
	}

	protected override get docUrl(): string {
		return this.options.isNewObject ? CreateLoginDocUrl : AlterLoginDocUrl
	}

	protected override async onConfirmation(): Promise<boolean> {
		// Empty password is only allowed when advanced password options are supported and the password policy check is off.
		// To match the SSMS behavior, a warning is shown to the user.
		if (this.viewInfo.supportAdvancedPasswordOptions
			&& this.objectInfo.authenticationType === ObjectManagement.AuthenticationType.Sql
			&& !this.objectInfo.password
			&& !this.objectInfo.enforcePasswordPolicy) {
			const result = await vscode.window.showWarningMessage(localizedConstants.BlankPasswordConfirmationText, { modal: true }, localizedConstants.YesText);
			return result === localizedConstants.YesText;
		}
		return true;
	}

	protected override async validateInput(): Promise<string[]> {
		const errors = await super.validateInput();
		if (this.objectInfo.authenticationType === ObjectManagement.AuthenticationType.Sql) {
			if (!this.objectInfo.password && !(this.viewInfo.supportAdvancedPasswordOptions && !this.objectInfo.enforcePasswordPolicy)) {
				errors.push(localizedConstants.PasswordCannotBeEmptyError);
			}

			if (this.objectInfo.password && (this.objectInfo.enforcePasswordPolicy || !this.viewInfo.supportAdvancedPasswordOptions)
				&& !isValidSQLPassword(this.objectInfo.password, this.objectInfo.name)
				&& (this.options.isNewObject || this.objectInfo.password !== this.originalObjectInfo.password)) {
				errors.push(localizedConstants.InvalidPasswordError);
			}

			if (this.objectInfo.password !== this.confirmPasswordInput.value) {
				errors.push(localizedConstants.PasswordsNotMatchError);
			}

			if (this.specifyOldPasswordCheckbox?.checked && !this.objectInfo.oldPassword) {
				errors.push(localizedConstants.OldPasswordCannotBeEmptyError);
			}
		}
		return errors;
	}

	protected override postInitializeData(): void {
		this.objectInfo.password = this.objectInfo.password ?? '';
	}

	protected override async initializeUI(): Promise<void> {
		await super.initializeUI();
		const sections: azdata.Component[] = [];
		this.initializeGeneralSection();
		sections.push(this.generalSection);

		if (this.options.isNewObject || this.objectInfo.authenticationType === 'Sql') {
			this.initializeSqlAuthSection();
			sections.push(this.sqlAuthSection);
		}

		this.initializeServerRolesSection();
		sections.push(this.serverRoleSection);
		sections.push(this.securableSection);

		if (this.viewInfo.supportAdvancedOptions) {
			this.initializeAdvancedSection();
			sections.push(this.advancedSection);
		}
		this.formContainer.addItems(sections);
	}

	private initializeGeneralSection(): void {
		this.nameInput = this.createInputBox(localizedConstants.NameText, async (newValue) => {
			this.objectInfo.name = newValue;
		}, this.objectInfo.name, this.options.isNewObject);

		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput);
		this.authTypeDropdown = this.createDropdown(localizedConstants.AuthTypeText,
			async (newValue) => {
				this.objectInfo.authenticationType = localizedConstants.getAuthenticationTypeByDisplayName(newValue);
				this.setViewByAuthenticationType();
			},
			this.viewInfo.authenticationTypes.map(authType => localizedConstants.getAuthenticationTypeDisplayName(authType)),
			localizedConstants.getAuthenticationTypeDisplayName(this.objectInfo.authenticationType),
			this.options.isNewObject);

		const authTypeContainer = this.createLabelInputContainer(localizedConstants.AuthTypeText, this.authTypeDropdown);

		this.enabledCheckbox = this.createCheckbox(localizedConstants.EnabledText, async (checked) => {
			this.objectInfo.isEnabled = checked;
		}, this.objectInfo.isEnabled);
		this.generalSection = this.createGroup(localizedConstants.GeneralSectionHeader, [nameContainer, authTypeContainer, this.enabledCheckbox], false);
	}

	private initializeSqlAuthSection(): void {
		const items: azdata.Component[] = [];
		this.passwordInput = this.createPasswordInputBox(localizedConstants.PasswordText, async (newValue) => {
			this.objectInfo.password = newValue;
		}, this.objectInfo.password ?? '');
		const passwordRow = this.createLabelInputContainer(localizedConstants.PasswordText, this.passwordInput);
		this.confirmPasswordInput = this.createPasswordInputBox(localizedConstants.ConfirmPasswordText, async () => { }, this.objectInfo.password ?? '');
		const confirmPasswordRow = this.createLabelInputContainer(localizedConstants.ConfirmPasswordText, this.confirmPasswordInput);
		items.push(passwordRow, confirmPasswordRow);

		if (!this.options.isNewObject) {
			this.specifyOldPasswordCheckbox = this.createCheckbox(localizedConstants.SpecifyOldPasswordText, async (checked) => {
				this.oldPasswordInput.enabled = this.specifyOldPasswordCheckbox.checked;
				this.objectInfo.oldPassword = '';
				if (!this.specifyOldPasswordCheckbox.checked) {
					this.oldPasswordInput.value = '';
				}
			});
			this.oldPasswordInput = this.createPasswordInputBox(localizedConstants.OldPasswordText, async (newValue) => {
				this.objectInfo.oldPassword = newValue;
			}, '', false);
			const oldPasswordRow = this.createLabelInputContainer(localizedConstants.OldPasswordText, this.oldPasswordInput);
			items.push(this.specifyOldPasswordCheckbox, oldPasswordRow);
		}

		if (this.viewInfo.supportAdvancedPasswordOptions) {
			this.enforcePasswordPolicyCheckbox = this.createCheckbox(localizedConstants.EnforcePasswordPolicyText, async (checked) => {
				const enforcePolicy = checked;
				this.objectInfo.enforcePasswordPolicy = enforcePolicy;
				this.enforcePasswordExpirationCheckbox.enabled = enforcePolicy;
				this.mustChangePasswordCheckbox.enabled = enforcePolicy;
				this.enforcePasswordExpirationCheckbox.checked = enforcePolicy;
				this.mustChangePasswordCheckbox.checked = enforcePolicy;
			}, this.objectInfo.enforcePasswordPolicy);

			this.enforcePasswordExpirationCheckbox = this.createCheckbox(localizedConstants.EnforcePasswordExpirationText, async (checked) => {
				const enforceExpiration = checked;
				this.objectInfo.enforcePasswordExpiration = enforceExpiration;
				this.mustChangePasswordCheckbox.enabled = enforceExpiration;
				this.mustChangePasswordCheckbox.checked = enforceExpiration;
			}, this.objectInfo.enforcePasswordPolicy);

			this.mustChangePasswordCheckbox = this.createCheckbox(localizedConstants.MustChangePasswordText, async (checked) => {
				this.objectInfo.mustChangePassword = checked;
			}, this.objectInfo.mustChangePassword);

			items.push(this.enforcePasswordPolicyCheckbox, this.enforcePasswordExpirationCheckbox, this.mustChangePasswordCheckbox);

			if (!this.options.isNewObject) {
				this.lockedOutCheckbox = this.createCheckbox(localizedConstants.LoginLockedOutText, async (checked) => {
					this.objectInfo.isLockedOut = checked;
				}, this.objectInfo.isLockedOut, this.viewInfo.canEditLockedOutState);
				items.push(this.lockedOutCheckbox);
			}
		}

		this.sqlAuthSection = this.createGroup(localizedConstants.SQLAuthenticationSectionHeader, items);
	}

	private initializeAdvancedSection(): void {
		const items: azdata.Component[] = [];
		if (this.viewInfo.supportAdvancedOptions) {
			this.defaultDatabaseDropdown = this.createDropdown(localizedConstants.DefaultDatabaseText, async (newValue) => {
				this.objectInfo.defaultDatabase = newValue;
			}, this.viewInfo.databases, this.objectInfo.defaultDatabase);
			const defaultDatabaseContainer = this.createLabelInputContainer(localizedConstants.DefaultDatabaseText, this.defaultDatabaseDropdown);

			this.defaultLanguageDropdown = this.createDropdown(localizedConstants.DefaultLanguageText, async (newValue) => {
				this.objectInfo.defaultLanguage = newValue;
			}, this.viewInfo.languages, this.objectInfo.defaultLanguage);
			const defaultLanguageContainer = this.createLabelInputContainer(localizedConstants.DefaultLanguageText, this.defaultLanguageDropdown);

			this.connectPermissionCheckbox = this.createCheckbox(localizedConstants.PermissionToConnectText, async (checked) => {
				this.objectInfo.connectPermission = checked;
			}, this.objectInfo.connectPermission);
			items.push(defaultDatabaseContainer, defaultLanguageContainer, this.connectPermissionCheckbox);
		}

		this.advancedSection = this.createGroup(localizedConstants.AdvancedSectionHeader, items);
	}

	private initializeServerRolesSection(): void {
		this.serverRoleTable = this.createTableList(localizedConstants.ServerRoleSectionHeader,
			[localizedConstants.ServerRoleTypeDisplayNameInTitle],
			this.viewInfo.serverRoles,
			this.objectInfo.serverRoles,
			DefaultMaxTableHeight,
			(item) => {
				return item !== PublicServerRoleName
			});
		this.serverRoleSection = this.createGroup(localizedConstants.ServerRoleSectionHeader, [this.serverRoleTable]);
	}

	private setViewByAuthenticationType(): void {
		if (this.authTypeDropdown.value === localizedConstants.SQLAuthenticationTypeDisplayText) {
			this.addItem(this.formContainer, this.sqlAuthSection, 1);
		} else if (this.authTypeDropdown.value !== localizedConstants.SQLAuthenticationTypeDisplayText) {
			this.removeItem(this.formContainer, this.sqlAuthSection);
		}
	}
}
