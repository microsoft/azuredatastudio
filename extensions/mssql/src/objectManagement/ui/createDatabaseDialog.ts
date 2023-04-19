/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DefaultInputWidth, ObjectManagementDialogBase } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { CreateDatabaseDocUrl, NodeType } from '../constants';
import * as localizedConstants from '../localizedConstants';

export class CreateDatabaseDialog extends ObjectManagementDialogBase<ObjectManagement.Database, ObjectManagement.CreateDatabaseViewInfo> {
	private readonly _model: ObjectManagement.CreateDatabaseViewInfo;

	private _nameInput: azdata.InputBoxComponent;

	constructor(objectManagementService: IObjectManagementService, connectionUri: string, objectExplorerContext: azdata.ObjectExplorerContext) {
		super(NodeType.Database, CreateDatabaseDocUrl, objectManagementService, connectionUri, true, localizedConstants.CreateDatabaseTitle, objectExplorerContext);
		this._model = {
			objectInfo: {
				name: undefined
			}
		}
	}

	protected override async onConfirmation(): Promise<boolean> {
		return true;
	}

	protected async validateInput(): Promise<string[]> {
		const errors: string[] = [];
		if (!this.objectInfo.name) {
			errors.push(localizedConstants.NameCannotBeEmptyError);
		}
		return errors;
	}

	protected async onComplete(): Promise<void> {
		// Execute create database command
	}

	protected async disposeView(): Promise<void> {
	}

	protected async initializeData(): Promise<ObjectManagement.CreateDatabaseViewInfo> {
		return this._model;
	}

	protected async initializeUI(): Promise<void> {
		let generalSection = this.initializeGeneralSection();
		this.formContainer.addItems([generalSection]);
	}

	private initializeGeneralSection(): azdata.GroupContainer {
		this._nameInput = this.modelView.modelBuilder.inputBox().withProps({
			ariaLabel: localizedConstants.NameText,
			enabled: this.isNewObject,
			value: this.objectInfo.name,
			width: DefaultInputWidth
		}).component();
		this.disposables.push(this._nameInput.onTextChanged(async () => {
			this.objectInfo.name = this._nameInput.value!;
			this.onObjectValueChange();
			await this.runValidation(false);
		}));
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this._nameInput);

		return this.createGroup(localizedConstants.GeneralSectionHeader, [
			nameContainer
		], false);
	}
}
