/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { Database, DatabaseViewInfo } from '../interfaces';
import { DropDatabaseDocUrl } from '../constants';
import { DeleteButtonLabel, DeleteDatabaseDialogTitle, DeleteDropBackupHistory, DeleteDropConnections, DeleteDatabaseOptions, NameText, OwnerText, StatusText, DatabaseDetailsLabel } from '../localizedConstants';

export class DeleteDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	private _dropConnections = false;
	private _deleteBackupHistory = false;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options, DeleteDatabaseDialogTitle(options.database), 'DeleteDatabase');
		this.dialogObject.okButton.label = DeleteButtonLabel;
	}

	protected override get isDirty(): boolean {
		return true;
	}

	protected async initializeUI(): Promise<void> {
		let components = [];

		let tableData = [[this.objectInfo.name, this.objectInfo.owner ?? '', this.objectInfo.status ?? '']];
		let columnNames = [NameText, OwnerText, StatusText];
		let fileTable = this.createTable(DatabaseDetailsLabel, columnNames, tableData);
		let tableGroup = this.createGroup(DatabaseDetailsLabel, [fileTable], false);
		components.push(tableGroup);

		if (!this.viewInfo.isAzureDB && !this.viewInfo.isManagedInstance && !this.viewInfo.isSqlOnDemand) {
			let connCheckbox = this.createCheckbox(DeleteDropConnections, async checked => {
				this._dropConnections = checked;
			});
			let updateCheckbox = this.createCheckbox(DeleteDropBackupHistory, async checked => {
				this._deleteBackupHistory = checked;
			});
			let checkboxGroup = this.createGroup(DeleteDatabaseOptions, [connCheckbox, updateCheckbox], false);
			components.push(checkboxGroup);
		}
		this.formContainer.addItems(components);
	}

	protected override get helpUrl(): string {
		return DropDatabaseDocUrl;
	}

	protected override async saveChanges(contextId: string, object: ObjectManagement.SqlObject): Promise<void> {
		await this.objectManagementService.dropDatabase(this.options.connectionUri, this.options.objectUrn, this._dropConnections, this._deleteBackupHistory, false);
	}

	protected override async generateScript(): Promise<string> {
		return await this.objectManagementService.dropDatabase(this.options.connectionUri, this.options.objectUrn, this._dropConnections, this._deleteBackupHistory, true);
	}

	protected override async validateInput(): Promise<string[]> {
		return [];
	}
}
