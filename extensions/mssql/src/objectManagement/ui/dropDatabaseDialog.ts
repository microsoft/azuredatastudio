/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { Database, DatabaseViewInfo } from '../interfaces';
import { DropDatabaseDocUrl } from '../constants';
import { DropButtonLabel, DropDatabaseDialogTitle, DeleteBackupHistory, CloseConnections, DropDatabaseOptions, NameText, OwnerText, StatusText, DatabaseDetailsLabel } from '../localizedConstants';

export class DropDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	private _dropConnections = false;
	private _deleteBackupHistory = false;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options, DropDatabaseDialogTitle(options.database), 'DropDatabase');
		this.dialogObject.okButton.label = DropButtonLabel;
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
			let connCheckbox = this.createCheckbox(CloseConnections, async checked => {
				this._dropConnections = checked;
			});
			let updateCheckbox = this.createCheckbox(DeleteBackupHistory, async checked => {
				this._deleteBackupHistory = checked;
			});
			let checkboxGroup = this.createGroup(DropDatabaseOptions, [connCheckbox, updateCheckbox], false);
			components.push(checkboxGroup);
		}
		this.formContainer.addItems(components);
	}

	protected override get helpUrl(): string {
		return DropDatabaseDocUrl;
	}

	protected override async saveChanges(contextId: string, object: ObjectManagement.SqlObject): Promise<void> {
		await this.objectManagementService.dropDatabase(this.options.connectionUri, this.options.database, this.options.objectUrn, this._dropConnections, this._deleteBackupHistory, false);
	}

	protected override async generateScript(): Promise<string> {
		return await this.objectManagementService.dropDatabase(this.options.connectionUri, this.options.database, this.options.objectUrn, this._dropConnections, this._deleteBackupHistory, true);
	}

	protected override async validateInput(): Promise<string[]> {
		return [];
	}
}
