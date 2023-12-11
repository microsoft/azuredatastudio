/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { AlterUserDocUrl, CreateUserDocUrl } from '../constants';
import { isValidSQLPassword } from '../utils';
import { DefaultMaxTableRowCount } from '../../ui/dialogBase';
import { PrincipalDialogBase } from './principalDialogBase';
import { User, UserType, UserViewInfo } from '../interfaces';

export class UserDialog extends PrincipalDialogBase<User, UserViewInfo> {
	private generalSection: azdata.GroupContainer;
	private ownedSchemaSection: azdata.GroupContainer;
	private membershipSection: azdata.GroupContainer;
	private advancedSection: azdata.GroupContainer;
	private nameInput: azdata.InputBoxComponent;
	private typeDropdown: azdata.DropDownComponent;
	private typeContainer: azdata.FlexContainer;
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
		super(objectManagementService, { ...options, isDatabaseLevelPrincipal: true, supportEffectivePermissions: true });
	}

	protected override get helpUrl(): string {
		return this.options.isNewObject ? CreateUserDocUrl : AlterUserDocUrl;
	}

	protected override postInitializeData(): void {
		this.objectInfo.password = this.objectInfo.password ?? '';
	}

	protected override async validateInput(): Promise<string[]> {
		const errors = await super.validateInput();
		if (this.objectInfo.type === UserType.SqlAuthentication) {
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
		} else if (this.objectInfo.type === UserType.LoginMapped && !this.objectInfo.loginName) {
			errors.push(localizedConstants.LoginNotSelectedError);
		}
		return errors;
	}

	protected override async initializeUI(): Promise<void> {
		await super.initializeUI();
		this.initializeGeneralSection();
		this.initializeOwnedSchemaSection();
		this.initializeMembershipSection();
		this.initializeAdvancedSection();
		this.formContainer.addItems([this.generalSection, this.ownedSchemaSection, this.membershipSection, this.securableSection, this.advancedSection], this.getSectionItemLayout());
		setTimeout(() => {
			this.setViewByUserType();
		}, 100);
	}

	private initializeGeneralSection(): void {
		const props: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.NameText,
			value: this.objectInfo.name,
			enabled: this.options.isNewObject
		};

		this.nameInput = this.createInputBox(async (newValue) => {
			this.objectInfo.name = newValue;
		}, props);
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput);

		this.defaultSchemaDropdown = this.createDropdown(localizedConstants.DefaultSchemaText, async (newValue) => {
			this.objectInfo.defaultSchema = newValue;
		}, this.viewInfo.schemas, this.objectInfo.defaultSchema!);
		this.defaultSchemaContainer = this.createLabelInputContainer(localizedConstants.DefaultSchemaText, this.defaultSchemaDropdown);
		this.typeDropdown = this.createDropdown(localizedConstants.UserTypeText,
			async (newValue) => {
				this.objectInfo.type = localizedConstants.getUserTypeByDisplayName(newValue);
				this.setViewByUserType();
			},
			this.viewInfo.userTypes.map(userType => localizedConstants.getUserTypeDisplayName(userType)),
			localizedConstants.getUserTypeDisplayName(this.objectInfo.type),
			this.options.isNewObject);
		this.typeContainer = this.createLabelInputContainer(localizedConstants.UserTypeText, this.typeDropdown);

		this.loginDropdown = this.createDropdown(localizedConstants.LoginText, async (newValue) => {
			this.objectInfo.loginName = newValue;
		}, this.options.isNewObject ? this.viewInfo.logins : [this.objectInfo.loginName], this.objectInfo.loginName, this.options.isNewObject);
		this.loginContainer = this.createLabelInputContainer(localizedConstants.LoginText, this.loginDropdown);

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
			this.passwordContainer,
			this.confirmPasswordContainer
		], false);
	}

	private initializeOwnedSchemaSection(): void {
		this.ownedSchemaTable = this.createTableList<string>(localizedConstants.OwnedSchemaSectionHeader,
			[localizedConstants.SchemaText],
			this.viewInfo.schemas,
			this.objectInfo.ownedSchemas,
			DefaultMaxTableRowCount,
			(item) => {
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
		this.removeItem(this.generalSection, this.loginContainer);
		this.removeItem(this.generalSection, this.passwordContainer);
		this.removeItem(this.generalSection, this.confirmPasswordContainer);
		this.removeItem(this.formContainer, this.advancedSection);
		switch (this.objectInfo.type) {
			case UserType.LoginMapped:
				this.addItem(this.generalSection, this.loginContainer);
				break;
			case UserType.AADAuthentication:
				this.addItem(this.formContainer, this.advancedSection);
				break;
			case UserType.SqlAuthentication:
				this.addItem(this.generalSection, this.passwordContainer);
				this.addItem(this.generalSection, this.confirmPasswordContainer);
				this.addItem(this.formContainer, this.advancedSection);
				break;
			case UserType.WindowsUser:
				if (this.objectInfo.loginName) {
					this.addItem(this.generalSection, this.loginContainer);
				}
				break;
			default:
				break;
		}
	}
}
