/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { DefaultInputWidth, ObjectManagementDialogBase } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { AlterUserDocUrl, AuthenticationType, CreateUserDocUrl, NodeType, UserType } from '../constants';
import { getAuthenticationTypeByDisplayName, getAuthenticationTypeDisplayName, getUserTypeByDisplayName, getUserTypeDisplayName, isValidSQLPassword } from '../utils';

export class UserDialog extends ObjectManagementDialogBase<ObjectManagement.User, ObjectManagement.UserViewInfo> {
	private formContainer: azdata.DivContainer;
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

	constructor(objectManagementService: IObjectManagementService, connectionUri: string, private readonly database: string, isNewObject: boolean, name?: string, objectExplorerContext?: azdata.ObjectExplorerContext) {
		super(NodeType.User, isNewObject ? CreateUserDocUrl : AlterUserDocUrl, objectManagementService, connectionUri, isNewObject, name, objectExplorerContext);
	}

	protected async initializeData(): Promise<ObjectManagement.UserViewInfo> {
		const viewInfo = await this.objectManagementService.initializeUserView(this.connectionUri, this.database, this.contextId, this.isNewObject, this.objectName);
		viewInfo.objectInfo.password = viewInfo.objectInfo.password ?? '';
		return viewInfo;
	}

	protected async validateInput(): Promise<string[]> {
		const errors: string[] = [];
		if (!this.objectInfo.name) {
			errors.push(localizedConstants.NameCannotBeEmptyError);
		}
		if (this.objectInfo.type === UserType.Contained && this.objectInfo.authenticationType === AuthenticationType.Sql) {
			if (!this.objectInfo.password) {
				errors.push(localizedConstants.PasswordCannotBeEmptyError);
			}
			if (this.objectInfo.password !== this.confirmPasswordInput.value) {
				errors.push(localizedConstants.PasswordsNotMatchError);
			}
			if (!isValidSQLPassword(this.objectInfo.password, this.objectInfo.name)
				&& (this.isNewObject || this.objectInfo.password !== this.originalObjectInfo.password)) {
				errors.push(localizedConstants.InvalidPasswordError);
			}
		}
		return errors;
	}

	protected async onComplete(): Promise<void> {
		if (this.isNewObject) {
			await this.objectManagementService.createUser(this.contextId, this.objectInfo);
		} else {
			await this.objectManagementService.updateUser(this.contextId, this.objectInfo);
		}
	}

	protected async onDispose(): Promise<void> {
		await this.objectManagementService.disposeUserView(this.contextId);
	}

	protected async initializeUI(): Promise<void> {
		this.dialogObject.registerContent(async view => {
			const sections: azdata.Component[] = [];
			this.initializeGeneralSection(view);
			this.initializeOwnedSchemaSection(view);
			this.initializeMembershipSection(view);
			this.initializeAdvancedSection(view);
			sections.push(this.generalSection, this.ownedSchemaSection, this.membershipSection, this.advancedSection);
			this.formContainer = this.createFormContainer(view, sections);
			setTimeout(() => {
				this.setViewByUserType();
			}, 100);
			return view.initializeModel(this.formContainer)
		});
	}

