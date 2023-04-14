/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagementDialogBase } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { NodeType } from '../constants';

export class CreateDatabaseDialog extends ObjectManagementDialogBase<ObjectManagement.Database, ObjectManagement.CreateDatabaseViewInfo> {
	constructor(objectManagementService: IObjectManagementService, connectionUri: string, objectExplorerContext?: azdata.ObjectExplorerContext) {
		super(NodeType.Server, undefined, objectManagementService, connectionUri, true, undefined, objectExplorerContext);
	}

	protected override async onConfirmation(): Promise<boolean> {
		// if (this.viewInfo.supportAdvancedPasswordOptions
		// 	&& this.objectInfo.authenticationType === AuthenticationType.Sql
		// 	&& !this.objectInfo.password
		// 	&& !this.objectInfo.enforcePasswordPolicy) {
		// 	const result = await vscode.window.showWarningMessage(localizedConstants.BlankPasswordConfirmationText, { modal: true }, localizedConstants.YesText);
		// 	return result === localizedConstants.YesText;
		// }
		// return true;
		return false;
	}

	protected async validateInput(): Promise<string[]> {
		const errors: string[] = [];
		// if (!this.objectInfo.name) {
		// 	errors.push(localizedConstants.NameCannotBeEmptyError);
		// }
		// if (this.objectInfo.authenticationType === AuthenticationType.Sql) {
		// 	if (!this.objectInfo.password && !(this.viewInfo.supportAdvancedPasswordOptions && !this.objectInfo.enforcePasswordPolicy)) {
		// 		errors.push(localizedConstants.PasswordCannotBeEmptyError);
		// 	}

		// 	if (this.objectInfo.password && (this.objectInfo.enforcePasswordPolicy || !this.viewInfo.supportAdvancedPasswordOptions)
		// 		&& !isValidSQLPassword(this.objectInfo.password, this.objectInfo.name)
		// 		&& (this.isNewObject || this.objectInfo.password !== this.originalObjectInfo.password)) {
		// 		errors.push(localizedConstants.InvalidPasswordError);
		// 	}

		// 	if (this.objectInfo.password !== this.confirmPasswordInput.value) {
		// 		errors.push(localizedConstants.PasswordsNotMatchError);
		// 	}

		// 	if (this.specifyOldPasswordCheckbox?.checked && !this.objectInfo.oldPassword) {
		// 		errors.push(localizedConstants.OldPasswordCannotBeEmptyError);
		// 	}
		// }
		return errors;
	}

	protected async onComplete(): Promise<void> {
		// if (this.isNewObject) {
		// 	await this.objectManagementService.createLogin(this.contextId, this.objectInfo);
		// } else {
		// 	await this.objectManagementService.updateLogin(this.contextId, this.objectInfo);
		// }
	}

	protected async disposeView(): Promise<void> {
		// await this.objectManagementService.disposeLoginView(this.contextId);
	}

	protected async initializeData(): Promise<ObjectManagement.CreateDatabaseViewInfo> {
		// const viewInfo = await this.objectManagementService.initializeLoginView(this.connectionUri, this.contextId, this.isNewObject, this.objectName);
		// viewInfo.objectInfo.password = viewInfo.objectInfo.password ?? '';
		// return viewInfo;
		return undefined;
	}

	protected async initializeUI(): Promise<void> {
		const sections: azdata.Component[] = [];
		// this.initializeGeneralSection();
		// sections.push(this.generalSection);

		// if (this.isNewObject || this.objectInfo.authenticationType === 'Sql') {
		// 	this.initializeSqlAuthSection();
		// 	sections.push(this.sqlAuthSection);
		// }

		// this.initializeServerRolesSection();
		// sections.push(this.serverRoleSection);

		// if (this.viewInfo.supportAdvancedOptions) {
		// 	this.initializeAdvancedSection();
		// 	sections.push(this.advancedSection);
		// }
		this.formContainer.addItems(sections);
	}

	// private initializeGeneralSection(): void {
	// 	this.nameInput = this.modelView.modelBuilder.inputBox().withProps({
	// 		ariaLabel: localizedConstants.NameText,
	// 		enabled: this.isNewObject,
	// 		value: this.objectInfo.name,
	// 		width: DefaultInputWidth
	// 	}).component();
	// 	this.disposables.push(this.nameInput.onTextChanged(async () => {
	// 		this.objectInfo.name = this.nameInput.value!;
	// 		this.onObjectValueChange();
	// 		await this.runValidation(false);
	// 	}));

