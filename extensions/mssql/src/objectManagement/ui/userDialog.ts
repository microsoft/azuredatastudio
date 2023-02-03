/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { DefaultInputWidth, DefaultTableWidth, getTableHeight, ObjectManagementDialogBase } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { NodeType } from '../constants';
import { refreshNode } from '../utils';

export class UserDialog extends ObjectManagementDialogBase {
	private dialogInfo: ObjectManagement.UserViewInfo;
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

	constructor(objectManagementService: IObjectManagementService, connectionUri: string, private readonly database: string, isNewObject: boolean, name?: string, private readonly objectExplorerContext?: azdata.ObjectExplorerContext) {
		super(NodeType.User, objectManagementService, connectionUri, isNewObject, name);
	}

	protected async validate(): Promise<string[]> {
		const errors: string[] = [];
		if (!this.nameInput.value) {
			errors.push(localizedConstants.NameCannotBeEmptyError);
		}

		if (this.passwordInput && this.passwordInput.value !== this.confirmPasswordInput.value) {
			errors.push(localizedConstants.PasswordsNotMatchError);
		}
		return errors;
	}

	protected async onComplete(): Promise<void> {
		this.dialogInfo.user.name = this.nameInput.value;
		if (this.authTypeDropdown) {
			this.dialogInfo.user.authenticationType = localizedConstants.getAuthenticationTypeByDisplayName(<string>this.authTypeDropdown.value);
		}
		if (this.passwordInput) {
			this.dialogInfo.user.password = this.passwordInput.value;
		}
		if (this.defaultLanguageDropdown) {
			this.dialogInfo.user.defaultLanguage = <string>this.defaultLanguageDropdown.value;
		}
		if (this.isNewObject) {
			await this.objectManagementService.createUser(this.contextId, this.dialogInfo.user);
			if (this.objectExplorerContext) {
				await refreshNode(this.objectExplorerContext);
			}
		} else {
			await this.objectManagementService.updateUser(this.contextId, this.dialogInfo.user);
		}
	}

	protected async onDispose(): Promise<void> {
		await this.objectManagementService.disposeUserView(this.contextId);
	}

	protected async initialize(): Promise<void> {
		this.dialogInfo = await this.objectManagementService.initializeUserView(this.connectionUri, this.database, this.contextId, this.isNewObject, this.objectName);
		this.dialogObject.registerContent(async view => {
			const sections: azdata.Component[] = [];
			this.initializeGeneralSection(view);
			this.initializeOwnedSchemaSection(view);
			this.initializeMembershipSection(view);
			this.initializeAdvancedSection(view);
			sections.push(this.generalSection, this.ownedSchemaSection, this.membershipSection, this.advancedSection);
			this.formContainer = this.createFormContainer(view, sections);
			this.onUserTypeChanged();
			return view.initializeModel(this.formContainer)
		});
	}

