/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagementDialogBase } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { NodeType } from '../constants';
import path = require('path');
import * as localizedConstants from '../localizedConstants';

export class DeleteDatabaseDialog extends ObjectManagementDialogBase<ObjectManagement.Database, ObjectManagement.DeleteDatabaseViewInfo> {
	private readonly _model: ObjectManagement.DeleteDatabaseViewInfo;

	constructor(objectManagementService: IObjectManagementService, connectionUri: string, objectExplorerContext: azdata.ObjectExplorerContext) {
		super(NodeType.Database, undefined, objectManagementService, connectionUri, false, localizedConstants.DeleteDatabaseTitle, objectExplorerContext);
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
		// if (this.isNewObject) {
		// 	await this.objectManagementService.createLogin(this.contextId, this.objectInfo);
		// } else {
		// 	await this.objectManagementService.updateLogin(this.contextId, this.objectInfo);
		// }
	}

	protected async disposeView(): Promise<void> {
		// await this.objectManagementService.disposeLoginView(this.contextId);
	}

	protected async initializeData(): Promise<ObjectManagement.DeleteDatabaseViewInfo> {
		return this._model;
	}

	protected async initializeUI(): Promise<void> {
		let databaseLabelComponent = this.createLabelTextContainer(localizedConstants.DatabaseNameLabel, this._model.objectInfo.name);
		let deleteBackupCheckbox = this.createCheckbox(localizedConstants.DeleteBackupsCheckboxLabel, false, true);
		let closeConnectionsCheckbox = this.createCheckbox(localizedConstants.CloseConnectionsCheckboxLabel, false, true);

		let sections = [databaseLabelComponent, deleteBackupCheckbox, closeConnectionsCheckbox];
		this.formContainer.addItems(sections);
	}
}
