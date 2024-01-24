/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService } from 'mssql';
import * as objectManagementLoc from '../localizedConstants';
import * as uiLoc from '../../ui/localizedConstants';
import { AlterLoginDocUrl, CreateLoginDocUrl, PublicServerRoleName } from '../constants';
import { isValidSQLPassword } from '../utils';
import { DefaultMaxTableRowCount } from '../../ui/dialogBase';
import { PrincipalDialogBase } from './principalDialogBase';
import { AuthenticationType, Login, LoginViewInfo } from '../interfaces';
import { isUndefinedOrNull } from '../../types';

export class LoginDialog extends PrincipalDialogBase<Login, LoginViewInfo> {
	private generalSection: azdata.GroupContainer;
	private sqlAuthSection: azdata.GroupContainer;
	private serverRoleSection: azdata.GroupContainer;
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
	private serverRoleTable: azdata.DeclarativeTableComponent;
	private connectPermissionCheckbox: azdata.CheckBoxComponent;
	private enabledCheckbox: azdata.CheckBoxComponent;
	private lockedOutCheckbox: azdata.CheckBoxComponent;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, { ...options, isDatabaseLevelPrincipal: false, supportEffectivePermissions: true });
	}

	protected override get helpUrl(): string {
		return this.options.isNewObject ? CreateLoginDocUrl : AlterLoginDocUrl
	}

	protected override async onConfirmation(): Promise<boolean> {
		// Empty password is only allowed when advanced password options are supported and the password policy check is off.
		// To match the SSMS behavior, a warning is shown to the user.
		if (this.viewInfo.supportAdvancedPasswordOptions
			&& this.objectInfo.authenticationType === AuthenticationType.Sql
			&& !this.objectInfo.password
			&& !this.objectInfo.enforcePasswordPolicy) {
			const result = await vscode.window.showWarningMessage(objectManagementLoc.BlankPasswordConfirmationText, { modal: true }, uiLoc.YesText);
			return result === uiLoc.YesText;
		}
		return true;
	}

	protected override async validateInput(): Promise<string[]> {
		const errors = await super.validateInput();
		if (this.objectInfo.authenticationType === AuthenticationType.Sql) {
			if (!this.objectInfo.password && !(this.viewInfo.supportAdvancedPasswordOptions && !this.objectInfo.enforcePasswordPolicy)) {
				errors.push(objectManagementLoc.PasswordCannotBeEmptyError);
			}

			if (this.objectInfo.password && (this.objectInfo.enforcePasswordPolicy || !this.viewInfo.supportAdvancedPasswordOptions)
				&& !isValidSQLPassword(this.objectInfo.password, this.objectInfo.name)
				&& (this.options.isNewObject || this.isPasswordChanged())) {
				errors.push(objectManagementLoc.InvalidPasswordError);
			}

			if (this.objectInfo.password !== this.confirmPasswordInput.value) {
				errors.push(objectManagementLoc.PasswordsNotMatchError);
			}

			if (this.specifyOldPasswordCheckbox?.checked && !this.objectInfo.oldPassword) {
				errors.push(objectManagementLoc.OldPasswordCannotBeEmptyError);
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
		if (this.options.isNewObject || !isUndefinedOrNull(this.objectInfo.securablePermissions)) {
			sections.push(this.securableSection);
		}

		this.formContainer.addItems(sections, this.getSectionItemLayout());
	}

	private initializeGeneralSection(): void {
		const items: azdata.Component[] = [];
		this.nameInput = this.createInputBox(async (newValue) => {
			this.objectInfo.name = newValue;
		}, {
			ariaLabel: objectManagementLoc.NameText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.name
		});
		const nameContainer = this.createLabelInputContainer(objectManagementLoc.NameText, this.nameInput);
		items.push(nameContainer);

		this.authTypeDropdown = this.createDropdown(objectManagementLoc.AuthTypeText,
			async (newValue) => {
				this.objectInfo.authenticationType = objectManagementLoc.getAuthenticationTypeByDisplayName(newValue);
				this.setViewByAuthenticationType();
			},
			this.viewInfo.authenticationTypes.map(authType => objectManagementLoc.getAuthenticationTypeDisplayName(authType)),
			objectManagementLoc.getAuthenticationTypeDisplayName(this.objectInfo.authenticationType),
			this.options.isNewObject);
		const authTypeContainer = this.createLabelInputContainer(objectManagementLoc.AuthTypeText, this.authTypeDropdown);
		items.push(authTypeContainer);

		this.enabledCheckbox = this.createCheckbox(objectManagementLoc.EnabledText, async (checked) => {
			this.objectInfo.isEnabled = checked;
		}, this.objectInfo.isEnabled);
		items.push(this.enabledCheckbox);

		if (this.viewInfo.supportAdvancedOptions) {
			this.defaultDatabaseDropdown = this.createDropdown(objectManagementLoc.DefaultDatabaseText, async (newValue) => {
				this.objectInfo.defaultDatabase = newValue;
			}, this.viewInfo.databases, this.objectInfo.defaultDatabase);
			const defaultDatabaseContainer = this.createLabelInputContainer(objectManagementLoc.DefaultDatabaseText, this.defaultDatabaseDropdown);
			items.push(defaultDatabaseContainer);

			this.defaultLanguageDropdown = this.createDropdown(objectManagementLoc.DefaultLanguageText, async (newValue) => {
				this.objectInfo.defaultLanguage = newValue;
			}, this.viewInfo.languages, this.objectInfo.defaultLanguage);
			const defaultLanguageContainer = this.createLabelInputContainer(objectManagementLoc.DefaultLanguageText, this.defaultLanguageDropdown);
			items.push(defaultLanguageContainer);

			this.connectPermissionCheckbox = this.createCheckbox(objectManagementLoc.PermissionToConnectText, async (checked) => {
				this.objectInfo.connectPermission = checked;
			}, this.objectInfo.connectPermission);
			items.push(this.connectPermissionCheckbox);
		}

		this.generalSection = this.createGroup(objectManagementLoc.GeneralSectionHeader, items, false);
	}

	private initializeSqlAuthSection(): void {
		const items: azdata.Component[] = [];
		this.passwordInput = this.createPasswordInputBox(objectManagementLoc.PasswordText, async (newValue) => {
			this.objectInfo.password = newValue;
			this.mustChangePasswordCheckbox.enabled = this.objectInfo.enforcePasswordPolicy && this.isPasswordChanged();
			// this handles the case where the mustChangePasswordCheckbox is disabled when a user changes the password input and reverts the change. In that case we want to reset the check state of this checkbox to its original value instead of using the potentially dirty state set during password input changes.
			if (!this.mustChangePasswordCheckbox.enabled) {
				this.mustChangePasswordCheckbox.checked = this.objectInfo.mustChangePassword;
			}
		}, this.objectInfo.password ?? '');
		const passwordRow = this.createLabelInputContainer(objectManagementLoc.PasswordText, this.passwordInput);
		this.confirmPasswordInput = this.createPasswordInputBox(objectManagementLoc.ConfirmPasswordText, async () => { }, this.objectInfo.password ?? '');
		const confirmPasswordRow = this.createLabelInputContainer(objectManagementLoc.ConfirmPasswordText, this.confirmPasswordInput);
		items.push(passwordRow, confirmPasswordRow);

		if (!this.options.isNewObject) {
			this.specifyOldPasswordCheckbox = this.createCheckbox(objectManagementLoc.SpecifyOldPasswordText, async (checked) => {
				this.oldPasswordInput.enabled = this.specifyOldPasswordCheckbox.checked;
				this.objectInfo.oldPassword = '';
				if (!this.specifyOldPasswordCheckbox.checked) {
					this.oldPasswordInput.value = '';
				}
			});
			this.oldPasswordInput = this.createPasswordInputBox(objectManagementLoc.OldPasswordText, async (newValue) => {
				this.objectInfo.oldPassword = newValue;
			}, '', false);
			const oldPasswordRow = this.createLabelInputContainer(objectManagementLoc.OldPasswordText, this.oldPasswordInput);
			items.push(this.specifyOldPasswordCheckbox, oldPasswordRow);
		}

		if (this.viewInfo.supportAdvancedPasswordOptions) {
			this.enforcePasswordPolicyCheckbox = this.createCheckbox(objectManagementLoc.EnforcePasswordPolicyText, async (checked) => {
				const enforcePolicy = checked;
				this.objectInfo.enforcePasswordPolicy = enforcePolicy;
				this.enforcePasswordExpirationCheckbox.enabled = enforcePolicy;
				this.enforcePasswordExpirationCheckbox.checked = enforcePolicy;
				if (this.options.isNewObject || this.isPasswordChanged()) {
					this.mustChangePasswordCheckbox.enabled = enforcePolicy;
					this.mustChangePasswordCheckbox.checked = enforcePolicy;
				}
				this.mustChangePasswordCheckbox.checked = enforcePolicy && (this.options.isNewObject || this.isPasswordChanged());
			}, this.objectInfo.enforcePasswordPolicy);

			this.enforcePasswordExpirationCheckbox = this.createCheckbox(objectManagementLoc.EnforcePasswordExpirationText, async (checked) => {
				const enforceExpiration = checked;
				this.objectInfo.enforcePasswordExpiration = enforceExpiration;
				if (this.options.isNewObject || this.isPasswordChanged()) {
					this.mustChangePasswordCheckbox.enabled = enforceExpiration;
					this.mustChangePasswordCheckbox.checked = enforceExpiration;
				}
			}, this.objectInfo.enforcePasswordPolicy);

			this.mustChangePasswordCheckbox = this.createCheckbox(objectManagementLoc.MustChangePasswordText, async (checked) => {
				this.objectInfo.mustChangePassword = checked;
			}, this.objectInfo.mustChangePassword, this.options.isNewObject);

			items.push(this.enforcePasswordPolicyCheckbox, this.enforcePasswordExpirationCheckbox, this.mustChangePasswordCheckbox);

			if (!this.options.isNewObject) {
				this.lockedOutCheckbox = this.createCheckbox(objectManagementLoc.LoginLockedOutText, async (checked) => {
					this.objectInfo.isLockedOut = checked;
				}, this.objectInfo.isLockedOut, this.viewInfo.canEditLockedOutState);
				items.push(this.lockedOutCheckbox);
			}
		}

		this.sqlAuthSection = this.createGroup(objectManagementLoc.SQLAuthenticationSectionHeader, items);
	}

	private isPasswordChanged(): boolean {
		return this.objectInfo.password !== this.originalObjectInfo.password
	}

	private initializeServerRolesSection(): void {
		this.serverRoleTable = this.createDeclarativeTableList(objectManagementLoc.ServerRoleSectionHeader,
			[objectManagementLoc.ServerRoleTypeDisplayNameInTitle],
			this.viewInfo.serverRoles,
			this.objectInfo.serverRoles,
			DefaultMaxTableRowCount,
			(item) => {
				return item !== PublicServerRoleName
			});
		this.serverRoleSection = this.createGroup(objectManagementLoc.ServerRoleSectionHeader, [this.serverRoleTable]);
	}

	private setViewByAuthenticationType(): void {
		if (this.authTypeDropdown.value === objectManagementLoc.SQLAuthenticationTypeDisplayText) {
			this.addItem(this.formContainer, this.sqlAuthSection, this.getSectionItemLayout(), 1);
		} else if (this.authTypeDropdown.value !== objectManagementLoc.SQLAuthenticationTypeDisplayText) {
			this.removeItem(this.formContainer, this.sqlAuthSection);
		}
	}
}
