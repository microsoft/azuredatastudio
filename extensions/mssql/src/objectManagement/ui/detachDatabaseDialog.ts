/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { Database, DatabaseViewInfo } from '../interfaces';
import { DetachDatabaseDocUrl } from '../constants';

export class DetachDatabaseDialog extends ObjectManagementDialogBase<Database, DatabaseViewInfo> {
	private _dropConnections: boolean;
	private _updateStatistics: boolean;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
	}

	protected override initializeUI(): Promise<void> {
		throw new Error('Method not implemented.');
	}

	protected override get helpUrl(): string {
		return DetachDatabaseDocUrl;
	}

	protected override async saveChanges(contextId: string, object: ObjectManagement.SqlObject): Promise<void> {
		await this.objectManagementService.detachDatabase(this.options.connectionUri, this.options.objectUrn, this._dropConnections, this._updateStatistics);
	}

	protected override async generateScript(): Promise<string> {
		return await this.objectManagementService.scriptDetachDatabase(this.contextId, this.options.objectUrn, this._dropConnections, this._updateStatistics);
	}
}
