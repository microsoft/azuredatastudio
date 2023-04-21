/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { DropDatabaseDocUrl } from '../constants';
import path = require('path');
import * as localizedConstants from '../localizedConstants';

export class DeleteDatabaseDialog extends ObjectManagementDialogBase<ObjectManagement.Database, ObjectManagement.DeleteDatabaseViewInfo> {
	private readonly _model: ObjectManagement.DeleteDatabaseViewInfo;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
		this._model = {
			objectInfo: {
				name: path.basename(options.objectExplorerContext?.nodeInfo?.nodePath)
			}
		}
	}


	protected override get docUrl(): string {
		return DropDatabaseDocUrl;
	}

	protected override async onConfirmation(): Promise<boolean> {
		return true;
	}

	protected async validateInput(): Promise<string[]> {
		return [];
	}

	protected async onComplete(): Promise<void> {
		// Execute delete database command
	}

	protected async initializeUI(): Promise<void> {
		let databaseInputComponent = this.createInputBox(this._model.objectInfo.name, this._model.objectInfo.name, false);
		let inputWithLabel = this.createLabelInputContainer(localizedConstants.DatabaseNameLabel, databaseInputComponent);

		// Exclude options below for Azure SQL DB
		let deleteBackupCheckbox = this.createCheckbox(localizedConstants.DeleteBackupsCheckboxLabel, false, true);
		let closeConnectionsCheckbox = this.createCheckbox(localizedConstants.CloseConnectionsCheckboxLabel, false, true);

		let sections = [inputWithLabel, deleteBackupCheckbox, closeConnectionsCheckbox];
		this.formContainer.addItems(sections);
	}
}
