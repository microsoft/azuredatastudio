/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagementDialogBase } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { DropDatabaseDocUrl, NodeType } from '../constants';
import path = require('path');
import * as localizedConstants from '../localizedConstants';

export class DeleteDatabaseDialog extends ObjectManagementDialogBase<ObjectManagement.Database, ObjectManagement.DeleteDatabaseViewInfo> {
	private readonly _model: ObjectManagement.DeleteDatabaseViewInfo;

	constructor(objectManagementService: IObjectManagementService, connectionUri: string, objectExplorerContext: azdata.ObjectExplorerContext) {
		super(NodeType.Database, DropDatabaseDocUrl, objectManagementService, connectionUri, false, localizedConstants.DeleteDatabaseTitle, objectExplorerContext);
		this._model = {
			objectInfo: {
				name: path.basename(objectExplorerContext.nodeInfo?.nodePath)
			}
		}
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

	protected async disposeView(): Promise<void> {
	}

	protected async initializeData(): Promise<ObjectManagement.DeleteDatabaseViewInfo> {
		return this._model;
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
