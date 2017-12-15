/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import Event from 'vs/base/common/event';
import data = require('data');

import { DashboardComponentParams } from 'sql/services/bootstrap/bootstrapParams';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';


export enum TaskExecutionMode {
	execute = 0,
	script = 1,
	executeAndScript = 2,
}

export const SERVICE_ID = 'disasterRecoveryService';
export const UI_SERVICE_ID = 'disasterRecoveryUiService';

export const IDisasterRecoveryUiService = createDecorator<IDisasterRecoveryUiService>(UI_SERVICE_ID);

export interface IDisasterRecoveryUiService {
	_serviceBrand: any;

	/**
	 * Show backup wizard
	 */
	showBackup(connection: IConnectionProfile): Promise<any>;

	/**
	 * On show backup event
	 */
	onShowBackupEvent: Event<DashboardComponentParams>;

	/**
	 * Close backup wizard
	 */
	closeBackup();

	/**
	 * After the backup dialog is rendered, run Modal methods to set focusable elements, etc.
	 */
	onShowBackupDialog();
}

export const IDisasterRecoveryService = createDecorator<IDisasterRecoveryService>(SERVICE_ID);

export interface IDisasterRecoveryService {
	_serviceBrand: any;

	getBackupConfigInfo(connectionUri: string): Thenable<data.BackupConfigInfo>;

	/**
	 * Backup a data source using the provided connection
	 */
	backup(connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: data.TaskExecutionMode): Thenable<data.BackupResponse>;

	/**
	 * Register a disaster recovery provider
	 */
	registerProvider(providerId: string, provider: data.DisasterRecoveryProvider): void;

	/**
	 * Restore a data source using a backup file or database
	 */
	restore(connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<data.RestoreResponse>;

	/**
	 * Gets restore plan to do the restore operation on a database
	 */
	getRestorePlan(connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<data.RestorePlanResponse>;

	/**
	 * Gets restore config Info
	 */
	getRestoreConfigInfo(connectionUri: string): Thenable<data.RestoreConfigInfo>;

	/**
	 * Cancel restore plan
	 */
	cancelRestorePlan(connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<boolean>;
}

export const IRestoreDialogController = createDecorator<IRestoreDialogController>('restoreDialogService');
export interface IRestoreDialogController {
	_serviceBrand: any;
	showDialog(connection: IConnectionProfile): TPromise<void>;
}