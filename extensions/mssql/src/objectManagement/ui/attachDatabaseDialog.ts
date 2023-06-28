/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { Database, DatabaseViewInfo } from '../interfaces';
import { AttachDatabaseDocUrl } from '../constants';
import { AddFileAriaLabel, AssociatedFilesLabel, AttachAsText, AttachDatabaseDialogTitle, DatabaseFileGroupLabel, DatabaseFileNameLabel, DatabaseFilePathLabel, DatabaseFileTypeLabel, DatabaseFilesLabel, DatabaseName, DatabasesToAttachLabel, MdfFileLocation, NoDatabaseFilesError, OwnerText } from '../localizedConstants';
import { RemoveText } from '../../ui/localizedConstants';
import { EOL } from 'os';

interface AttachDatabaseData {
	databaseName: string;
	filePaths: string[];
}

export class AttachDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	private _databasesToAttach: AttachDatabaseData[] = [];
	private _databasesTable: azdata.TableComponent;
	private _associatedFilesTable: azdata.TableComponent;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options, AttachDatabaseDialogTitle, 'AttachDatabase');
	}

	protected async initializeUI(): Promise<void> {
		let filesSection = this.initializeAttachSection();
		let associatedFilesSection = this.initializeAssociatedFilesSection();
		this.formContainer.addItems([filesSection, associatedFilesSection]);
	}

	private initializeAttachSection(): azdata.GroupContainer {
		const columns = [MdfFileLocation, DatabaseName, AttachAsText, OwnerText];
		this._databasesTable = this.createTable(DatabasesToAttachLabel, columns, []);
		this.disposables.push(this._databasesTable.onRowSelected(() => this.onFileRowSelected()))

		const buttonContainer = this.addButtonsForTable(this._databasesTable, AddFileAriaLabel, RemoveText,
			() => this.onAddFilesButtonClicked(), () => this.onRemoveFilesButtonClicked());

		return this.createGroup(DatabasesToAttachLabel, [this._databasesTable, buttonContainer], false);
	}

	private initializeAssociatedFilesSection(): azdata.GroupContainer {
		const columns = [DatabaseFileNameLabel, DatabaseFileTypeLabel, DatabaseFileGroupLabel, DatabaseFilePathLabel];
		this._associatedFilesTable = this.createTable(DatabaseFilesLabel, columns, []);
		return this.createGroup(AssociatedFilesLabel, [this._associatedFilesTable], false);
	}

	private onFileRowSelected(): void {

	}

	private async onAddFilesButtonClicked(): Promise<void> {
		throw new Error('Not implemented.');
	}

	private async onRemoveFilesButtonClicked(): Promise<void> {
		throw new Error('Not implemented.');
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
		for (let databaseData of this._databasesToAttach) {
			await this.objectManagementService.attachDatabase(this.options.connectionUri, databaseData.databaseName, databaseData.filePaths, false);
		}
	}

	protected override async generateScript(): Promise<string> {
		let scripts = [];
		for (let databaseData of this._databasesToAttach) {
			let script = await this.objectManagementService.attachDatabase(this.options.connectionUri, databaseData.databaseName, databaseData.filePaths, true);
			scripts.push(script);
		}
		return scripts.join(EOL);
	}
}
