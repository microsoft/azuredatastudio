/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { AlterUserDocUrl, CreateUserDocUrl } from '../constants';
import { getAuthenticationTypeByDisplayName, getAuthenticationTypeDisplayName, getUserTypeByDisplayName, getUserTypeDisplayName, isValidSQLPassword } from '../utils';

export class UserDialog extends ObjectManagementDialogBase<ObjectManagement.User, ObjectManagement.UserViewInfo> {
	private generalSection: azdata.GroupContainer;
	private ownedSchemaSection: azdata.GroupContainer;
	private membershipSection: azdata.GroupContainer;
	private advancedSection: azdata.GroupContainer;
	private nameInput: azdata.InputBoxComponent;
	private typeDropdown: azdata.DropDownComponent;
	private typeContainer: azdata.FlexContainer;
	private authTypeDropdown: azdata.DropDownComponent;
	private authTypeContainer: azdata.FlexContainer;
	private loginDropdown: azdata.DropDownComponent;
	private loginContainer: azdata.FlexContainer;
	private passwordInput: azdata.InputBoxComponent;
	private passwordContainer: azdata.FlexContainer;
	private confirmPasswordInput: azdata.InputBoxComponent;
	private confirmPasswordContainer: azdata.FlexContainer;
	private defaultSchemaDropdown: azdata.DropDownComponent;
	private defaultSchemaContainer: azdata.FlexContainer;
	private defaultLanguageDropdown: azdata.DropDownComponent;
	private ownedSchemaTable: azdata.TableComponent;
	private membershipTable: azdata.TableComponent;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
	}

	protected override get docUrl(): string {
		return this.options.isNewObject ? CreateUserDocUrl : AlterUserDocUrl;
	}

	protected override postInitializeData(): void {
		this.objectInfo.password = this.objectInfo.password ?? '';
	}

	protected override async validateInput(): Promise<string[]> {
		const errors = await super.validateInput();
		if (this.objectInfo.type === ObjectManagement.UserType.Contained && this.objectInfo.authenticationType === ObjectManagement.AuthenticationType.Sql) {
			if (!this.objectInfo.password) {
				errors.push(localizedConstants.PasswordCannotBeEmptyError);
			}
			if (this.objectInfo.password !== this.confirmPasswordInput.value) {
				errors.push(localizedConstants.PasswordsNotMatchError);
			}
			if (!isValidSQLPassword(this.objectInfo.password!, this.objectInfo.name)
				&& (this.options.isNewObject || this.objectInfo.password !== this.originalObjectInfo.password)) {
				errors.push(localizedConstants.InvalidPasswordError);
			}
		} else if (this.objectInfo.type === ObjectManagement.UserType.WithLogin) {
			if (!this.objectInfo.loginName) {
				errors.push(localizedConstants.LoginNotSelectedError);
			}
		}
		return errors;
	}

	protected async initializeUI(): Promise<void> {
		this.initializeGeneralSection();
		this.initializeOwnedSchemaSection();
		this.initializeMembershipSection();
		this.initializeAdvancedSection();
		this.formContainer.addItems([this.generalSection, this.ownedSchemaSection, this.membershipSection, this.advancedSection]);
		setTimeout(() => {
			this.setViewByUserType();
		}, 100);
	}

	private initializeGeneralSection(): void {
		this.nameInput = this.createInputBox(localizedConstants.NameText, async (newValue) => {
			this.objectInfo.name = newValue;
		}, this.objectInfo.name, this.options.isNewObject);
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput);

		this.defaultSchemaDropdown = this.createDropdown(localizedConstants.DefaultSchemaText, async (newValue) => {
			this.objectInfo.defaultSchema = newValue;
		}, this.viewInfo.schemas, this.objectInfo.defaultSchema!);
		this.defaultSchemaContainer = this.createLabelInputContainer(localizedConstants.DefaultSchemaText, this.defaultSchemaDropdown);

		// only supporting user with login for initial preview
		const userTypes = [localizedConstants.UserWithLoginText, localizedConstants.UserWithWindowsGroupLoginText, localizedConstants.ContainedUserText, localizedConstants.UserWithNoConnectAccess];
		this.typeDropdown = this.createDropdown(localizedConstants.UserTypeText, async (newValue) => {
			this.objectInfo.type = getUserTypeByDisplayName(newValue);
			this.setViewByUserType();
		}, userTypes, getUserTypeDisplayName(this.objectInfo.type), this.options.isNewObject);
		this.typeContainer = this.createLabelInputContainer(localizedConstants.UserTypeText, this.typeDropdown);

		this.loginDropdown = this.createDropdown(localizedConstants.LoginText, async (newValue) => {
			this.objectInfo.loginName = newValue;
		}, this.viewInfo.logins, this.objectInfo.loginName, this.options.isNewObject);
		this.loginContainer = this.createLabelInputContainer(localizedConstants.LoginText, this.loginDropdown);

		const authTypes = [];
		if (this.viewInfo.supportWindowsAuthentication) {
			authTypes.push(localizedConstants.WindowsAuthenticationTypeDisplayText);
		}
		if (this.viewInfo.supportSQLAuthentication) {
			authTypes.push(localizedConstants.SQLAuthenticationTypeDisplayText);
		}
		if (this.viewInfo.supportAADAuthentication) {
			authTypes.push(localizedConstants.AADAuthenticationTypeDisplayText);
		}
		this.authTypeDropdown = this.createDropdown(localizedConstants.AuthTypeText, async (newValue) => {
			this.objectInfo.authenticationType = getAuthenticationTypeByDisplayName(newValue);
			this.setViewByAuthenticationType();
		}, authTypes, getAuthenticationTypeDisplayName(this.objectInfo.authenticationType), this.options.isNewObject);
		this.authTypeContainer = this.createLabelInputContainer(localizedConstants.AuthTypeText, this.authTypeDropdown);

		this.passwordInput = this.createPasswordInputBox(localizedConstants.PasswordText, async (newValue) => {
			this.objectInfo.password = newValue;
		}, this.objectInfo.password ?? '');
		this.passwordContainer = this.createLabelInputContainer(localizedConstants.PasswordText, this.passwordInput);
		this.confirmPasswordInput = this.createPasswordInputBox(localizedConstants.ConfirmPasswordText, async () => { }, this.objectInfo.password ?? '');
		this.confirmPasswordContainer = this.createLabelInputContainer(localizedConstants.ConfirmPasswordText, this.confirmPasswordInput);

		this.generalSection = this.createGroup(localizedConstants.GeneralSectionHeader, [
			nameContainer,
			this.defaultSchemaContainer,
			this.typeContainer,
			this.loginContainer,
			this.authTypeContainer,
			this.passwordContainer,
			this.confirmPasswordContainer
		], false);
	}

	private initializeOwnedSchemaSection(): void {
		this.ownedSchemaTable = this.createTableList<string>(localizedConstants.OwnedSchemaSectionHeader, [localizedConstants.SchemaText], this.viewInfo.schemas, this.objectInfo.ownedSchemas, (item) => {
			// It is not allowed to have unassigned schema.
			return this.objectInfo.ownedSchemas.indexOf(item) === -1;
		});
		this.ownedSchemaSection = this.createGroup(localizedConstants.OwnedSchemaSectionHeader, [this.ownedSchemaTable]);
	}

	private initializeMembershipSection(): void {
		this.membershipTable = this.createTableList<string>(localizedConstants.MembershipSectionHeader, [localizedConstants.DatabaseRoleTypeDisplayNameInTitle], this.viewInfo.databaseRoles, this.objectInfo.databaseRoles);
		this.membershipSection = this.createGroup(localizedConstants.MembershipSectionHeader, [this.membershipTable]);
	}

	private initializeAdvancedSection(): void {
		this.defaultLanguageDropdown = this.createDropdown(localizedConstants.DefaultLanguageText, async (newValue) => {
			this.objectInfo.defaultLanguage = newValue;
		}, this.viewInfo.languages, this.objectInfo.defaultLanguage);
		const container = this.createLabelInputContainer(localizedConstants.DefaultLanguageText, this.defaultLanguageDropdown);
		this.advancedSection = this.createGroup(localizedConstants.AdvancedSectionHeader, [container]);
	}

	private setViewByUserType(): void {
		if (this.typeDropdown.value === localizedConstants.UserWithLoginText) {
			this.removeItem(this.generalSection, this.authTypeContainer);
			this.removeItem(this.formContainer, this.advancedSection);
			this.addItem(this.generalSection, this.loginContainer);
		} else if (this.typeDropdown.value === localizedConstants.ContainedUserText) {
			this.removeItem(this.generalSection, this.loginContainer);
			this.addItem(this.generalSection, this.authTypeContainer);
			this.addItem(this.formContainer, this.advancedSection);
		} else {
			this.removeItem(this.generalSection, this.loginContainer);
			this.removeItem(this.generalSection, this.authTypeContainer);
			this.removeItem(this.formContainer, this.advancedSection);
		}
		this.setViewByAuthenticationType();
	}

	private setViewByAuthenticationType(): void {
		const showPassword = this.typeDropdown.value === localizedConstants.ContainedUserText && this.authTypeDropdown.value === localizedConstants.SQLAuthenticationTypeDisplayText;
		if (showPassword) {
			this.addItem(this.generalSection, this.passwordContainer);
			this.addItem(this.generalSection, this.confirmPasswordContainer);
		} else {
			this.removeItem(this.generalSection, this.passwordContainer);
			this.removeItem(this.generalSection, this.confirmPasswordContainer);
		}
	}
}
