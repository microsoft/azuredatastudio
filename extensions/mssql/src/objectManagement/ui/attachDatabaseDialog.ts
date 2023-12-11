/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { DatabaseFileData, IObjectManagementService, ObjectManagement } from 'mssql';
import { Database, DatabaseViewInfo } from '../interfaces';
import { AttachDatabaseDocUrl, TelemetryActions } from '../constants';
import * as loc from '../localizedConstants';
import { RemoveText } from '../../ui/localizedConstants';
import { DefaultMinTableRowCount, DialogButton, getTableHeight } from '../../ui/dialogBase';
import path = require('path');
import { getErrorMessage } from '../../utils';

export class AttachDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	private _databasesToAttach: DatabaseFileData[] = [];
	private _databasesTable: azdata.TableComponent;
	private _associatedFilesTable: azdata.TableComponent;
	private _databaseFiles: string[][] = [];
	private readonly _fileFilters: azdata.window.FileFilters[] = [{ label: loc.DatabaseFilesFilterLabel, filters: ['*.mdf'] }];

	private _nameField: azdata.InputBoxComponent;
	private _nameContainer: azdata.FlexContainer;

	private _ownerDropdown: azdata.DropDownComponent;
	private _ownerContainer: azdata.FlexContainer;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options, loc.AttachDatabaseDialogTitle, 'AttachDatabase');
		this.dialogObject.okButton.label = loc.AttachButtonLabel;
	}

	protected override get isDirty(): boolean {
		return this._databasesToAttach.length > 0;
	}

	protected override get saveChangesTaskLabel(): string {
		return loc.AttachDatabaseOperationDisplayName;
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

		let addButton: DialogButton = {
			buttonAriaLabel: loc.AddFileAriaLabel,
			buttonHandler: async () => await this.onAddFilesButtonClicked()
		};
		let removeButton: DialogButton = {
			buttonAriaLabel: RemoveText,
			buttonHandler: async () => await this.onRemoveFilesButtonClicked()
		};
		const buttonContainer = this.addButtonsForTable(this._databasesTable, addButton, removeButton);

		this._nameField = this.createInputBox(async newValue => {
			if (this._databasesTable.selectedRows?.length > 0) {
				let selectedRow = this._databasesTable.selectedRows[0];
				let dbFile = this._databasesToAttach[selectedRow];
				dbFile.databaseName = newValue;
			}
		}, {});
		this._nameContainer = this.createLabelInputContainer(loc.AttachAsText, this._nameField);

		this._ownerDropdown = this.createDropdown(loc.OwnerText, async newValue => {
			if (this._databasesTable.selectedRows?.length > 0) {
				let selectedRow = this._databasesTable.selectedRows[0];
				let dbFile = this._databasesToAttach[selectedRow];
				dbFile.owner = newValue;
			}
		}, this.viewInfo.loginNames.options, this.viewInfo.loginNames.options[this.viewInfo.loginNames.defaultValueIndex]);
		this._ownerContainer = this.createLabelInputContainer(loc.OwnerText, this._ownerDropdown);

		// Hide input controls until we have files in the table
		this._nameContainer.display = 'none';
		this._ownerContainer.display = 'none';

		return this.createGroup(loc.DatabasesToAttachLabel, [this._databasesTable, buttonContainer, this._nameContainer, this._ownerContainer], false);
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

			this._nameField.value = dbFile.databaseName;
			this._ownerDropdown.value = dbFile.owner;

			await this.updateAssociatedFilesTable(dbFile.databaseFilePaths);
		} else {
			await this.updateAssociatedFilesTable([]);
		}
	}

	private async updateAssociatedFilesTable(filePaths: string[]): Promise<void> {
		let tableRows = filePaths.map(filePath => {
			let ext = path.extname(filePath);
			let fileType = ext === '.ldf' ? loc.LogFileLabel : loc.DataFileLabel;
			let fileName = path.basename(filePath, ext);
			return [fileName, fileType, filePath];
		});
		await this._associatedFilesTable.updateProperties({
			data: tableRows,
			height: getTableHeight(tableRows.length, DefaultMinTableRowCount)
		});
	}

	private async onAddFilesButtonClicked(): Promise<void> {
		try {
			let dataFolder = await this.objectManagementService.getDataFolder(this.options.connectionUri);
			let filePath = await azdata.window.openServerFileBrowserDialog(this.options.connectionUri, dataFolder, this._fileFilters);
			if (filePath) {
				let owner = this.viewInfo.loginNames?.options[this.viewInfo.loginNames.defaultValueIndex];
				let fileName = path.basename(filePath, path.extname(filePath));
				let tableRow = [filePath, fileName];

				// Associated files will also include the primary file, so we don't need to add it to the array again
				let associatedFiles = await this.objectManagementService.getAssociatedFiles(this.options.connectionUri, filePath) ?? [];

				this._databaseFiles.push(tableRow);
				this._databasesToAttach.push({ databaseName: fileName, databaseFilePaths: associatedFiles, owner });

				this._nameContainer.display = 'block';
				this._ownerContainer.display = 'block';

				await this.updateTableData();
				this._databasesTable.setActiveCell(this._databasesToAttach.length - 1, 0);
			}
		} catch (error) {
			this.dialogObject.message = {
				text: getErrorMessage(error),
				level: azdata.window.MessageLevel.Error
			};
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
			this._nameContainer.display = 'none';
			this._ownerContainer.display = 'none';
		} else {
			this._databasesTable.setActiveCell(0, 0);
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

	protected override get actionName(): string {
		return TelemetryActions.AttachDatabase;
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