	private initializeGeneralSection(view: azdata.ModelView): void {
		this.nameInput = view.modelBuilder.inputBox().withProps({
			ariaLabel: localizedConstants.NameText,
			enabled: this.isNewObject,
			value: this.dialogInfo.user.name,
			required: this.isNewObject,
			width: DefaultInputWidth
		}).component();
		this.nameInput.onTextChanged(async () => {
			await this.runValidation(false);
		});
		const nameContainer = this.createLabelInputContainer(view, localizedConstants.NameText, this.nameInput);

		this.defaultSchemaDropdown = view.modelBuilder.dropDown().withProps({
			ariaLabel: localizedConstants.DefaultSchemaText,
			values: this.dialogInfo.schemas,
			value: this.dialogInfo.user.defaultSchema,
			width: DefaultInputWidth
		}).component();
		this.defaultSchemaContainer = this.createLabelInputContainer(view, localizedConstants.DefaultSchemaText, this.defaultSchemaDropdown);

		this.typeDropdown = view.modelBuilder.dropDown().withProps({
			ariaLabel: localizedConstants.UserTypeText,
			values: [localizedConstants.UserWithLoginText, localizedConstants.UserWithWindowsGroupLoginText, localizedConstants.ContainedUserText, localizedConstants.UserWithNoConnectAccess],
			value: localizedConstants.getUserTypeDisplayName(this.dialogInfo.user.type),
			width: DefaultInputWidth,
			enabled: this.isNewObject
		}).component();
		this.typeDropdown.onValueChanged(() => {
			this.onUserTypeChanged();
		});
		this.typeContainer = this.createLabelInputContainer(view, localizedConstants.UserTypeText, this.typeDropdown);

		this.loginDropdown = view.modelBuilder.dropDown().withProps({
			ariaLabel: localizedConstants.LoginText,
			values: this.dialogInfo.logins,
			value: this.dialogInfo.user.loginName,
			width: DefaultInputWidth,
			enabled: this.isNewObject
		}).component();
		this.loginContainer = this.createLabelInputContainer(view, localizedConstants.LoginText, this.loginDropdown);

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
			value: localizedConstants.getAuthenticationTypeDisplayName(this.dialogInfo.user.authenticationType),
			width: DefaultInputWidth,
			enabled: this.isNewObject
		}).component();
		this.authTypeContainer = this.createLabelInputContainer(view, localizedConstants.AuthTypeText, this.authTypeDropdown);
		this.authTypeDropdown.onValueChanged(() => {
			this.onAuthenticationTypeChanged();
		});

		this.passwordInput = this.createPasswordInputBox(view, localizedConstants.PasswordText, this.dialogInfo.user.password ?? '');
		this.passwordContainer = this.createLabelInputContainer(view, localizedConstants.PasswordText, this.passwordInput);
		this.confirmPasswordInput = this.createPasswordInputBox(view, localizedConstants.ConfirmPasswordText, this.dialogInfo.user.password ?? '');
		this.confirmPasswordContainer = this.createLabelInputContainer(view, localizedConstants.ConfirmPasswordText, this.confirmPasswordInput);
		this.passwordInput.onTextChanged(async () => {
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
		const ownedSchemasData = this.dialogInfo.schemas.map(name => {
			const isSchemaSelected = this.dialogInfo.user.ownedSchemas.indexOf(name) !== -1;
			return [isSchemaSelected, name];
		});
		this.ownedSchemaTable = view.modelBuilder.table().withProps(
			{
				ariaLabel: localizedConstants.OwnedSchemaSectionHeader,
				data: ownedSchemasData,
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
				height: getTableHeight(this.dialogInfo.schemas.length)
			}
		).component();
		this.ownedSchemaTable.onCellAction((arg: azdata.ICheckboxCellActionEventArgs) => {
			const schemaName = this.dialogInfo.schemas[arg.row];
			const idx = this.dialogInfo.user.ownedSchemas.indexOf(schemaName);
			if (arg.checked && idx === -1) {
				this.dialogInfo.user.ownedSchemas.push(schemaName);
			} else if (!arg.checked && idx !== -1) {
				this.dialogInfo.user.ownedSchemas.splice(idx, 1)
			}
		});
		this.ownedSchemaSection = this.createGroup(view, localizedConstants.OwnedSchemaSectionHeader, [this.ownedSchemaTable]);
	}

	private initializeMembershipSection(view: azdata.ModelView): void {
		const databaseRoleData = this.dialogInfo.databaseRoles.map(name => {
			const isSelected = this.dialogInfo.user.databaseRoles.indexOf(name) !== -1;
			return [isSelected, name];
		});
		this.membershipTable = view.modelBuilder.table().withProps(
			{
				ariaLabel: localizedConstants.MembershipSectionHeader,
				data: databaseRoleData,
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
				height: getTableHeight(this.dialogInfo.databaseRoles.length)
			}
		).component();
		this.membershipTable.onCellAction((arg: azdata.ICheckboxCellActionEventArgs) => {
			const name = this.dialogInfo.databaseRoles[arg.row];
			const idx = this.dialogInfo.user.databaseRoles.indexOf(name);
			if (arg.checked && idx === -1) {
				this.dialogInfo.user.databaseRoles.push(name);
			} else if (!arg.checked && idx !== -1) {
				this.dialogInfo.user.databaseRoles.splice(idx, 1)
			}
		});
		this.membershipSection = this.createGroup(view, localizedConstants.MembershipSectionHeader, [this.membershipTable]);
	}

	private initializeAdvancedSection(view: azdata.ModelView): void {
		this.defaultLanguageDropdown = view.modelBuilder.dropDown().withProps({
			ariaLabel: localizedConstants.DefaultLanguageText,
			values: this.dialogInfo.languages,
			value: this.dialogInfo.user.defaultLanguage,
			width: DefaultInputWidth
		}).component();
		const container = this.createLabelInputContainer(view, localizedConstants.DefaultLanguageText, this.defaultLanguageDropdown);
		this.advancedSection = this.createGroup(view, localizedConstants.AdvancedSectionHeader, [container]);
	}

	private onUserTypeChanged(): void {
		// this.removeItem(this.generalSection, this.loginContainer);
		// this.removeItem(this.generalSection, this.authTypeContainer);
		// this.removeItem(this.generalSection, this.passwordContainer);
		// this.removeItem(this.generalSection, this.confirmPasswordContainer);
		// this.removeItem(this.formContainer, this.advancedSection);
		let enableLogin = false;
		let enableAuthType = false;
		let enableLanguage = false;
		if (this.typeDropdown.value === localizedConstants.UserWithLoginText) {
			// this.addItem(this.generalSection, this.loginContainer);
			enableLogin = true;
		} else if (this.typeDropdown.value === localizedConstants.ContainedUserText) {
			enableAuthType = true;
			enableLanguage = true;
			// this.addItem(this.generalSection, this.authTypeContainer);
			// this.addItem(this.formContainer, this.advancedSection);
		}
		this.loginDropdown.enabled = enableLogin;
		this.authTypeDropdown.enabled = enableAuthType;
		this.defaultLanguageDropdown.enabled = enableLanguage;
		this.onAuthenticationTypeChanged();
	}

	private onAuthenticationTypeChanged(): void {
		const enablePassword = this.typeDropdown.value === localizedConstants.ContainedUserText && this.authTypeDropdown.value === localizedConstants.SQLAuthenticationTypeDisplayText
		this.passwordInput.enabled = enablePassword;
		this.confirmPasswordInput.enabled = enablePassword;
	}
}
