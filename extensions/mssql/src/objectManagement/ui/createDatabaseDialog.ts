/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DefaultInputWidth, ObjectManagementDialogBase } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { CreateDatabaseDocUrl, NodeType } from '../constants';
import * as localizedConstants from '../localizedConstants';

const DefaultValue = '<default>';

export class CreateDatabaseDialog extends ObjectManagementDialogBase<ObjectManagement.Database, ObjectManagement.CreateDatabaseViewInfo> {
	private _model: ObjectManagement.CreateDatabaseViewInfo;

	private _nameInput: azdata.InputBoxComponent;

	constructor(objectManagementService: IObjectManagementService, connectionUri: string, objectExplorerContext: azdata.ObjectExplorerContext) {
		super(NodeType.Database, CreateDatabaseDocUrl, objectManagementService, connectionUri, true, localizedConstants.CreateDatabaseTitle, objectExplorerContext);
	}

	protected override async onConfirmation(): Promise<boolean> {
		return true;
	}

	protected async validateInput(): Promise<string[]> {
		const errors: string[] = [];
		if (!this.objectInfo.name) {
			errors.push(localizedConstants.NameCannotBeEmptyError);
		}
		if (this._model.databaseNames.some(name => name.toLowerCase() === this.objectInfo.name.toLowerCase())) {
			errors.push(localizedConstants.DatabaseExistsError(this.objectInfo.name));
		}
		return errors;
	}

	protected async onComplete(): Promise<void> {
		// Execute create database command
	}

	protected async disposeView(): Promise<void> {
	}

	protected async initializeData(): Promise<ObjectManagement.CreateDatabaseViewInfo> {
		// TODO: Replace with real data
		let databaseNames = ['TestDB'];
		let loginNames = ['sa', 'TestLogin'];
		let collationNames = ['SQL_Latin1_General_CP1_CI_AS', 'French_CI_AS', 'Modern_Spanish_CI_AS'];
		let compatibilityLevels = ['SQL Server 2019 (150)', 'SQL Server 2017 (140)', 'SQL Server 2016 (130)'];
		this._model = {
			objectInfo: {
				name: undefined
			},
			databaseNames,
			loginNames,
			collationNames,
			compatibilityLevels
		}
		return this._model;
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
			this.objectInfo.name = this._nameInput.value!;
			this.onObjectValueChange();
			await this.runValidation(false);
		}));
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this._nameInput);

		let ownerDropbox = this.createDropdown(localizedConstants.OwnerText, [DefaultValue, ...this._model.loginNames], DefaultValue);
		const ownerContainer = this.createLabelInputContainer(localizedConstants.OwnerText, ownerDropbox);

		return this.createGroup(localizedConstants.GeneralSectionHeader, [
			nameContainer,
			ownerContainer,
		], false);
	}

	private initializeOptionsSection(): azdata.GroupContainer {
		let collationDropbox = this.createDropdown(localizedConstants.CollationText, [DefaultValue, ...this._model.collationNames], DefaultValue);
		const collationContainer = this.createLabelInputContainer(localizedConstants.CollationText, collationDropbox);

		let recoveryOptions = ['Simple', 'Bulk-logged', 'Full'];
		let recoveryDropbox = this.createDropdown(localizedConstants.RecoveryModelText, recoveryOptions, recoveryOptions[0]);
		const recoveryContainer = this.createLabelInputContainer(localizedConstants.RecoveryModelText, recoveryDropbox);

		let compatibilityDropbox = this.createDropdown(localizedConstants.CompatibilityLevelText, this._model.compatibilityLevels, this._model.compatibilityLevels[0]);
		const compatibilityContainer = this.createLabelInputContainer(localizedConstants.CompatibilityLevelText, compatibilityDropbox);

		let containmentOptions = ['None', 'Partial'];
		let containmentDropbox = this.createDropdown(localizedConstants.ContainmentTypeText, containmentOptions, containmentOptions[0]);
		const containmentContainer = this.createLabelInputContainer(localizedConstants.ContainmentTypeText, containmentDropbox);

		return this.createGroup(localizedConstants.OptionsSectionHeader, [collationContainer, recoveryContainer, compatibilityContainer, containmentContainer], true, true);
	}
}
