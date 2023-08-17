/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { DatabaseFileData, IObjectManagementService, ObjectManagement } from 'mssql';
import { Database, DatabaseViewInfo } from '../interfaces';
import { AttachDatabaseDocUrl } from '../constants';
import { AddFileAriaLabel, AttachAsText, AttachDatabaseDialogTitle, DatabaseName, DatabasesToAttachLabel, MdfFileLocation, NoDatabaseFilesError, OwnerText } from '../localizedConstants';
import { RemoveText } from '../../ui/localizedConstants';
import { DefaultMinTableRowCount, getTableHeight } from '../../ui/dialogBase';
import path = require('path');

export class AttachDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	private _databasesToAttach: DatabaseFileData[] = [];
	private _databasesTable: azdata.TableComponent;
	// private _associatedFilesTable: azdata.TableComponent;
	private _databaseFiles: any[] = [];
	private readonly fileFilters: azdata.window.FileFilters[] = [{ label: 'Data files', filters: ['*.mdf'] }, { label: 'Log files', filters: ['*.ldf'] }];

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options, AttachDatabaseDialogTitle, 'AttachDatabase');
	}

	protected async initializeUI(): Promise<void> {
		let filesSection = this.initializeAttachSection();
		// let associatedFilesSection = this.initializeAssociatedFilesSection();
		this.formContainer.addItems([filesSection]);
	}

	private initializeAttachSection(): azdata.GroupContainer {
		const columns = [MdfFileLocation, DatabaseName, AttachAsText, OwnerText];
		this._databasesTable = this.createTable(DatabasesToAttachLabel, columns, []);
		this.disposables.push(this._databasesTable.onRowSelected(() => this.onFileRowSelected()))

		const buttonContainer = this.addButtonsForTable(this._databasesTable, AddFileAriaLabel, RemoveText,
			async () => await this.onAddFilesButtonClicked(), async () => await this.onRemoveFilesButtonClicked());

		return this.createGroup(DatabasesToAttachLabel, [this._databasesTable, buttonContainer], false);
	}

	// private initializeAssociatedFilesSection(): azdata.GroupContainer {
	// 	const columns = [DatabaseFileNameLabel, DatabaseFileTypeLabel, DatabaseFileGroupLabel, DatabaseFilePathLabel];
	// 	this._associatedFilesTable = this.createTable(DatabaseFilesLabel, columns, []);
	// 	return this.createGroup(AssociatedFilesLabel, [this._associatedFilesTable], false);
	// }

	private onFileRowSelected(): void {
		// TODO: load selected file's data
	}

	private async onAddFilesButtonClicked(): Promise<void> {
		let dataFolder = await this.objectManagementService.getDataFolder(this.options.connectionUri);
		let filePath = await azdata.window.openServerFileBrowserDialog(this.options.connectionUri, dataFolder, this.fileFilters);
		if (filePath) {
			let owner = this.objectInfo.owner ?? 'sa';
			let fileName = path.basename(filePath, path.extname(filePath));
			let tableRow = [filePath, fileName, fileName, owner];

			this._databaseFiles.push(tableRow);
			await this.updateTableData();
		}
	}

	private async onRemoveFilesButtonClicked(): Promise<void> {
		let selectedRows = this._databasesTable.selectedRows;
		let deletedRowCount = 0;
		for (let row of selectedRows) {
			let index = row - deletedRowCount;
			this._databaseFiles.splice(index, 1);
			deletedRowCount++;
		}
		await this.updateTableData();
	}

	private async updateTableData(): Promise<void> {
		await this._databasesTable.updateProperties({
			data: this._databaseFiles,
			height: getTableHeight(this._databaseFiles.length, DefaultMinTableRowCount)
		});
		this.onFormFieldChange();
	}

	protected override get helpUrl(): string {
		return AttachDatabaseDocUrl;
	}

	protected override async validateInput(): Promise<string[]> {
		let errors = [];
		if (this._databasesToAttach.length === 0) {
			errors.push(NoDatabaseFilesError);
		}
		return errors;
	}

	protected override async saveChanges(contextId: string, object: ObjectManagement.SqlObject): Promise<void> {
		// await this.objectManagementService.attachDatabases(this.options.connectionUri, this._databasesToAttach, false);
	}

	protected override async generateScript(): Promise<string> {
		// return await this.objectManagementService.attachDatabases(this.options.connectionUri, this._databasesToAttach, true);
		return '';
	}
}
