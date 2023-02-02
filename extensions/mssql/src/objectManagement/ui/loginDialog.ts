/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { DefaultInputWidth, DefaultTableWidth, GetTableHeight, ObjectManagementDialogBase } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { NodeType, PublicServerRoleName } from '../constants';

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

	protected async validate(): Promise<string[]> {
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
		this.dialogInfo.login.name = this.nameInput.value;
		this.dialogInfo.login.authenticationType = this.getAuthenticationType(<string>this.authTypeDropdown.value);
		if (this.passwordInput) {
			this.dialogInfo.login.password = this.passwordInput.value;
		}
		if (this.oldPasswordInput) {
			this.dialogInfo.login.oldPassword = this.oldPasswordInput.value;
		}
		if (this.enforcePasswordPolicyCheckbox) {
			this.dialogInfo.login.enforcePasswordExpiration = this.enforcePasswordExpirationCheckbox.checked;
			this.dialogInfo.login.enforcePasswordPolicy = this.enforcePasswordPolicyCheckbox.checked;
			this.dialogInfo.login.mustChangePassword = this.mustChangePasswordCheckbox.checked;
		}
		if (this.defaultDatabaseDropdown) {
			this.dialogInfo.login.defaultDatabase = <string>this.defaultDatabaseDropdown.value;
			this.dialogInfo.login.defaultLanguage = <string>this.defaultLanguageDropdown.value;
		}
		if (this.lockedOutCheckbox) {
			this.dialogInfo.login.isLockedOut = this.lockedOutCheckbox.checked;
		}
		if (this.connectPermissionCheckbox) {
			this.dialogInfo.login.connectPermission = this.connectPermissionCheckbox.checked;
		}
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
			value: this.getAuthenticationTypeDisplayValue(this.dialogInfo.login.authenticationType),
			width: DefaultInputWidth,
			enabled: this.isNewObject
		}).component();

		this.authTypeDropdown.onValueChanged(() => {
			this.setViewByAuthenticationType();
		});

		this.nameInput.onTextChanged(async () => {
			await this.runValidation(false);
		});

		const typeContainer = this.createLabelInputContainer(view, localizedConstants.AuthTypeText, this.authTypeDropdown);
		this.enabledCheckbox = this.createCheckbox(view, localizedConstants.EnabledText, this.dialogInfo.login.isEnabled);
		this.generalSection = this.createGroup(view, localizedConstants.GeneralSectionHeader, [nameContainer, typeContainer, this.enabledCheckbox], false);
	}

	private initializeSqlAuthSection(view: azdata.ModelView): void {
		const items: azdata.Component[] = [];
		this.passwordInput = this.createPasswordInputBox(view, localizedConstants.PasswordText, this.dialogInfo.login.password ?? '');
		const passwordRow = this.createLabelInputContainer(view, localizedConstants.PasswordText, this.passwordInput);
		this.confirmPasswordInput = this.createPasswordInputBox(view, localizedConstants.ConfirmPasswordText, this.dialogInfo.login.password ?? '');
		this.passwordInput.onTextChanged(async () => {
			await this.runValidation(false);
		});
		this.confirmPasswordInput.onTextChanged(async () => {
			await this.runValidation(false);
		});
		const confirmPasswordRow = this.createLabelInputContainer(view, localizedConstants.ConfirmPasswordText, this.confirmPasswordInput);
		items.push(passwordRow, confirmPasswordRow);
		if (!this.isNewObject) {
			this.specifyOldPasswordCheckbox = this.createCheckbox(view, localizedConstants.SpecifyOldPasswordText);
			this.oldPasswordInput = this.createPasswordInputBox(view, localizedConstants.OldPasswordText, '', false);
			const oldPasswordRow = this.createLabelInputContainer(view, localizedConstants.OldPasswordText, this.oldPasswordInput);
			this.specifyOldPasswordCheckbox.onChanged(async () => {
				this.oldPasswordInput.enabled = this.specifyOldPasswordCheckbox.checked;
				await this.runValidation(false);
			});
			this.oldPasswordInput.onTextChanged(async () => {
				await this.runValidation(false);
			});
			items.push(this.specifyOldPasswordCheckbox, oldPasswordRow);
		}

		if (this.dialogInfo.supportAdvancedPasswordOptions) {
			this.enforcePasswordPolicyCheckbox = this.createCheckbox(view, localizedConstants.EnforcePasswordPolicyText, this.dialogInfo.login.enforcePasswordPolicy);
			this.enforcePasswordExpirationCheckbox = this.createCheckbox(view, localizedConstants.EnforcePasswordExpirationText, this.dialogInfo.login.enforcePasswordPolicy);
			this.mustChangePasswordCheckbox = this.createCheckbox(view, localizedConstants.MustChangePasswordText, this.dialogInfo.login.mustChangePassword);
			this.enforcePasswordPolicyCheckbox.onChanged(() => {
				const enforcePolicy = this.enforcePasswordPolicyCheckbox.checked;
				this.enforcePasswordExpirationCheckbox.enabled = enforcePolicy;
				this.mustChangePasswordCheckbox.enabled = enforcePolicy;
				this.enforcePasswordExpirationCheckbox.checked = enforcePolicy;
				this.mustChangePasswordCheckbox.checked = enforcePolicy;
			});
			this.enforcePasswordExpirationCheckbox.onChanged(() => {
				const enforceExpiration = this.enforcePasswordExpirationCheckbox.checked;
				this.mustChangePasswordCheckbox.enabled = enforceExpiration;
				this.mustChangePasswordCheckbox.checked = enforceExpiration;
			});
			items.push(this.enforcePasswordPolicyCheckbox, this.enforcePasswordExpirationCheckbox, this.mustChangePasswordCheckbox);
			if (!this.isNewObject) {
				this.lockedOutCheckbox = this.createCheckbox(view, localizedConstants.LoginLockedOutText, this.dialogInfo.login.isLockedOut, this.dialogInfo.canEditLockedOutState);
				items.push(this.lockedOutCheckbox);
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
			this.defaultLanguageDropdown = view.modelBuilder.dropDown().withProps({
				ariaLabel: localizedConstants.DefaultLanguageText,
				values: this.dialogInfo.languages,
				value: this.dialogInfo.login.defaultLanguage,
				width: DefaultInputWidth
			}).component();
			const defaultLanguageContainer = this.createLabelInputContainer(view, localizedConstants.DefaultLanguageText, this.defaultLanguageDropdown);
			this.connectPermissionCheckbox = this.createCheckbox(view, localizedConstants.PermissionToConnectText, this.dialogInfo.login.connectPermission);
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
		this.serverRoleTable = view.modelBuilder.table().withProps(
			{
				ariaLabel: localizedConstants.ServerRoleSectionHeader,
				data: serverRolesData,
				columns: [
					{
						value: localizedConstants.SelectedText,
						type: azdata.ColumnType.checkBox,
						options: { actionOnCheckbox: azdata.ActionOnCellCheckboxCheck.customAction }
					}, {
						value: localizedConstants.NameText,
					}
				],
				width: DefaultTableWidth,
				height: GetTableHeight(this.dialogInfo.serverRoles.length)
			}
		).component();
		this.serverRoleTable.onCellAction((arg: azdata.ICheckboxCellActionEventArgs) => {
			const serverRoleName = this.dialogInfo.serverRoles[arg.row];
			const idx = this.dialogInfo.login.serverRoles.indexOf(serverRoleName);
			if (arg.checked && idx === -1) {
				this.dialogInfo.login.serverRoles.push(serverRoleName);
			} else if (!arg.checked && idx !== -1) {
				this.dialogInfo.login.serverRoles.splice(idx, 1)
			}
		});
		this.serverRoleSection = this.createGroup(view, localizedConstants.ServerRoleSectionHeader, [this.serverRoleTable]);
	}

	private setViewByAuthenticationType(): void {
		if (this.authTypeDropdown.value === localizedConstants.SQLAuthenticationTypeDisplayText && this.formContainer.items.indexOf(this.sqlAuthSection) === -1) {
			this.formContainer.insertItem(this.sqlAuthSection, 1);
		} else if (this.authTypeDropdown.value !== localizedConstants.SQLAuthenticationTypeDisplayText && this.formContainer.items.indexOf(this.sqlAuthSection) !== -1) {
			this.formContainer.removeItem(this.sqlAuthSection);
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