	// 	const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput);
	// 	const authTypes = [];
	// 	if (this.viewInfo.supportWindowsAuthentication) {
	// 		authTypes.push(localizedConstants.WindowsAuthenticationTypeDisplayText);
	// 	}
	// 	if (this.viewInfo.supportSQLAuthentication) {
	// 		authTypes.push(localizedConstants.SQLAuthenticationTypeDisplayText);
	// 	}
	// 	if (this.viewInfo.supportAADAuthentication) {
	// 		authTypes.push(localizedConstants.AADAuthenticationTypeDisplayText);
	// 	}
	// 	this.authTypeDropdown = this.createDropdown(localizedConstants.AuthTypeText, authTypes, getAuthenticationTypeDisplayName(this.objectInfo.authenticationType), this.isNewObject);
	// 	this.disposables.push(this.authTypeDropdown.onValueChanged(async () => {
	// 		this.objectInfo.authenticationType = getAuthenticationTypeByDisplayName(<string>this.authTypeDropdown.value);
	// 		this.setViewByAuthenticationType();
	// 		this.onObjectValueChange();
	// 		await this.runValidation(false);
	// 	}));
	// 	const authTypeContainer = this.createLabelInputContainer(localizedConstants.AuthTypeText, this.authTypeDropdown);

	// 	this.enabledCheckbox = this.createCheckbox(localizedConstants.EnabledText, this.objectInfo.isEnabled);
	// 	this.disposables.push(this.enabledCheckbox.onChanged(() => {
	// 		this.objectInfo.isEnabled = this.enabledCheckbox.checked!;
	// 		this.onObjectValueChange();
	// 	}));
	// 	this.generalSection = this.createGroup(localizedConstants.GeneralSectionHeader, [nameContainer, authTypeContainer, this.enabledCheckbox], false);
	// }

	// private initializeSqlAuthSection(): void {
	// 	const items: azdata.Component[] = [];
	// 	this.passwordInput = this.createPasswordInputBox(localizedConstants.PasswordText, this.objectInfo.password ?? '');
	// 	const passwordRow = this.createLabelInputContainer(localizedConstants.PasswordText, this.passwordInput);
	// 	this.confirmPasswordInput = this.createPasswordInputBox(localizedConstants.ConfirmPasswordText, this.objectInfo.password ?? '');
	// 	this.disposables.push(this.passwordInput.onTextChanged(async () => {
	// 		this.objectInfo.password = this.passwordInput.value;
	// 		this.onObjectValueChange();
	// 		await this.runValidation(false);
	// 	}));
	// 	this.disposables.push(this.confirmPasswordInput.onTextChanged(async () => {
	// 		await this.runValidation(false);
	// 	}));
	// 	const confirmPasswordRow = this.createLabelInputContainer(localizedConstants.ConfirmPasswordText, this.confirmPasswordInput);
	// 	items.push(passwordRow, confirmPasswordRow);

	// 	if (!this.isNewObject) {
	// 		this.specifyOldPasswordCheckbox = this.createCheckbox(localizedConstants.SpecifyOldPasswordText);
	// 		this.oldPasswordInput = this.createPasswordInputBox(localizedConstants.OldPasswordText, '', false);
	// 		const oldPasswordRow = this.createLabelInputContainer(localizedConstants.OldPasswordText, this.oldPasswordInput);
	// 		this.disposables.push(this.specifyOldPasswordCheckbox.onChanged(async () => {
	// 			this.oldPasswordInput.enabled = this.specifyOldPasswordCheckbox.checked;
	// 			this.objectInfo.oldPassword = '';
	// 			if (!this.specifyOldPasswordCheckbox.checked) {
	// 				this.oldPasswordInput.value = '';
	// 			}
	// 			this.onObjectValueChange();
	// 			await this.runValidation(false);
	// 		}));
	// 		this.disposables.push(this.oldPasswordInput.onTextChanged(async () => {
	// 			this.objectInfo.oldPassword = this.oldPasswordInput.value;
	// 			this.onObjectValueChange();
	// 			await this.runValidation(false);
	// 		}));
	// 		items.push(this.specifyOldPasswordCheckbox, oldPasswordRow);
	// 	}

