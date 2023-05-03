/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { CreateDatabaseDocUrl } from '../constants';
import { DefaultInputWidth } from './dialogBase';

export class DatabaseDialog extends ObjectManagementDialogBase<ObjectManagement.Database, ObjectManagement.DatabaseViewInfo> {
	private _nameInput: azdata.InputBoxComponent;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
	}

	protected override get docUrl(): string {
		return CreateDatabaseDocUrl;
	}

	protected override async validateInput(): Promise<string[]> {
		const errors = await super.validateInput();
		if (this.objectInfo.name && this.viewInfo.databaseNames.some(name => name.toLowerCase() === this.objectInfo.name.toLowerCase())) {
			errors.push(localizedConstants.DatabaseExistsError(this.objectInfo.name));
		}
		return errors;
	}

	protected async initializeUI(): Promise<void> {
		let generalSection = this.initializeGeneralSection();
		let optionsSection = this.initializeOptionsSection();
		this.formContainer.addItems([generalSection, optionsSection]);
	}

	private initializeGeneralSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		this._nameInput = this.modelView.modelBuilder.inputBox().withProps({
			ariaLabel: localizedConstants.NameText,
			value: this.objectInfo.name,
			width: DefaultInputWidth,
			required: true
		}).component();
		this.disposables.push(this._nameInput.onTextChanged(async () => {
			this.objectInfo.name = this._nameInput.value;
			await this.runValidation(false);
		}));
		containers.push(this.createLabelInputContainer(localizedConstants.NameText, this._nameInput));

		if (this.viewInfo.loginNames?.length > 0) {
			let ownerDropbox = this.createDropdown(localizedConstants.OwnerText, async () => {
				this.objectInfo.owner = ownerDropbox.value as string;
			}, this.viewInfo.loginNames, this.viewInfo.loginNames[0]);
			containers.push(this.createLabelInputContainer(localizedConstants.OwnerText, ownerDropbox));
		}

		return this.createGroup(localizedConstants.GeneralSectionHeader, containers, false);
	}

	private initializeOptionsSection(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		if (this.viewInfo.collationNames?.length > 0) {
			let collationDropbox = this.createDropdown(localizedConstants.CollationText, async () => {
				this.objectInfo.collationName = collationDropbox.value as string;
			}, this.viewInfo.collationNames, this.viewInfo.collationNames[0]);
			containers.push(this.createLabelInputContainer(localizedConstants.CollationText, collationDropbox));
		}

		if (this.viewInfo.recoveryModels?.length > 0) {
			this.objectInfo.recoveryModel = this.viewInfo.recoveryModels[0];
			let recoveryDropbox = this.createDropdown(localizedConstants.RecoveryModelText, async () => {
				this.objectInfo.recoveryModel = recoveryDropbox.value as string;
			}, this.viewInfo.recoveryModels, this.viewInfo.recoveryModels[0]);
			containers.push(this.createLabelInputContainer(localizedConstants.RecoveryModelText, recoveryDropbox));
		}

		if (this.viewInfo.compatibilityLevels?.length > 0) {
			this.objectInfo.compatibilityLevel = this.viewInfo.compatibilityLevels[0];
			let compatibilityDropbox = this.createDropdown(localizedConstants.CompatibilityLevelText, async () => {
				this.objectInfo.compatibilityLevel = compatibilityDropbox.value as string;
			}, this.viewInfo.compatibilityLevels, this.viewInfo.compatibilityLevels[0]);
			containers.push(this.createLabelInputContainer(localizedConstants.CompatibilityLevelText, compatibilityDropbox));
		}

		if (this.viewInfo.containmentTypes?.length > 0) {
			this.objectInfo.containmentType = this.viewInfo.containmentTypes[0];
			let containmentDropbox = this.createDropdown(localizedConstants.ContainmentTypeText, async () => {
				this.objectInfo.containmentType = containmentDropbox.value as string;
			}, this.viewInfo.containmentTypes, this.viewInfo.containmentTypes[0]);
			containers.push(this.createLabelInputContainer(localizedConstants.ContainmentTypeText, containmentDropbox));
		}

		return this.createGroup(localizedConstants.OptionsSectionHeader, containers, true, true);
	}
}
