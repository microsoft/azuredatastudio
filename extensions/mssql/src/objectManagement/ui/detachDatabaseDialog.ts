/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { Database, DatabaseViewInfo } from '../interfaces';
import { DetachDatabaseDocUrl, TelemetryActions } from '../constants';
import * as loc from '../localizedConstants';

export class DetachDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	private _dropConnections = false;
	private _updateStatistics = false;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options, loc.DetachDatabaseDialogTitle(options.database), 'DetachDatabase');
		this.dialogObject.okButton.label = loc.DetachButtonLabel;
	}

	protected override get isDirty(): boolean {
		return true;
	}

	protected override get saveChangesTaskLabel(): string {
		return loc.DetachDatabaseOperationDisplayName(this.objectInfo.name);
	}

	protected async initializeUI(): Promise<void> {
		let tableData = this.objectInfo.files.map(file => [file.name, file.type, file.fileGroup, file.path]);
		let columnNames = [loc.DatabaseFileNameLabel, loc.DatabaseFileTypeLabel, loc.DatabaseFileGroupLabel, loc.DatabaseFilePathLabel];
		let fileTable = this.createTable(loc.DatabaseFilesLabel, columnNames, tableData);
		let tableGroup = this.createGroup(loc.DatabaseFilesLabel, [fileTable], false);

		let connCheckbox = this.createCheckbox(loc.DetachDropConnections, async checked => {
			this._dropConnections = checked;
		});
		let updateCheckbox = this.createCheckbox(loc.DetachUpdateStatistics, async checked => {
			this._updateStatistics = checked;
		});
		let checkboxGroup = this.createGroup(loc.DetachDatabaseOptions, [connCheckbox, updateCheckbox], false);

		let components = [tableGroup, checkboxGroup];
		this.formContainer.addItems(components);
	}

	protected override get helpUrl(): string {
		return DetachDatabaseDocUrl;
	}

	protected override get actionName(): string {
		return TelemetryActions.DetachDatabase;
	}

	protected override async saveChanges(contextId: string, object: ObjectManagement.SqlObject): Promise<void> {
		await this.objectManagementService.detachDatabase(this.options.connectionUri, this.options.database, this._dropConnections, this._updateStatistics, false);
	}

	protected override async generateScript(): Promise<string> {
		return await this.objectManagementService.detachDatabase(this.options.connectionUri, this.options.database, this._dropConnections, this._updateStatistics, true);
	}

	protected override async validateInput(): Promise<string[]> {
		return [];
	}
}