	private initializeGeneralSection(view: azdata.ModelView): void {
		this.nameInput = view.modelBuilder.inputBox().withProps({
			ariaLabel: localizedConstants.NameText,
			enabled: this.isNewObject,
			value: this.objectInfo.name,
			width: DefaultInputWidth
		}).component();
		this.nameInput.onTextChanged(async () => {
			this.objectInfo.name = this.nameInput.value;
			this.onObjectValueChange();
			await this.runValidation(false);
		});
		const nameContainer = this.createLabelInputContainer(view, localizedConstants.NameText, this.nameInput);

		this.defaultSchemaDropdown = view.modelBuilder.dropDown().withProps({
			ariaLabel: localizedConstants.DefaultSchemaText,
			values: this.viewInfo.schemas,
			value: this.objectInfo.defaultSchema,
			width: DefaultInputWidth
		}).component();
		this.defaultSchemaContainer = this.createLabelInputContainer(view, localizedConstants.DefaultSchemaText, this.defaultSchemaDropdown);
		this.defaultSchemaDropdown.onValueChanged(() => {
			this.objectInfo.defaultSchema = <string>this.defaultSchemaDropdown.value;
			this.onObjectValueChange();
		});

		this.typeDropdown = view.modelBuilder.dropDown().withProps({
			ariaLabel: localizedConstants.UserTypeText,
			values: [localizedConstants.UserWithLoginText, localizedConstants.UserWithWindowsGroupLoginText, localizedConstants.ContainedUserText, localizedConstants.UserWithNoConnectAccess],
			value: getUserTypeDisplayName(this.objectInfo.type),
			width: DefaultInputWidth,
			enabled: this.isNewObject
		}).component();
		this.typeDropdown.onValueChanged(async () => {
			this.objectInfo.type = getUserTypeByDisplayName(<string>this.typeDropdown.value);
			this.onObjectValueChange();
			this.setViewByUserType();
			await this.runValidation(false);
		});
		this.typeContainer = this.createLabelInputContainer(view, localizedConstants.UserTypeText, this.typeDropdown);

		this.loginDropdown = view.modelBuilder.dropDown().withProps({
			ariaLabel: localizedConstants.LoginText,
			values: this.viewInfo.logins,
			value: this.objectInfo.loginName,
			width: DefaultInputWidth,
			enabled: this.isNewObject
		}).component();
		this.loginDropdown.onValueChanged(() => {
			this.objectInfo.loginName = <string>this.loginDropdown.value;
			this.onObjectValueChange();
		});
		this.loginContainer = this.createLabelInputContainer(view, localizedConstants.LoginText, this.loginDropdown);

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
		this.authTypeDropdown = view.modelBuilder.dropDown().withProps({
			ariaLabel: localizedConstants.AuthTypeText,
			values: authTypes,
			value: getAuthenticationTypeDisplayName(this.objectInfo.authenticationType),
			width: DefaultInputWidth,
			enabled: this.isNewObject
		}).component();
		this.authTypeContainer = this.createLabelInputContainer(view, localizedConstants.AuthTypeText, this.authTypeDropdown);
		this.authTypeDropdown.onValueChanged(async () => {
			this.objectInfo.authenticationType = getAuthenticationTypeByDisplayName(<string>this.authTypeDropdown.value);
			this.onObjectValueChange();
			this.setViewByAuthenticationType();
			await this.runValidation(false);
		});

		this.passwordInput = this.createPasswordInputBox(view, localizedConstants.PasswordText, this.objectInfo.password ?? '');
		this.passwordContainer = this.createLabelInputContainer(view, localizedConstants.PasswordText, this.passwordInput);
		this.confirmPasswordInput = this.createPasswordInputBox(view, localizedConstants.ConfirmPasswordText, this.objectInfo.password ?? '');
		this.confirmPasswordContainer = this.createLabelInputContainer(view, localizedConstants.ConfirmPasswordText, this.confirmPasswordInput);
		this.passwordInput.onTextChanged(async () => {
			this.objectInfo.password = this.passwordInput.value;
			this.onObjectValueChange();
			await this.runValidation(false);
		});
		this.confirmPasswordInput.onTextChanged(async () => {
			await this.runValidation(false);
		});

		this.generalSection = this.createGroup(view, localizedConstants.GeneralSectionHeader, [
			nameContainer,
			this.defaultSchemaContainer,
			this.typeContainer,
			this.loginContainer,
			this.authTypeContainer,
			this.passwordContainer,
			this.confirmPasswordContainer
		], false);
	}

	private initializeOwnedSchemaSection(view: azdata.ModelView): void {
		this.ownedSchemaTable = this.createTableList(view, localizedConstants.OwnedSchemaSectionHeader, this.viewInfo.schemas, this.objectInfo.ownedSchemas);
		this.ownedSchemaSection = this.createGroup(view, localizedConstants.OwnedSchemaSectionHeader, [this.ownedSchemaTable]);
	}

	private initializeMembershipSection(view: azdata.ModelView): void {
		this.membershipTable = this.createTableList(view, localizedConstants.MembershipSectionHeader, this.viewInfo.databaseRoles, this.objectInfo.databaseRoles);
		this.membershipSection = this.createGroup(view, localizedConstants.MembershipSectionHeader, [this.membershipTable]);
	}

	private initializeAdvancedSection(view: azdata.ModelView): void {
		this.defaultLanguageDropdown = view.modelBuilder.dropDown().withProps({
			ariaLabel: localizedConstants.DefaultLanguageText,
			values: this.viewInfo.languages,
			value: this.objectInfo.defaultLanguage,
			width: DefaultInputWidth
		}).component();
		this.defaultLanguageDropdown.onValueChanged(() => {
			this.objectInfo.defaultLanguage = <string>this.defaultLanguageDropdown.value;
			this.onObjectValueChange();
		});
		const container = this.createLabelInputContainer(view, localizedConstants.DefaultLanguageText, this.defaultLanguageDropdown);
		this.advancedSection = this.createGroup(view, localizedConstants.AdvancedSectionHeader, [container]);
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
