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
		let databaseNames = ['TestDB'];
		let loginNames = ['sa', 'TestLogin'];
		let collationNames = ['SQL_Latin1_General_CP1_CI_AS', 'French_CI_AS', 'Modern_Spanish_CI_AS'];
		this._model = {
			objectInfo: {
				name: undefined
			},
			databaseNames,
			loginNames,
			collationNames
		}
		return this._model;
	}

	protected async initializeUI(): Promise<void> {
		let generalSection = this.initializeGeneralSection();
		let advancedSection = this.initializeAdvancedSection();
		this.formContainer.addItems([generalSection, advancedSection]);
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

		let collationDropbox = this.createDropdown(localizedConstants.CollationText, [DefaultValue, ...this._model.collationNames], DefaultValue);
		const collationContainer = this.createLabelInputContainer(localizedConstants.CollationText, collationDropbox);

		return this.createGroup(localizedConstants.GeneralSectionHeader, [
			nameContainer,
			ownerContainer,
			collationContainer,
		], false);
	}

	private initializeAdvancedSection(): azdata.GroupContainer {
		return this.createGroup(localizedConstants.AdvancedSectionHeader, [], true, true);
	}
}
