/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { Database, DatabaseViewInfo } from '../interfaces';
import { DetachDatabaseDocUrl } from '../constants';
import { DatabaseFileGroupLabel, DatabaseFileNameLabel, DatabaseFilePathLabel, DatabaseFileTypeLabel, DatabaseFilesLabel, DetachDatabaseDialogTitle, DetachDatabaseOptions, DetachDropConnections, DetachUpdateStatistics } from '../localizedConstants';

export class DetachDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	private _dropConnections = false;
	private _updateStatistics = false;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options, DetachDatabaseDialogTitle(options.database), 'DetachDatabase');
	}

	protected override get isDirty(): boolean {
		return true;
	}

	protected async initializeUI(): Promise<void> {
		let tableData = this.viewInfo.files.map(file => [file.name, file.type, file.fileGroup, file.path]);
		let columnNames = [DatabaseFileNameLabel, DatabaseFileTypeLabel, DatabaseFileGroupLabel, DatabaseFilePathLabel];
		let fileTable = this.createTable(DatabaseFilesLabel, columnNames, tableData);
		let tableGroup = this.createGroup(DatabaseFilesLabel, [fileTable], false);

		let connCheckbox = this.createCheckbox(DetachDropConnections, async checked => {
			this._dropConnections = checked;
		});
		let updateCheckbox = this.createCheckbox(DetachUpdateStatistics, async checked => {
			this._updateStatistics = checked;
		});
		let checkboxGroup = this.createGroup(DetachDatabaseOptions, [connCheckbox, updateCheckbox], false);

		let components = [tableGroup, checkboxGroup];
		this.formContainer.addItems(components);
	}

	protected override get helpUrl(): string {
		return DetachDatabaseDocUrl;
	}

	protected override async saveChanges(contextId: string, object: ObjectManagement.SqlObject): Promise<void> {
		await this.objectManagementService.detachDatabase(this.options.connectionUri, this.options.objectUrn, this._dropConnections, this._updateStatistics, false);
	}

	protected override async generateScript(): Promise<string> {
		return await this.objectManagementService.detachDatabase(this.options.connectionUri, this.options.objectUrn, this._dropConnections, this._updateStatistics, true);
	}

	protected override async validateInput(): Promise<string[]> {
		return [];
	}
}
