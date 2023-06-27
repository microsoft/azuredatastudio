/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { Database, DatabaseViewInfo } from '../interfaces';
import { AttachDatabaseDocUrl } from '../constants';
import { AttachDatabaseDialogTitle, NoDatabaseFilesError } from '../localizedConstants';

export class AttachDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	private _databaseFiles: string[] = [];

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options, AttachDatabaseDialogTitle, 'AttachDatabase');
	}

	protected async initializeUI(): Promise<void> {
	}

	protected override get helpUrl(): string {
		return AttachDatabaseDocUrl;
	}

	protected override async validateInput(): Promise<string[]> {
		let errors = await super.validateInput();
		if (this._databaseFiles.length === 0) {
			errors.push(NoDatabaseFilesError);
		}
		return errors;
	}

	protected override async saveChanges(contextId: string, object: ObjectManagement.SqlObject): Promise<void> {
		await this.objectManagementService.attachDatabase(this.options.connectionUri, this.objectInfo.name, this._databaseFiles, false);
	}

	protected override async generateScript(): Promise<string> {
		return await this.objectManagementService.attachDatabase(this.options.connectionUri, this.objectInfo.name, this._databaseFiles, true);
	}
}
