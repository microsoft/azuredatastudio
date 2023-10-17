/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService } from 'mssql';
import { Database, DatabaseViewInfo } from '../interfaces';
import { BackupDatabaseDocUrl } from '../constants';
import * as loc from '../localizedConstants';

export class BackupDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options, loc.DropDatabaseDialogTitle(options.database), 'DropDatabase');
		this.dialogObject.okButton.label = loc.DropButtonLabel;
	}

	protected override get helpUrl(): string {
		return BackupDatabaseDocUrl;
	}

	protected override initializeUI(): Promise<void> {
		throw new Error('Method not implemented.');
	}
}
