/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { AlterApplicationRoleDocUrl, CreateApplicationRoleDocUrl } from '../constants';
import { isValidSQLPassword } from '../utils';
import { DefaultMaxTableRowCount } from '../../ui/dialogBase';
import { PrincipalDialogBase } from './principalDialogBase';

export class ApplicationRoleDialog extends PrincipalDialogBase<ObjectManagement.ApplicationRoleInfo, ObjectManagement.ApplicationRoleViewInfo> {
	// Sections
	private generalSection: azdata.GroupContainer;
	private ownedSchemasSection: azdata.GroupContainer;

	// General section content
	private nameInput: azdata.InputBoxComponent;
	private defaultSchemaDropdown: azdata.DropDownComponent;
	private passwordInput: azdata.InputBoxComponent;
	private confirmPasswordInput: azdata.InputBoxComponent;

	// Owned Schemas section content
	private ownedSchemaTable: azdata.TableComponent;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options, true, false);
	}

	protected override postInitializeData(): void {
		this.objectInfo.password = this.objectInfo.password ?? '';
	}

	protected override get helpUrl(): string {
		return this.options.isNewObject ? CreateApplicationRoleDocUrl : AlterApplicationRoleDocUrl;
	}

	protected override async validateInput(): Promise<string[]> {
		const errors = await super.validateInput();
		if (!this.objectInfo.password) {
			errors.push(localizedConstants.PasswordCannotBeEmptyError);
		}
		if (this.objectInfo.password && !isValidSQLPassword(this.objectInfo.password, this.objectInfo.name)
			&& (this.options.isNewObject || this.objectInfo.password !== this.originalObjectInfo.password)) {
			errors.push(localizedConstants.InvalidPasswordError);
		}
		if (this.objectInfo.password !== this.confirmPasswordInput.value) {
			errors.push(localizedConstants.PasswordsNotMatchError);
		}
		return errors;
	}

	protected override async initializeUI(): Promise<void> {
		await super.initializeUI();
		this.initializeGeneralSection();
		this.initializeOwnedSchemasSection();
		this.formContainer.addItems([this.generalSection, this.ownedSchemasSection, this.securableSection], this.getSectionItemLayout());
	}

	private initializeGeneralSection(): void {
		this.nameInput = this.createInputBox(localizedConstants.NameText, async (newValue) => {
			this.objectInfo.name = newValue;
		}, this.objectInfo.name, this.options.isNewObject);
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput);

		this.defaultSchemaDropdown = this.createDropdown(localizedConstants.DefaultSchemaText, async (newValue) => {
			this.objectInfo.defaultSchema = newValue;
		}, this.viewInfo.schemas, this.objectInfo.defaultSchema!);
		const defaultSchemaContainer = this.createLabelInputContainer(localizedConstants.DefaultSchemaText, this.defaultSchemaDropdown);

		this.passwordInput = this.createPasswordInputBox(localizedConstants.PasswordText, async (newValue) => {
			this.objectInfo.password = newValue;
		}, this.objectInfo.password ?? '');
		const passwordContainer = this.createLabelInputContainer(localizedConstants.PasswordText, this.passwordInput);

		this.confirmPasswordInput = this.createPasswordInputBox(localizedConstants.ConfirmPasswordText, async () => { }, this.objectInfo.password ?? '');
		const confirmPasswordContainer = this.createLabelInputContainer(localizedConstants.ConfirmPasswordText, this.confirmPasswordInput);

		this.generalSection = this.createGroup(localizedConstants.GeneralSectionHeader, [nameContainer, defaultSchemaContainer, passwordContainer, confirmPasswordContainer], false);
	}

	private initializeOwnedSchemasSection(): void {
		this.ownedSchemaTable = this.createTableList<string>(localizedConstants.OwnedSchemaSectionHeader,
			[localizedConstants.SchemaText],
			this.viewInfo.schemas,
			this.objectInfo.ownedSchemas,
			DefaultMaxTableRowCount,
			(item) => {
				// It is not allowed to have unassigned schema.
				return this.objectInfo.ownedSchemas.indexOf(item) === -1;
			});
		this.ownedSchemasSection = this.createGroup(localizedConstants.OwnedSchemaSectionHeader, [this.ownedSchemaTable]);
	}
}
