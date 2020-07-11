/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import * as azdata from 'azdata';

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
export { TaskExecutionMode } from 'sql/platform/backup/common/backupService';

export const SERVICE_ID = 'restoreService';
export const IRestoreService = createDecorator<IRestoreService>(SERVICE_ID);

export interface IRestoreService {
	_serviceBrand: undefined;

	/**
	 * Register a disaster recovery provider
	 */
	registerProvider(providerId: string, provider: azdata.RestoreProvider): void;

	/**
	 * Restore a data source using a backup file or database
	 */
	restore(connectionUri: string, restoreInfo: azdata.RestoreInfo): Thenable<azdata.RestoreResponse>;

	/**
	 * Gets restore plan to do the restore operation on a database
	 */
	getRestorePlan(connectionUri: string, restoreInfo: azdata.RestoreInfo): Thenable<azdata.RestorePlanResponse>;

	/**
	 * Gets restore config Info
	 */
	getRestoreConfigInfo(connectionUri: string): Thenable<azdata.RestoreConfigInfo>;

	/**
	 * Cancel restore plan
	 */
	cancelRestorePlan(connectionUri: string, restoreInfo: azdata.RestoreInfo): Thenable<boolean>;
}

export const IRestoreDialogController = createDecorator<IRestoreDialogController>('restoreDialogService');
export interface IRestoreDialogController {
	_serviceBrand: undefined;
	showDialog(connection: IConnectionProfile): Promise<void>;
}
