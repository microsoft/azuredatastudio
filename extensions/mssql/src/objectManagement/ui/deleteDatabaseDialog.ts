/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagementDialogBase } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { NodeType } from '../constants';

export class DeleteDatabaseDialog extends ObjectManagementDialogBase<ObjectManagement.Database, ObjectManagement.DeleteDatabaseViewInfo> {
	constructor(objectManagementService: IObjectManagementService, connectionUri: string, objectExplorerContext?: azdata.ObjectExplorerContext) {
		super(NodeType.Database, undefined, objectManagementService, connectionUri, false, undefined, objectExplorerContext);
	}

	protected override async onConfirmation(): Promise<boolean> {
		return false;
	}

	protected async validateInput(): Promise<string[]> {
		const errors: string[] = [];

		return errors;
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
		// const viewInfo = await this.objectManagementService.initializeLoginView(this.connectionUri, this.contextId, this.isNewObject, this.objectName);
		// viewInfo.objectInfo.password = viewInfo.objectInfo.password ?? '';
		// return viewInfo;
		return undefined;
	}

	protected async initializeUI(): Promise<void> {
		const sections: azdata.Component[] = [];

		this.formContainer.addItems(sections);
	}
}