	// 	if (this.viewInfo.supportAdvancedPasswordOptions) {
	// 		this.enforcePasswordPolicyCheckbox = this.createCheckbox(localizedConstants.EnforcePasswordPolicyText, this.objectInfo.enforcePasswordPolicy);
	// 		this.enforcePasswordExpirationCheckbox = this.createCheckbox(localizedConstants.EnforcePasswordExpirationText, this.objectInfo.enforcePasswordPolicy);
	// 		this.mustChangePasswordCheckbox = this.createCheckbox(localizedConstants.MustChangePasswordText, this.objectInfo.mustChangePassword);
	// 		this.disposables.push(this.enforcePasswordPolicyCheckbox.onChanged(async () => {
	// 			const enforcePolicy = this.enforcePasswordPolicyCheckbox.checked;
	// 			this.objectInfo.enforcePasswordPolicy = enforcePolicy;
	// 			this.enforcePasswordExpirationCheckbox.enabled = enforcePolicy;
	// 			this.mustChangePasswordCheckbox.enabled = enforcePolicy;
	// 			this.enforcePasswordExpirationCheckbox.checked = enforcePolicy;
	// 			this.mustChangePasswordCheckbox.checked = enforcePolicy;
	// 			this.onObjectValueChange();
	// 			await this.runValidation(false);
	// 		}));
	// 		this.disposables.push(this.enforcePasswordExpirationCheckbox.onChanged(() => {
	// 			const enforceExpiration = this.enforcePasswordExpirationCheckbox.checked;
	// 			this.objectInfo.enforcePasswordExpiration = enforceExpiration;
	// 			this.mustChangePasswordCheckbox.enabled = enforceExpiration;
	// 			this.mustChangePasswordCheckbox.checked = enforceExpiration;
	// 			this.onObjectValueChange();
	// 		}));
	// 		this.disposables.push(this.mustChangePasswordCheckbox.onChanged(() => {
	// 			this.objectInfo.mustChangePassword = this.mustChangePasswordCheckbox.checked;
	// 			this.onObjectValueChange();
	// 		}));
	// 		items.push(this.enforcePasswordPolicyCheckbox, this.enforcePasswordExpirationCheckbox, this.mustChangePasswordCheckbox);
	// 		if (!this.isNewObject) {
	// 			this.lockedOutCheckbox = this.createCheckbox(localizedConstants.LoginLockedOutText, this.objectInfo.isLockedOut, this.viewInfo.canEditLockedOutState);
	// 			items.push(this.lockedOutCheckbox);
	// 			this.disposables.push(this.lockedOutCheckbox.onChanged(() => {
	// 				this.objectInfo.isLockedOut = this.lockedOutCheckbox.checked!;
	// 				this.onObjectValueChange();
	// 			}));
	// 		}
	// 	}

	// 	this.sqlAuthSection = this.createGroup(localizedConstants.SQLAuthenticationSectionHeader, items);
	// }

	// private initializeAdvancedSection(): void {
	// 	const items: azdata.Component[] = [];
	// 	if (this.viewInfo.supportAdvancedOptions) {
	// 		this.defaultDatabaseDropdown = this.createDropdown(localizedConstants.DefaultDatabaseText, this.viewInfo.databases, this.objectInfo.defaultDatabase);
	// 		const defaultDatabaseContainer = this.createLabelInputContainer(localizedConstants.DefaultDatabaseText, this.defaultDatabaseDropdown);
	// 		this.disposables.push(this.defaultDatabaseDropdown.onValueChanged(() => {
	// 			this.objectInfo.defaultDatabase = <string>this.defaultDatabaseDropdown.value;
	// 			this.onObjectValueChange();
	// 		}));

	// 		this.defaultLanguageDropdown = this.createDropdown(localizedConstants.DefaultLanguageText, this.viewInfo.languages, this.objectInfo.defaultLanguage);
	// 		const defaultLanguageContainer = this.createLabelInputContainer(localizedConstants.DefaultLanguageText, this.defaultLanguageDropdown);
	// 		this.disposables.push(this.defaultLanguageDropdown.onValueChanged(() => {
	// 			this.objectInfo.defaultLanguage = <string>this.defaultLanguageDropdown.value;
	// 			this.onObjectValueChange();
	// 		}));

	// 		this.connectPermissionCheckbox = this.createCheckbox(localizedConstants.PermissionToConnectText, this.objectInfo.connectPermission);
	// 		this.disposables.push(this.connectPermissionCheckbox.onChanged(() => {
	// 			this.objectInfo.connectPermission = this.connectPermissionCheckbox.checked!;
	// 			this.onObjectValueChange();
	// 		}));
	// 		items.push(defaultDatabaseContainer, defaultLanguageContainer, this.connectPermissionCheckbox);
	// 	}

	// 	this.advancedSection = this.createGroup(localizedConstants.AdvancedSectionHeader, items);
	// }

	// private initializeServerRolesSection(): void {
	// 	const serverRolesData = this.viewInfo.serverRoles.map(name => {
	// 		const isRoleSelected = this.objectInfo.serverRoles.indexOf(name) !== -1;
	// 		const isRoleSelectionEnabled = name !== PublicServerRoleName;
	// 		return [{ enabled: isRoleSelectionEnabled, checked: isRoleSelected }, name];
	// 	});
	// 	this.serverRoleTable = this.createTableList(localizedConstants.ServerRoleSectionHeader, this.viewInfo.serverRoles, this.objectInfo.serverRoles, serverRolesData);
	// 	this.serverRoleSection = this.createGroup(localizedConstants.ServerRoleSectionHeader, [this.serverRoleTable]);
	// }

	// private setViewByAuthenticationType(): void {
	// 	if (this.authTypeDropdown.value === localizedConstants.SQLAuthenticationTypeDisplayText) {
	// 		this.addItem(this.formContainer, this.sqlAuthSection, 1);
	// 	} else if (this.authTypeDropdown.value !== localizedConstants.SQLAuthenticationTypeDisplayText) {
	// 		this.removeItem(this.formContainer, this.sqlAuthSection);
	// 	}
	// }
}
