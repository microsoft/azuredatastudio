/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { Database, DatabaseViewInfo } from '../interfaces';
import { DropDatabaseDocUrl, TelemetryActions } from '../constants';
import * as loc from '../localizedConstants';

export class DropDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	private _dropConnections = false;
	private _deleteBackupHistory = false;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options, loc.DropDatabaseDialogTitle(options.database), 'DropDatabase');
		this.dialogObject.okButton.label = loc.DropButtonLabel;
	}

	protected override get isDirty(): boolean {
		return true;
	}

	protected override get saveChangesTaskLabel(): string {
		return loc.DropObjectOperationDisplayName(loc.DatabaseTypeDisplayName, this.objectInfo.name);
	}

	protected async initializeUI(): Promise<void> {
		let components = [];

		let tableData = [[this.objectInfo.name, this.objectInfo.owner ?? '', this.objectInfo.status ?? '']];
		let columnNames = [loc.NameText, loc.OwnerText, loc.StatusText];
		let fileTable = this.createTable(loc.DatabaseDetailsLabel, columnNames, tableData);
		let tableGroup = this.createGroup(loc.DatabaseDetailsLabel, [fileTable], false);
		components.push(tableGroup);

		if (!this.viewInfo.isAzureDB && !this.viewInfo.isManagedInstance && !this.viewInfo.isSqlOnDemand) {
			let connCheckbox = this.createCheckbox(loc.CloseConnections, async checked => {
				this._dropConnections = checked;
			});
			let updateCheckbox = this.createCheckbox(loc.DeleteBackupHistory, async checked => {
				this._deleteBackupHistory = checked;
			});
			let checkboxGroup = this.createGroup(loc.DropDatabaseOptions, [connCheckbox, updateCheckbox], false);
			components.push(checkboxGroup);
		}
		this.formContainer.addItems(components);
	}

	protected override get helpUrl(): string {
		return DropDatabaseDocUrl;
	}

	protected override get actionName(): string {
		return TelemetryActions.DropObject;
	}

	protected override async saveChanges(contextId: string, object: ObjectManagement.SqlObject): Promise<void> {
		await this.objectManagementService.dropDatabase(this.options.connectionUri, this.options.database, this._dropConnections, this._deleteBackupHistory, false);
	}

	protected override async generateScript(): Promise<string> {
		return await this.objectManagementService.dropDatabase(this.options.connectionUri, this.options.database, this._dropConnections, this._deleteBackupHistory, true);
	}

	protected override async validateInput(): Promise<string[]> {
		return [];
	}
}
