/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DefaultInputWidth, ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { CreateDatabaseDocUrl } from '../constants';

export class CreateDatabaseDialog extends ObjectManagementDialogBase<ObjectManagement.Database, ObjectManagement.CreateDatabaseViewInfo> {
	private _nameInput: azdata.InputBoxComponent;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
	}

	protected override get docUrl(): string {
		return CreateDatabaseDocUrl;
	}

	protected override async onConfirmation(): Promise<boolean> {
		return true;
	}

	protected async validateInput(): Promise<string[]> {
		const errors: string[] = [];
		if (!this.objectInfo.name) {
			errors.push(localizedConstants.NameCannotBeEmptyError);
		}
		if (this.viewInfo.databaseNames.some(name => name.toLowerCase() === this.objectInfo.name.toLowerCase())) {
			errors.push(localizedConstants.DatabaseExistsError(this.objectInfo.name));
		}
		return errors;
	}

	protected async onComplete(): Promise<void> {
		// Execute create database command
	}

	protected async initializeUI(): Promise<void> {
		let generalSection = this.initializeGeneralSection();
		let optionsSection = this.initializeOptionsSection();
		this.formContainer.addItems([generalSection, optionsSection]);
	}

	private initializeGeneralSection(): azdata.GroupContainer {
		this._nameInput = this.modelView.modelBuilder.inputBox().withProps({
			ariaLabel: localizedConstants.NameText,
			value: this.objectInfo.name,
			width: DefaultInputWidth,
			required: true
		}).component();
		this.disposables.push(this._nameInput.onTextChanged(async () => {
			this.objectInfo.name = this._nameInput.value;
			this.onObjectValueChange();
			await this.runValidation(false);
		}));
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this._nameInput);

		return this.createGroup(localizedConstants.GeneralSectionHeader, [
			nameContainer
		], false);
	}

	private initializeOptionsSection(): azdata.GroupContainer {
		// Hide Owner field for Azure SQL DB
		let ownerEnabled = this.viewInfo.loginNames?.length > 0;
		let ownerDropbox = this.createDropdown(localizedConstants.OwnerText, this.viewInfo.loginNames, undefined, ownerEnabled);
		this.disposables.push(ownerDropbox.onValueChanged(async () => {
			this.objectInfo.owner = ownerDropbox.value as string;
			this.onObjectValueChange();
			await this.runValidation(false);
		}));
		const ownerContainer = this.createLabelInputContainer(localizedConstants.OwnerText, ownerDropbox);

		var collationEnabled = this.viewInfo.collationNames?.length > 0;
		let collationDropbox = this.createDropdown(localizedConstants.CollationText, this.viewInfo.collationNames, undefined, collationEnabled);
		this.disposables.push(collationDropbox.onValueChanged(async () => {
			this.objectInfo.collationName = collationDropbox.value as string;
			this.onObjectValueChange();
			await this.runValidation(false);
		}));
		const collationContainer = this.createLabelInputContainer(localizedConstants.CollationText, collationDropbox);

		// Hide Recovery Model for Azure SQL DB
		var recoveryEnabled = this.viewInfo.recoveryModels?.length > 0;
		let recoveryDropbox = this.createDropdown(localizedConstants.RecoveryModelText, this.viewInfo.recoveryModels, undefined, recoveryEnabled);
		this.disposables.push(recoveryDropbox.onValueChanged(async () => {
			this.objectInfo.recoveryModel = recoveryDropbox.value as string;
			this.onObjectValueChange();
			await this.runValidation(false);
		}));
		const recoveryContainer = this.createLabelInputContainer(localizedConstants.RecoveryModelText, recoveryDropbox);

		var compatibilityEnabled = this.viewInfo.compatibilityLevels?.length > 0;
		let compatibilityDropbox = this.createDropdown(localizedConstants.CompatibilityLevelText, this.viewInfo.compatibilityLevels, undefined, compatibilityEnabled);
		this.disposables.push(compatibilityDropbox.onValueChanged(async () => {
			this.objectInfo.compatibilityLevel = compatibilityDropbox.value as string;
			this.onObjectValueChange();
			await this.runValidation(false);
		}));
		const compatibilityContainer = this.createLabelInputContainer(localizedConstants.CompatibilityLevelText, compatibilityDropbox);

		// Hide Containment Type for Azure SQL DB
		var containmentEnabled = this.viewInfo.containmentTypes?.length > 0;
		let containmentDropbox = this.createDropdown(localizedConstants.ContainmentTypeText, this.viewInfo.containmentTypes, undefined, containmentEnabled);
		this.disposables.push(containmentDropbox.onValueChanged(async () => {
			this.objectInfo.containmentType = containmentDropbox.value as string;
			this.onObjectValueChange();
			await this.runValidation(false);
		}));
		const containmentContainer = this.createLabelInputContainer(localizedConstants.ContainmentTypeText, containmentDropbox);

		return this.createGroup(localizedConstants.OptionsSectionHeader, [ownerContainer, collationContainer, recoveryContainer, compatibilityContainer, containmentContainer], true, true);
	}
}
