/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import * as sqlops from 'sqlops';

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
export { TaskExecutionMode } from 'sql/platform/backup/common/backupService';

export const SERVICE_ID = 'restoreService';
export const IRestoreService = createDecorator<IRestoreService>(SERVICE_ID);

export interface IRestoreService {
	_serviceBrand: any;

	/**
	 * Register a disaster recovery provider
	 */
	registerProvider(providerId: string, provider: sqlops.RestoreProvider): void;

	/**
	 * Restore a data source using a backup file or database
	 */
	restore(connectionUri: string, restoreInfo: sqlops.RestoreInfo): Thenable<sqlops.RestoreResponse>;

	/**
	 * Gets restore plan to do the restore operation on a database
	 */
	getRestorePlan(connectionUri: string, restoreInfo: sqlops.RestoreInfo): Thenable<sqlops.RestorePlanResponse>;

	/**
	 * Gets restore config Info
	 */
	getRestoreConfigInfo(connectionUri: string): Thenable<sqlops.RestoreConfigInfo>;

	/**
	 * Cancel restore plan
	 */
	cancelRestorePlan(connectionUri: string, restoreInfo: sqlops.RestoreInfo): Thenable<boolean>;
}

export const IRestoreDialogController = createDecorator<IRestoreDialogController>('restoreDialogService');
export interface IRestoreDialogController {
	_serviceBrand: any;
	showDialog(connection: IConnectionProfile): TPromise<void>;
}
