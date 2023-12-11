/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { AlterApplicationRoleDocUrl, CreateApplicationRoleDocUrl } from '../constants';
import { isValidSQLPassword } from '../utils';
import { DefaultMaxTableRowCount } from '../../ui/dialogBase';
import { PrincipalDialogBase } from './principalDialogBase';
import { ApplicationRoleInfo, ApplicationRoleViewInfo } from '../interfaces';

export class ApplicationRoleDialog extends PrincipalDialogBase<ApplicationRoleInfo, ApplicationRoleViewInfo> {
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
		super(objectManagementService, { ...options, isDatabaseLevelPrincipal: true, supportEffectivePermissions: false });
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
		this.nameInput = this.createInputBox(async (newValue) => {
			this.objectInfo.name = newValue;
		}, {
			ariaLabel: localizedConstants.NameText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.name,
			required: true
		});
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput, true);

		this.defaultSchemaDropdown = this.createDropdown(localizedConstants.DefaultSchemaText, async (newValue) => {
			this.objectInfo.defaultSchema = newValue;
		}, this.viewInfo.schemas, this.objectInfo.defaultSchema!);
		const defaultSchemaContainer = this.createLabelInputContainer(localizedConstants.DefaultSchemaText, this.defaultSchemaDropdown);

		this.passwordInput = this.createInputBox(async (newValue) => {
			this.objectInfo.password = newValue;
		}, {
			ariaLabel: localizedConstants.PasswordText,
			inputType: 'password',
			value: this.objectInfo.password ?? '',
			required: true
		});
		const passwordContainer = this.createLabelInputContainer(localizedConstants.PasswordText, this.passwordInput, true);

		this.confirmPasswordInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.ConfirmPasswordText,
			inputType: 'password',
			value: this.objectInfo.password ?? '',
			required: true
		});
		const confirmPasswordContainer = this.createLabelInputContainer(localizedConstants.ConfirmPasswordText, this.confirmPasswordInput, true);

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
