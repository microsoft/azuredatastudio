/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { DatabaseFileData, IObjectManagementService, ObjectManagement } from 'mssql';
import { Database, DatabaseViewInfo } from '../interfaces';
import { AttachDatabaseDocUrl } from '../constants';
import * as loc from '../localizedConstants';
import { RemoveText } from '../../ui/localizedConstants';
import { DefaultMinTableRowCount, getTableHeight } from '../../ui/dialogBase';
import path = require('path');

export class AttachDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	private _databasesToAttach: DatabaseFileData[] = [];
	private _databasesTable: azdata.TableComponent;
	private _associatedFilesTable: azdata.TableComponent;
	private _databaseFiles: string[][] = [];
	private readonly fileFilters: azdata.window.FileFilters[] = [{ label: loc.DatabaseFilesFilterLabel, filters: ['*.mdf'] }];

	private nameField: azdata.InputBoxComponent;
	private nameContainer: azdata.FlexContainer;

	private ownerDropdown: azdata.DropDownComponent;
	private ownerContainer: azdata.FlexContainer;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options, loc.AttachDatabaseDialogTitle, 'AttachDatabase');
		this.dialogObject.okButton.label = loc.AttachButtonLabel;
	}

	protected override get isDirty(): boolean {
		return this._databasesToAttach.length > 0;
	}

	protected async initializeUI(): Promise<void> {
		let filesSection = this.initializeAttachSection();
		let associatedSection = this.initializeAssociatedFilesSection();
		this.formContainer.addItems([filesSection, associatedSection]);
	}

	private initializeAttachSection(): azdata.GroupContainer {
		const columns = [loc.MdfFileLocation, loc.DatabaseName];
		this._databasesTable = this.createTable(loc.DatabasesToAttachLabel, columns, []);
		this.disposables.push(this._databasesTable.onRowSelected(() => this.onFileRowSelected()))

		const buttonContainer = this.addButtonsForTable(this._databasesTable, loc.AddFileAriaLabel, RemoveText,
			async () => await this.onAddFilesButtonClicked(), async () => await this.onRemoveFilesButtonClicked());

		this.nameField = this.createInputBox(async newValue => {
			let selectedRow = this._databasesTable.selectedRows[0];
			let dbFile = this._databasesToAttach[selectedRow];
			dbFile.databaseName = newValue;
		}, {});
		this.nameContainer = this.createLabelInputContainer(loc.AttachAsText, this.nameField);

		this.ownerDropdown = this.createDropdown(loc.OwnerText, async newValue => {
			let selectedRow = this._databasesTable.selectedRows[0];
			let dbFile = this._databasesToAttach[selectedRow];
			dbFile.owner = newValue;
		}, this.viewInfo.loginNames.options, this.viewInfo.loginNames.options[this.viewInfo.loginNames.defaultValueIndex]);
		this.ownerContainer = this.createLabelInputContainer(loc.OwnerText, this.ownerDropdown);

		// Hide input controls until we have files in the table
		this.nameContainer.display = 'none';
		this.ownerContainer.display = 'none';

		return this.createGroup(loc.DatabasesToAttachLabel, [this._databasesTable, buttonContainer, this.nameContainer, this.ownerContainer], false);
	}

	private initializeAssociatedFilesSection(): azdata.GroupContainer {
		const columns = [loc.DatabaseFileNameLabel, loc.DatabaseFileTypeLabel, loc.DatabaseFilePathLabel];
		this._associatedFilesTable = this.createTable(loc.DatabaseFilesLabel, columns, []);
		return this.createGroup(loc.AssociatedFilesLabel, [this._associatedFilesTable], false);
	}

	private async onFileRowSelected(): Promise<void> {
		if (this._databasesTable.selectedRows?.length > 0) {
			let selectedRow = this._databasesTable.selectedRows[0];
			let dbFile = this._databasesToAttach[selectedRow];
			let filePaths = dbFile.databaseFilePaths.slice(1);
			await this.updateAssociatedFilesTable(filePaths);
		} else {
			await this.updateAssociatedFilesTable([]);
		}
	}

	private async updateAssociatedFilesTable(filePaths: string[]): Promise<void> {
		let tableRows = filePaths.map(filePath => {
			let ext = path.extname(filePath);
			let fileType = ext === '.mdf' ? 'Data' : 'Log';
			let fileName = path.basename(filePath, ext);
			return [fileName, fileType, filePath];
		});
		await this._associatedFilesTable.updateProperties({
			data: tableRows,
			height: getTableHeight(tableRows.length, DefaultMinTableRowCount)
		});
	}

	private async onAddFilesButtonClicked(): Promise<void> {
		let dataFolder = await this.objectManagementService.getDataFolder(this.options.connectionUri);
		let filePath = await azdata.window.openServerFileBrowserDialog(this.options.connectionUri, dataFolder, this.fileFilters);
		if (filePath) {
			let owner = this.viewInfo.loginNames?.options[this.viewInfo.loginNames.defaultValueIndex];
			let fileName = path.basename(filePath, path.extname(filePath));
			let tableRow = [filePath, fileName];

			// Associated files will also include the primary file, so we don't need to add it to the array again
			let associatedFiles = await this.objectManagementService.getAssociatedFiles(this.options.connectionUri, filePath) ?? [];

			this._databaseFiles.push(tableRow);
			this._databasesToAttach.push({ databaseName: fileName, databaseFilePaths: associatedFiles, owner });

			this.nameContainer.display = 'block';
			this.ownerContainer.display = 'block';
			this.nameField.value = fileName;
			this.ownerDropdown.value = owner;

			await this.updateTableData();
			await this.updateAssociatedFilesTable(associatedFiles);
		}
	}

	private async onRemoveFilesButtonClicked(): Promise<void> {
		let selectedRows = this._databasesTable.selectedRows;
		let deletedRowCount = 0;
		for (let row of selectedRows) {
			let index = row - deletedRowCount;
			this._databaseFiles.splice(index, 1);
			this._databasesToAttach.splice(index, 1);
			deletedRowCount++;
		}
		if (this._databasesToAttach.length === 0) {
			this.nameContainer.display = 'none';
			this.ownerContainer.display = 'none';
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
			errors.push(loc.NoDatabaseFilesError);
		}
		return errors;
	}

	protected override async saveChanges(contextId: string, object: ObjectManagement.SqlObject): Promise<void> {
		await this.objectManagementService.attachDatabases(this.options.connectionUri, this._databasesToAttach, false);
	}

	protected override async generateScript(): Promise<string> {
		return await this.objectManagementService.attachDatabases(this.options.connectionUri, this._databasesToAttach, true);
	}
}
